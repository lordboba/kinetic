#!/usr/bin/env tsx

/**
 * Convert base64 audio URLs from test output JSON files to WAV files
 *
 * Usage:
 *   tsx convert-audio.ts <json-file-path>
 *   tsx convert-audio.ts @test-outputs/livekit-tts-*.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

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

async function convertAudioUrl(jsonPath: string): Promise<void> {
  console.log(`Processing: ${jsonPath}`);

  try {
    const content = await readFile(jsonPath, 'utf8');
    const data: TestOutputData = JSON.parse(content);

    if (!data.audioUrl) {
      console.log(`  ⚠️  No audioUrl found in ${jsonPath}`);
      return;
    }

    // Check if it's a data URL
    if (!data.audioUrl.startsWith('data:')) {
      console.log(`  ⚠️  audioUrl is not a data URL: ${data.audioUrl.substring(0, 50)}...`);
      return;
    }

    // Extract the base64 data
    // Format: data:audio/wav;base64,<base64-string>
    const matches = data.audioUrl.match(/^data:audio\/([^;]+);base64,(.+)$/);
    if (!matches) {
      console.log(`  ❌ Could not parse audio data URL`);
      return;
    }

    const [, format, base64Data] = matches;
    const audioBuffer = Buffer.from(base64Data, 'base64');

    // Generate output filename
    const baseName = path.basename(jsonPath, '.json');
    const outputPath = path.join(path.dirname(jsonPath), `${baseName}.${format}`);

    await writeFile(outputPath, audioBuffer);

    console.log(`  ✅ Saved ${audioBuffer.length} bytes to ${outputPath}`);
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
    await convertAudioUrl(file);
    console.log('');
  }

  console.log('Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
