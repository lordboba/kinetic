/// LIVEKIT EXTERNAL SCHEMAS ///

/**
 * LiveKit uses an Agents framework, not traditional REST APIs.
 * These types represent the configuration and data structures used
 * in LiveKit's Python/Node.js SDK for building voice AI agents.
 */

// Text-to-Speech (TTS) Configuration
type LiveKitTTSConfig = {
    // Format: "provider/model:voice_id"
    // Example: "cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
    model_descriptor?: string;
    provider?: "cartesia" | "elevenlabs" | "rime" | "inworld" | "openai" | "google";
    model?: string;
    voice_id?: string; // UUID or provider-specific voice identifier
};

// TTS Stream Output (from SynthesizedAudio events)
type LiveKitSynthesizedAudio = {
    audio_data: ArrayBuffer | Uint8Array; // Raw audio bytes
    sample_rate?: number;
    channels?: number;
    duration_ms?: number;
};

// Speech-to-Text (STT) Configuration
type LiveKitSTTConfig = {
    // Format: "provider/model:language"
    // Example: "deepgram/nova-3:en" or "assemblyai/universal-streaming:multi"
    model_descriptor?: string;
    provider?: "deepgram" | "assemblyai" | "google" | "speechmatics";
    model?: string;
    language?: string; // ISO language code: "en", "es", "multi", etc.
};

// STT Stream Event Types
type LiveKitSpeechEventType =
    | "FINAL_TRANSCRIPT"
    | "INTERIM_TRANSCRIPT"
    | "START_OF_SPEECH"
    | "END_OF_SPEECH";

type LiveKitSpeechEvent = {
    type: LiveKitSpeechEventType;
    alternatives: Array<{
        text: string;
        confidence?: number;
        words?: Array<{
            word: string;
            start_time_ms: number;
            end_time_ms: number;
            confidence: number;
        }>;
    }>;
};

// Avatar Session Configuration
type LiveKitAvatarConfig = {
    avatar_id: string; // Provider-specific avatar identifier
    provider: "tavus" | "hedra" | "bithuman" | "bey" | "anam" | "simli";

    // Hedra-specific: requires source image
    source_image_url?: string;

    // Video output settings
    video_width?: number;
    video_height?: number; // Hedra renders at 512x512
    video_fps?: number;

    // Audio settings
    audio_sample_rate?: number;
    audio_channels?: number;
};

// Agent Session Configuration (combines TTS, STT, and Avatar)
type LiveKitAgentSessionConfig = {
    tts: string | LiveKitTTSConfig; // Model descriptor or config object
    stt: string | LiveKitSTTConfig; // Model descriptor or config object
    llm?: string; // LLM model descriptor (e.g., "openai/gpt-4")
    avatar?: LiveKitAvatarConfig;
};

/// FIREBASE SDK SCHEMAS ///

/**
 * Firebase modular SDK (v9+) for TypeScript
 * Package: firebase@^12.0.0
 * Docs: https://firebase.google.com/docs/reference/js
 */

// Firebase App Initialization
type FirebaseConfig = {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
};

// Firebase Auth Types
type FirebaseUser = {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    metadata: {
        creationTime?: string;
        lastSignInTime?: string;
    };
};

type FirebaseUserCredential = {
    user: FirebaseUser;
    providerId: string | null;
    operationType: string;
};

type FirebaseAuthError = {
    code: string;
    message: string;
    name: string;
};

// Firestore Types
type FirestoreDocumentReference<T = any> = {
    id: string;
    path: string;
    parent: FirestoreCollectionReference<T>;
};

type FirestoreCollectionReference<T = any> = {
    id: string;
    path: string;
};

type FirestoreDocumentSnapshot<T = any> = {
    id: string;
    exists: boolean;
    data(): T | undefined;
    get(fieldPath: string): any;
};

type FirestoreQuerySnapshot<T = any> = {
    docs: FirestoreDocumentSnapshot<T>[];
    empty: boolean;
    size: number;
};

