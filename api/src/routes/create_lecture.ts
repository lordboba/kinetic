import { RouteHandler } from "fastify";
import { CreateLectureUploadSchema } from "schema/zod_types";
import { buildFileUploadsForLLM } from "../helpers/file";
import * as z from "zod";

export const create_lecture_initial: RouteHandler = async (req, res) => {
  let lectureConfigRaw: unknown = undefined;
  let lecturePrefsRaw: unknown = undefined;

  const fileParts: Array<{
    filename: string;
    mimetype: string;
    file: NodeJS.ReadableStream;
  }> = [];

  // req.parts() is AsyncIterable<Multipart | MultipartFile>, where
  // - MultipartFile has: file, filename, mimetype, fieldname, etc.
  // - MultipartValue<T> has: value, fieldname, etc.
  //
  // We have to narrow manually.

  for await (const part of req.parts()) {
    // FILE BRANCH
    // Heuristic: file parts have .file (Readable stream) and .filename (string).
    if ("file" in part && typeof part.file !== "undefined") {
      // This is a file upload field

      if (part.fieldname === "files") {
        fileParts.push({
          filename: part.filename, // string
          mimetype: part.mimetype, // string
          file: part.file, // Readable stream
        });
      } else {
        return res.code(400).send({
          error: `Unexpected file field '${part.fieldname}'`,
        });
      }

      continue;
    }

    // TEXT BRANCH
    // MultipartValue<T> has .value which is the string body of the field
    if ("value" in part) {
      if (part.fieldname === "lecture_config") {
        try {
          lectureConfigRaw = JSON.parse(part.value as string);
        } catch {
          return res
            .code(400)
            .send({ error: "lecture_config is not valid JSON" });
        }
      } else if (part.fieldname === "lecture_preferences") {
        try {
          lecturePrefsRaw = JSON.parse(part.value as string);
        } catch {
          return res
            .code(400)
            .send({ error: "lecture_preferences is not valid JSON" });
        }
      } else if (part.fieldname === "files") {
        // If the client *accidentally* sends a text field also named "files"
        // instead of a binary part, reject to keep the API strict.
        return res.code(400).send({
          error:
            "Expected 'files' to be file upload(s), not text. Got text field.",
        });
      } else {
        return res.code(400).send({
          error: `Unexpected field '${part.fieldname}'`,
        });
      }

      continue;
    }

    // If we hit here, Fastify gave us something we didn't expect
    return res.code(400).send({
      error: "Received multipart part of unknown type",
    });
  }

  // Build the candidate object for Zod validation
  const candidate = {
    lecture_config: lectureConfigRaw,
    lecture_preferences: lecturePrefsRaw,
    files: fileParts.length > 0 ? fileParts : undefined,
  };

  // Validate with Zod
  const parsed = CreateLectureUploadSchema.safeParse(candidate);

  if (!parsed.success) {
    return res.code(400).send({
      error: "Validation failed",
      details: z.treeifyError(parsed.error),
    });
  }

  const data = parsed.data;

  // You can now trust `data`
  // data.lecture_config.lecture_topic (string)
  // data.lecture_preferences?.tone (enum or undefined)
  // data.files?.[i].file (Readable stream)

  const llmFiles = await buildFileUploadsForLLM(data.files);

  return res.code(200).send({
    ok: true,
    topic: data.lecture_config.lecture_topic,
    num_files: data.files?.length ?? 0,
  });
};
