import path from "path";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export type FileUpload = {
  name: string;
  content: string;
};

/**
 * Turn a Node ReadableStream (Fastify file part) into a Buffer.
 */
export function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Extract raw text from a PPTX buffer.
 */
export async function extractTextFromPptx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);

  const slideNames = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name)
  );

  slideNames.sort((a, b) => {
    const aNum = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
    const bNum = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
    return aNum - bNum;
  });

  const slidesText: string[] = [];

  for (const slideName of slideNames) {
    const xml = await zip.files[slideName].async("text");
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (!matches) continue;

    const cleanedRuns = matches
      .map((frag) =>
        frag
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((t) => t.length > 0);

    if (cleanedRuns.length > 0) {
      slidesText.push(cleanedRuns.join("\n"));
    }
  }

  return slidesText.join("\n\n---\n\n");
}

/** Extract text from a DOCX buffer. */
export async function extractTextFromDocx(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

/** Extract text from a PDF buffer using pdf-parse. */
export async function extractTextFromPdf(buf: Buffer): Promise<string> {
  const parser = new PDFParse(buf);
  const parsed = await parser.getText();
  return parsed.text;
}

/** Extract text from plain files (txt, md, code, etc.). */
export function extractTextFromPlain(buf: Buffer): string {
  return buf.toString("utf8");
}

/** Normalize text for LLM ingestion. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Dispatch extraction logic by mimetype and extension. */
export async function extractTextFromFile(
  buf: Buffer,
  mimetype: string,
  filename: string
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (
    mimetype.startsWith("text/") ||
    [
      ".txt",
      ".md",
      ".json",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".c",
      ".h",
      ".hpp",
      ".cc",
      ".cpp",
      ".rs",
      ".go",
      ".java",
      ".sh",
      ".yaml",
      ".yml",
      ".csv",
      ".log",
    ].includes(ext)
  ) {
    return extractTextFromPlain(buf);
  }

  if (mimetype === "application/pdf" || ext === ".pdf") {
    return extractTextFromPdf(buf);
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return extractTextFromDocx(buf);
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === ".pptx"
  ) {
    return extractTextFromPptx(buf);
  }

  return "";
}

/** High-level helper returning [{ name, content }] for LLM ingestion. */
export async function buildFileUploadsForLLM(
  files:
    | Array<{
        filename: string;
        mimetype: string;
        file: NodeJS.ReadableStream;
      }>
    | undefined
): Promise<FileUpload[]> {
  if (!files || files.length === 0) return [];

  const results: FileUpload[] = [];

  for (const f of files) {
    const buf = await streamToBuffer(f.file);
    const rawText = await extractTextFromFile(buf, f.mimetype, f.filename);
    const normalized = normalizeText(rawText);

    results.push({ name: f.filename, content: normalized });
  }

  return results;
}