type FirestoreWriteResult = {
    writeTime: Date;
};

// Storage Types
type FirebaseStorageReference = {
    bucket: string;
    fullPath: string;
    name: string;
};

type FirebaseUploadResult = {
    metadata: {
        name: string;
        bucket: string;
        fullPath: string;
        size: number;
        contentType?: string;
        timeCreated: string;
        updated: string;
    };
    ref: FirebaseStorageReference;
};

type FirebaseDownloadURL = string;

/// ANTHROPIC CLAUDE SDK SCHEMAS ///

/**
 * Anthropic TypeScript SDK (@anthropic-ai/sdk)
 * Docs: https://github.com/anthropics/anthropic-sdk-typescript
 *
 * SDK-based approach using client.messages.create()
 * Supports structured outputs via tool use with Zod schemas
 */

// Client Configuration
type AnthropicClientConfig = {
    apiKey?: string; // defaults to process.env['ANTHROPIC_API_KEY']
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
};

// Message Creation Parameters
type AnthropicMessageCreateParams = {
    model: "claude-sonnet-4-5" | "claude-haiku-4-5" | string;
    max_tokens: number;
    messages: Array<{
        role: "user" | "assistant";
        content: string | Array<AnthropicContentBlock>;
    }>;
    tools?: AnthropicTool[];
    tool_choice?: { type: "auto" } | { type: "any" } | { type: "tool"; name: string };
    system?: string;
    temperature?: number;
    top_p?: number;
    stop_sequences?: string[];
    stream?: boolean;
};

type AnthropicContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "tool_use"; id: string; name: string; input: any }
    | { type: "tool_result"; tool_use_id: string; content: string };

// Tool Definition for Structured Outputs
type AnthropicTool = {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, AnthropicSchemaProperty>;
        required?: string[];
        additionalProperties?: boolean;
    };
};

type AnthropicSchemaProperty =
    | { type: "string"; description?: string; enum?: string[] }
    | { type: "number"; description?: string; minimum?: number; maximum?: number }
    | { type: "boolean"; description?: string }
    | { type: "array"; description?: string; items: AnthropicSchemaProperty }
    | {
        type: "object";
        description?: string;
        properties: Record<string, AnthropicSchemaProperty>;
        required?: string[];
      };

// Message Response
type AnthropicMessage = {
    id: string;
    type: "message";
    role: "assistant";
    content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: any }
    >;
    model: string;
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
    stop_sequence?: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
};

// Streaming Types
type AnthropicStreamEvent =
    | { type: "message_start"; message: AnthropicMessage }
    | { type: "content_block_start"; index: number; content_block: { type: "text"; text: string } }
    | { type: "content_block_delta"; index: number; delta: { type: "text_delta"; text: string } }
    | { type: "content_block_stop"; index: number }
    | { type: "message_delta"; delta: { stop_reason: string }; usage: { output_tokens: number } }
    | { type: "message_stop" };

// Error Types
type AnthropicAPIError = {
    status: number;
    name: string;
    headers: Record<string, string>;
    error?: {
        type: string;
        message: string;
    };
};

// Example: Structured Output Tool for Lecture Generation
type LectureOutlineTool = AnthropicTool & {
    name: "generate_lecture_outline";
    description: "Generate a structured lecture outline";
    input_schema: {
        type: "object";
        properties: {
            title: { type: "string"; description: "Lecture title" };
            slides: {
                type: "array";
                items: {
                    type: "object";
                    properties: {
                        slide_number: { type: "number" };
                        title: { type: "string" };
                        key_points: { type: "array"; items: { type: "string" } };
                        has_diagram: { type: "boolean" };
                    };
                    required: ["slide_number", "title", "key_points"];
                };
            };
            estimated_duration_minutes: { type: "number" };
        };
        required: ["title", "slides", "estimated_duration_minutes"];
    };
};
