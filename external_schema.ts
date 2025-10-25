import { z } from "zod";

/// LIVEKIT EXTERNAL SCHEMAS ///

/**
 * LiveKit uses an Agents framework, not traditional REST APIs.
 * These schemas represent the configuration and data structures used
 * in LiveKit's Python/Node.js SDK for building voice AI agents.
 */

// Text-to-Speech (TTS) Configuration
export const LiveKitTTSConfigSchema = z.object({
  // Format: "provider/model:voice_id"
  // Example: "cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
  model_descriptor: z.string().optional(),
  provider: z.enum(["cartesia", "elevenlabs", "rime", "inworld", "openai", "google"]).optional(),
  model: z.string().optional(),
  voice_id: z.string().optional(), // UUID or provider-specific voice identifier
});
export type LiveKitTTSConfig = z.infer<typeof LiveKitTTSConfigSchema>;

// TTS Stream Output (from SynthesizedAudio events)
export const LiveKitSynthesizedAudioSchema = z.object({
  audio_data: z.instanceof(ArrayBuffer).or(z.instanceof(Uint8Array)), // Raw audio bytes
  sample_rate: z.number().optional(),
  channels: z.number().optional(),
  duration_ms: z.number().optional(),
});
export type LiveKitSynthesizedAudio = z.infer<typeof LiveKitSynthesizedAudioSchema>;

// Speech-to-Text (STT) Configuration
export const LiveKitSTTConfigSchema = z.object({
  // Format: "provider/model:language"
  // Example: "deepgram/nova-3:en" or "assemblyai/universal-streaming:multi"
  model_descriptor: z.string().optional(),
  provider: z.enum(["deepgram", "assemblyai", "google", "speechmatics"]).optional(),
  model: z.string().optional(),
  language: z.string().optional(), // ISO language code: "en", "es", "multi", etc.
});
export type LiveKitSTTConfig = z.infer<typeof LiveKitSTTConfigSchema>;

// STT Stream Event Types
export const LiveKitSpeechEventTypeSchema = z.enum([
  "FINAL_TRANSCRIPT",
  "INTERIM_TRANSCRIPT",
  "START_OF_SPEECH",
  "END_OF_SPEECH",
]);
export type LiveKitSpeechEventType = z.infer<typeof LiveKitSpeechEventTypeSchema>;

export const LiveKitSpeechEventSchema = z.object({
  type: LiveKitSpeechEventTypeSchema,
  alternatives: z.array(
    z.object({
      text: z.string(),
      confidence: z.number().optional(),
      words: z
        .array(
          z.object({
            word: z.string(),
            start_time_ms: z.number(),
            end_time_ms: z.number(),
            confidence: z.number(),
          })
        )
        .optional(),
    })
  ),
});
export type LiveKitSpeechEvent = z.infer<typeof LiveKitSpeechEventSchema>;

// Avatar Session Configuration
export const LiveKitAvatarConfigSchema = z.object({
  avatar_id: z.string(), // Provider-specific avatar identifier
  provider: z.enum(["tavus", "hedra", "bithuman", "bey", "anam", "simli"]),

  // Hedra-specific: requires source image
  source_image_url: z.string().optional(),

  // Video output settings
  video_width: z.number().optional(),
  video_height: z.number().optional(), // Hedra renders at 512x512
  video_fps: z.number().optional(),

  // Audio settings
  audio_sample_rate: z.number().optional(),
  audio_channels: z.number().optional(),
});
export type LiveKitAvatarConfig = z.infer<typeof LiveKitAvatarConfigSchema>;

// Agent Session Configuration (combines TTS, STT, and Avatar)
export const LiveKitAgentSessionConfigSchema = z.object({
  tts: z.union([z.string(), LiveKitTTSConfigSchema]), // Model descriptor or config object
  stt: z.union([z.string(), LiveKitSTTConfigSchema]), // Model descriptor or config object
  llm: z.string().optional(), // LLM model descriptor (e.g., "openai/gpt-4")
  avatar: LiveKitAvatarConfigSchema.optional(),
});
export type LiveKitAgentSessionConfig = z.infer<typeof LiveKitAgentSessionConfigSchema>;

/// FIREBASE SDK SCHEMAS ///

/**
 * Firebase modular SDK (v9+) for TypeScript
 * Package: firebase@^12.0.0
 * Docs: https://firebase.google.com/docs/reference/js
 */

