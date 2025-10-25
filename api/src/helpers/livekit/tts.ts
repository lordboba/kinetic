import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { SynthesizeAvatarSpeechResponse } from './tts-avatar.js';
import { AvatarStyleOptionsSchema, SynthesizeAvatarSpeechResponseSchema, synthesizeAvatarSpeech } from './tts-avatar.js';

export const GenerateAvatarSpeechOptionsSchema = z.object({
  voice: z.string().optional(),
  format: z.enum(['mp3', 'wav', 'ogg']).optional(),
  language: z.string().optional(),
  avatar: AvatarStyleOptionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  endpointPath: z.string().optional(),
});

export type GenerateAvatarSpeechOptions = z.infer<typeof GenerateAvatarSpeechOptionsSchema>;

export const GenerateAvatarSpeechResultSchema = SynthesizeAvatarSpeechResponseSchema;
export type GenerateAvatarSpeechResult = SynthesizeAvatarSpeechResponse;

const DEFAULT_VOICE = process.env.LIVEKIT_DEFAULT_VOICE ?? 'alloy';

export async function generateAvatarSpeech(
  text: string,
  options: GenerateAvatarSpeechOptions = {},
): Promise<GenerateAvatarSpeechResult> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Input text must be a non-empty string');
  }

  const response = await synthesizeAvatarSpeech({
    text: normalized,
    voice: options.voice ?? DEFAULT_VOICE,
    format: options.format,
    language: options.language,
    avatar: options.avatar,
    metadata: options.metadata,
    endpointPath: options.endpointPath,
  });

  // eslint-disable-next-line no-console
  console.log('LiveKit generateAvatarSpeech received payload:', response);

  return response;
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  const inputText = process.argv.slice(2).join(' ') || `According to all known laws of aviation, there is no way a bee should be able to fly.
Its wings are too small to get its fat little body off the ground.
The bee, of course, flies anyway because bees don't care what humans think is impossible.
Yellow, black. Yellow, black. Yellow, black. Yellow, black.
Ooh, black and yellow!
Let's shake it up a little.
Barry! Breakfast is ready!
Coming!
Hang on a second.
Hello?
Barry?
Adam?
Can you believe this is happening?
I can't.
I'll pick you up.
Looking sharp.
Use the stairs, Your father paid good money for those.
Sorry. I'm excited.
Here's the graduate.
We're very proud of you, son.
A perfect report card, all B's.
Very proud.
Ma! I got a thing going here.
You got lint on your fuzz.
Ow! That's me!
Wave to us! We'll be in row 118,000.
Bye!
Barry, I told you, stop flying in the house!
Hey, Adam.
Hey, Barry.
Is that fuzz gel?
A little. Special day, graduation.
Never thought I'd make it.
Three days grade school, three days high school.
Those were awkward.
Three days college. I'm glad I took a day and hitchhiked around The Hive.
You did come back different.
Hi, Barry. Artie, growing a mustache? Looks good.
Hear about Frankie?
Yeah.
You going to the funeral?
No, I'm not going.
Everybody knows, sting someone, you die.
Don't waste it on a squirrel.
Such a hothead.
I guess he could have just gotten out of the way.
I love this incorporating an amusement park into our day.
That's why we don't need vacations.
Boy, quite a bit of pomp under the circumstances.
Well, Adam, today we are men.`;
  triggerCliRun(inputText).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to generate LiveKit speech:', error);
    process.exitCode = 1;
  });
}

async function triggerCliRun(inputText: string): Promise<void> {
  const result = await generateAvatarSpeech(inputText);
  // eslint-disable-next-line no-console
  console.log('Generated LiveKit speech:', result);
  await logOutputs(inputText, result);
}

async function logOutputs(text: string, result: GenerateAvatarSpeechResult): Promise<void> {
  const outputsDir = path.resolve(process.cwd(), '@test-outputs');
  await mkdir(outputsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `livekit-tts-${timestamp}.json`;
  const destination = path.join(outputsDir, filename);

  const payload = {
    requestedText: text,
    receivedAt: new Date().toISOString(),
    requestId: result.requestId,
    audioUrl: result.audioUrl ?? null,
    avatarUrl: result.avatarUrl ?? null,
    transcript: result.transcript ?? null,
    durationSeconds: result.durationSeconds ?? null,
    approximateLatencyMs: result.approximateLatencyMs ?? null,
  };

  await writeFile(destination, JSON.stringify(payload, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Logged LiveKit response to @test-outputs/${filename}`);
  if (result.audioUrl) {
    // eslint-disable-next-line no-console
    console.log('Audio asset URL:', result.audioUrl);
  }
  if (result.avatarUrl) {
    // eslint-disable-next-line no-console
    console.log('Avatar asset URL:', result.avatarUrl);
  }
}
