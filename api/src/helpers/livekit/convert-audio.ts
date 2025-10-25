#!/usr/bin/env tsx

/**
 * Convert base64 audio URLs from test output JSON files to WAV files
 *
 * Usage:
 *   tsx convert-audio.ts <json-file-path>
 *   tsx convert-audio.ts @test-outputs/livekit-tts-*.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

import type { SynthesizeAvatarSpeechResponse } from './tts-avatar.js';

interface TestOutputData {
  requestedText?: string;
  receivedAt?: string;
  requestId?: string;
  audioUrl?: string | null;
  avatarUrl?: string | null;
  transcript?: string | null;
  durationSeconds?: number | null;
  approximateLatencyMs?: number | null;
}

const AUDIO_DATA_URL_REGEX = /^data:audio\/([^;]+);base64,(.+)$/;
const DEFAULT_OUTPUT_DIR = '@test-outputs';

export interface ConvertAvatarSpeechResponseOptions {
  /**
   * Optional directory to write the WAV file to. Defaults to `@test-outputs` in the current working directory.
   */
  outputDir?: string;
  /**
   * Optional filename (without extension). Falls back to requestId or a timestamp.
   */
  fileBaseName?: string;
}

export interface ConvertAvatarSpeechResponseResult {
  buffer: Buffer;
  bytes: number;
  outputPath?: string;
  durationSeconds?: number;
  approximateLatencyMs?: number;
}

export function convertAvatarSpeechResponseToWav(
  response: SynthesizeAvatarSpeechResponse,
): ConvertAvatarSpeechResponseResult {
  if (!response.audioUrl) {
    throw new Error('Avatar speech response is missing an audioUrl field');
  }

  const matches = response.audioUrl.match(AUDIO_DATA_URL_REGEX);
  if (!matches) {
    throw new Error('Avatar speech audioUrl is not a base64 data URL');
  }

  const [, format, base64Data] = matches;

  if (format !== 'wav') {
    throw new Error(`Expected a WAV audio payload but received "${format}"`);
  }

  const buffer = Buffer.from(base64Data, 'base64');

  return {
    buffer,
    bytes: buffer.length,
    durationSeconds: response.durationSeconds,
    approximateLatencyMs: response.approximateLatencyMs,
  };
}

export async function saveAvatarSpeechResponseAsWav(
  response: SynthesizeAvatarSpeechResponse,
  options: ConvertAvatarSpeechResponseOptions = {},
): Promise<ConvertAvatarSpeechResponseResult> {
  const wavResult = convertAvatarSpeechResponseToWav(response);

  const outputDir = path.resolve(process.cwd(), options.outputDir ?? DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const baseName =
    options.fileBaseName ??
    response.requestId?.replace(/[^\w.-]/g, '_') ??
    `livekit-tts-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const outputPath = path.join(outputDir, `${baseName}.wav`);

  await writeFile(outputPath, wavResult.buffer);

  return {
    ...wavResult,
    outputPath,
  };
}

async function convertTestOutputFile(jsonPath: string): Promise<void> {
  console.log(`Processing: ${jsonPath}`);

  try {
    const content = await readFile(jsonPath, 'utf8');
    const data: TestOutputData = JSON.parse(content);

    if (!data.audioUrl) {
      console.log(`  ⚠️  No audioUrl found in ${jsonPath}`);
      return;
    }

    const result = await saveAvatarSpeechResponseAsWav(
      {
        audioUrl: data.audioUrl ?? undefined,
        requestId: data.requestId ?? undefined,
        durationSeconds: data.durationSeconds ?? undefined,
        approximateLatencyMs: data.approximateLatencyMs ?? undefined,
        avatarUrl: data.avatarUrl ?? undefined,
        transcript: data.transcript ?? undefined,
      },
      {
        outputDir: path.dirname(jsonPath),
        fileBaseName: path.basename(jsonPath, '.json'),
      },
    );

    if (!result.outputPath) {
      console.log('  ❌ Could not determine output path');
      return;
    }

    console.log(`  ✅ Saved ${result.bytes} bytes to ${result.outputPath}`);
    console.log(`  📊 Duration: ${data.durationSeconds ?? 'unknown'}s`);
    console.log(`  🎤 Request ID: ${data.requestId ?? 'unknown'}`);
    if (data.transcript) {
      console.log(`  📝 Transcript: ${data.transcript}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error processing ${jsonPath}:`, errorMessage);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: tsx convert-audio.ts <json-file-path> [...]');
    console.error('');
    console.error('Examples:');
    console.error('  tsx convert-audio.ts @test-outputs/livekit-tts-2025-10-25T18-00-52-894Z.json');
    console.error('  tsx convert-audio.ts @test-outputs/*.json');
    console.error('  tsx convert-audio.ts @test-outputs/livekit-tts-*.json');
    process.exit(1);
  }

  // Expand glob patterns
  const files: string[] = [];
  for (const pattern of args) {
    if (pattern.includes('*')) {
      const matches = await glob(pattern);
      files.push(...matches);
    } else {
      files.push(pattern);
    }
  }

  if (files.length === 0) {
    console.error('No files found matching the patterns');
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s) to process\n`);

  for (const file of files) {
    await convertTestOutputFile(file);
    console.log('');
  }

  console.log('Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