// Firebase App Initialization
export const FirebaseConfigSchema = z.object({
  apiKey: z.string(),
  authDomain: z.string(),
  projectId: z.string(),
  storageBucket: z.string(),
  messagingSenderId: z.string(),
  appId: z.string(),
  measurementId: z.string().optional(),
});
export type FirebaseConfig = z.infer<typeof FirebaseConfigSchema>;

// Firebase Auth Types
export const FirebaseUserSchema = z.object({
  uid: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
  emailVerified: z.boolean(),
  metadata: z.object({
    creationTime: z.string().optional(),
    lastSignInTime: z.string().optional(),
  }),
});
export type FirebaseUser = z.infer<typeof FirebaseUserSchema>;

export const FirebaseUserCredentialSchema = z.object({
  user: FirebaseUserSchema,
  providerId: z.string().nullable(),
  operationType: z.string(),
});
export type FirebaseUserCredential = z.infer<typeof FirebaseUserCredentialSchema>;

export const FirebaseAuthErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  name: z.string(),
});
export type FirebaseAuthError = z.infer<typeof FirebaseAuthErrorSchema>;

// Firestore Types
export const FirestoreDocumentReferenceSchema = z.object({
  id: z.string(),
  path: z.string(),
  parent: z.any(), // FirestoreCollectionReference - circular reference
});
export type FirestoreDocumentReference<T = any> = z.infer<typeof FirestoreDocumentReferenceSchema>;

export const FirestoreCollectionReferenceSchema = z.object({
  id: z.string(),
  path: z.string(),
});
export type FirestoreCollectionReference<T = any> = z.infer<typeof FirestoreCollectionReferenceSchema>;

export const FirestoreDocumentSnapshotSchema = z.object({
  id: z.string(),
  exists: z.boolean(),
  // Note: data() and get() are methods, not included in Zod schema
});
export type FirestoreDocumentSnapshot<T = any> = z.infer<typeof FirestoreDocumentSnapshotSchema>;

export const FirestoreQuerySnapshotSchema = z.object({
  docs: z.array(FirestoreDocumentSnapshotSchema),
  empty: z.boolean(),
  size: z.number(),
});
export type FirestoreQuerySnapshot<T = any> = z.infer<typeof FirestoreQuerySnapshotSchema>;

export const FirestoreWriteResultSchema = z.object({
  writeTime: z.date(),
});
export type FirestoreWriteResult = z.infer<typeof FirestoreWriteResultSchema>;

// Storage Types
export const FirebaseStorageReferenceSchema = z.object({
  bucket: z.string(),
  fullPath: z.string(),
  name: z.string(),
});
export type FirebaseStorageReference = z.infer<typeof FirebaseStorageReferenceSchema>;

export const FirebaseUploadResultSchema = z.object({
  metadata: z.object({
    name: z.string(),
    bucket: z.string(),
    fullPath: z.string(),
    size: z.number(),
    contentType: z.string().optional(),
    timeCreated: z.string(),
    updated: z.string(),
  }),
  ref: FirebaseStorageReferenceSchema,
});
export type FirebaseUploadResult = z.infer<typeof FirebaseUploadResultSchema>;

export const FirebaseDownloadURLSchema = z.string();
export type FirebaseDownloadURL = z.infer<typeof FirebaseDownloadURLSchema>;

/// ANTHROPIC CLAUDE SDK SCHEMAS ///

/**
 * Anthropic TypeScript SDK (@anthropic-ai/sdk)
 * Docs: https://github.com/anthropics/anthropic-sdk-typescript
 *
 * SDK-based approach using client.messages.create()
 * Supports structured outputs via tool use with Zod schemas
 */

// Client Configuration
export const AnthropicClientConfigSchema = z.object({
  apiKey: z.string().optional(), // defaults to process.env['ANTHROPIC_API_KEY']
  baseURL: z.string().optional(),
  timeout: z.number().optional(),
  maxRetries: z.number().optional(),
});
export type AnthropicClientConfig = z.infer<typeof AnthropicClientConfigSchema>;

// Content Block Types
export const AnthropicContentBlockSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
    z.object({
      type: z.literal("image"),
      source: z.object({
        type: z.literal("base64"),
        media_type: z.string(),
        data: z.string(),
      }),
    }),
    z.object({
      type: z.literal("tool_use"),
      id: z.string(),
      name: z.string(),
      input: z.any(),
    }),
    z.object({
      type: z.literal("tool_result"),
      tool_use_id: z.string(),
      content: z.string(),
    }),
  ])
);
export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;

// Schema Property Types (for tool definitions)
export const AnthropicSchemaPropertySchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("string"),
      description: z.string().optional(),
      enum: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal("number"),
      description: z.string().optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
    }),
    z.object({
      type: z.literal("boolean"),
      description: z.string().optional(),
    }),
    z.object({
      type: z.literal("array"),
      description: z.string().optional(),
      items: AnthropicSchemaPropertySchema,
    }),
    z.object({
      type: z.literal("object"),
      description: z.string().optional(),
      properties: z.record(AnthropicSchemaPropertySchema),
      required: z.array(z.string()).optional(),
    }),
  ])
);
export type AnthropicSchemaProperty = z.infer<typeof AnthropicSchemaPropertySchema>;

// Tool Definition for Structured Outputs
export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.object({
    type: z.literal("object"),
    properties: z.record(AnthropicSchemaPropertySchema),
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
  }),
});
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;

// Message Creation Parameters
export const AnthropicMessageCreateParamsSchema = z.object({
  model: z.string(), // "claude-sonnet-4-5" | "claude-haiku-4-5" | string
  max_tokens: z.number(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
    })
  ),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: z
    .union([
      z.object({ type: z.literal("auto") }),
      z.object({ type: z.literal("any") }),
      z.object({ type: z.literal("tool"), name: z.string() }),
    ])
    .optional(),
  system: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  stop_sequences: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
});
export type AnthropicMessageCreateParams = z.infer<typeof AnthropicMessageCreateParamsSchema>;

// Message Response
export const AnthropicMessageSchema = z.object({
  id: z.string(),
  type: z.literal("message"),
  role: z.literal("assistant"),
  content: z.array(
    z.union([
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
      z.object({
        type: z.literal("tool_use"),
        id: z.string(),
        name: z.string(),
        input: z.any(),
      }),
    ])
  ),
  model: z.string(),
  stop_reason: z.enum(["end_turn", "max_tokens", "stop_sequence", "tool_use"]).nullable(),
  stop_sequence: z.string().optional(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;

// Streaming Types
export const AnthropicStreamEventSchema = z.union([
  z.object({
    type: z.literal("message_start"),
    message: AnthropicMessageSchema,
  }),
  z.object({
    type: z.literal("content_block_start"),
    index: z.number(),
    content_block: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  z.object({
    type: z.literal("content_block_delta"),
    index: z.number(),
    delta: z.object({
      type: z.literal("text_delta"),
      text: z.string(),
    }),
  }),
  z.object({
    type: z.literal("content_block_stop"),
    index: z.number(),
  }),
  z.object({
    type: z.literal("message_delta"),
    delta: z.object({
      stop_reason: z.string(),
    }),
    usage: z.object({
      output_tokens: z.number(),
    }),
  }),
  z.object({
    type: z.literal("message_stop"),
  }),
]);
export type AnthropicStreamEvent = z.infer<typeof AnthropicStreamEventSchema>;

// Error Types
export const AnthropicAPIErrorSchema = z.object({
  status: z.number(),
  name: z.string(),
  headers: z.record(z.string()),
  error: z
    .object({
      type: z.string(),
      message: z.string(),
    })
    .optional(),
});
export type AnthropicAPIError = z.infer<typeof AnthropicAPIErrorSchema>;

// Example: Structured Output Tool for Lecture Generation
export const LectureOutlineToolSchema = AnthropicToolSchema.extend({
  name: z.literal("generate_lecture_outline"),
  description: z.literal("Generate a structured lecture outline"),
  input_schema: z.object({
    type: z.literal("object"),
    properties: z.object({
      title: z.object({ type: z.literal("string"), description: z.literal("Lecture title") }),
      slides: z.object({
        type: z.literal("array"),
        items: z.object({
          type: z.literal("object"),
          properties: z.object({
            slide_number: z.object({ type: z.literal("number") }),
            title: z.object({ type: z.literal("string") }),
            key_points: z.object({ type: z.literal("array"), items: z.object({ type: z.literal("string") }) }),
            has_diagram: z.object({ type: z.literal("boolean") }),
          }),
          required: z.tuple([z.literal("slide_number"), z.literal("title"), z.literal("key_points")]),
        }),
      }),
      estimated_duration_minutes: z.object({ type: z.literal("number") }),
    }),
    required: z.tuple([z.literal("title"), z.literal("slides"), z.literal("estimated_duration_minutes")]),
  }),
});
export type LectureOutlineTool = z.infer<typeof LectureOutlineToolSchema>;
