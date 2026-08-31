import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const scenePath = resolve(process.argv[2] ?? "docs/demo/scenes.json");
const outputDir = resolve(process.argv[3] ?? "docs/demo/output");
const voice = process.env.MIRRORLOOP_DEMO_VOICE ?? "Ava (Premium)";
const rate = process.env.MIRRORLOOP_DEMO_RATE ?? "175";

await mkdir(outputDir, { recursive: true });
const scenes = JSON.parse(await readFile(scenePath, "utf8"));
if (!Array.isArray(scenes) || scenes.length === 0) {
  throw new Error("Demo scenes must be a non-empty JSON array.");
}

const rendered = [];
let cursor = 0;
for (const [index, scene] of scenes.entries()) {
  validateScene(scene, index);
  const stem = `narration-${String(index + 1).padStart(2, "0")}`;
  const rawPath = resolve(outputDir, `${stem}-speech.aiff`);
  const path = resolve(outputDir, `${stem}.wav`);
  run("say", ["-v", voice, "-r", rate, scene.speech, "-o", rawPath]);
  const speechDuration = duration(rawPath);
  const leadSeconds = Number(scene.lead_ms ?? 0) / 1000;
  const pauseSeconds = Number(scene.pause_after_ms ?? 650) / 1000;
  const sceneDuration = leadSeconds + speechDuration + pauseSeconds;
  const filters = [];
  if (leadSeconds > 0) {
    filters.push(`adelay=${Math.round(leadSeconds * 1000)}:all=1`);
  }
  filters.push(`apad=pad_dur=${pauseSeconds.toFixed(3)}`);
  run("ffmpeg", [
    "-y", "-v", "error", "-i", rawPath,
    "-af", filters.join(","),
    "-t", sceneDuration.toFixed(3),
    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
    path,
  ]);

  const start = cursor;
  const speechStart = start + leadSeconds;
  const speechEnd = speechStart + speechDuration;
  cursor += duration(path);
  rendered.push({
    ...scene,
    path,
    start_seconds: round(start),
    speech_start_seconds: round(speechStart),
    speech_end_seconds: round(speechEnd),
    end_seconds: round(cursor),
    duration_seconds: round(cursor - start),
  });
}

const concatPath = resolve(outputDir, "narration-concat.txt");
await writeFile(
  concatPath,
  `${rendered.map(({ path }) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n")}\n`,
);
const rawNarrationPath = resolve(outputDir, "narration-raw.wav");
run("ffmpeg", [
  "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concatPath,
  "-c", "copy", rawNarrationPath,
]);
const narrationPath = resolve(outputDir, "narration.aiff");
run("ffmpeg", [
  "-y", "-v", "error", "-i", rawNarrationPath,
  "-af", "loudnorm=I=-16:LRA=7:TP=-1.5,afade=t=in:st=0:d=0.25",
  "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16be",
  narrationPath,
]);

const cues = [];
for (const scene of rendered) {
  const chunks = scene.caption_chunks ?? splitCaption(scene.caption);
  const weights = chunks.map((chunk) => Math.max(1, chunk.split(/\s+/).length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cueStart = scene.speech_start_seconds;
  for (const [index, chunk] of chunks.entries()) {
    const isLast = index === chunks.length - 1;
    const cueEnd = isLast
      ? scene.speech_end_seconds
      : cueStart + (
        (scene.speech_end_seconds - scene.speech_start_seconds) *
        weights[index] / totalWeight
      );
    cues.push({ start: cueStart, end: cueEnd, text: chunk });
    cueStart = cueEnd;
  }
}
const captionsPath = resolve(outputDir, "mirrorloop-webmcp-demo.srt");
await writeFile(
  captionsPath,
  `${cues.map(({ start, end, text }, index) => (
    `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${wrap(text)}\n`
  )).join("\n")}\n`,
);

const receipt = {
  source: scenePath,
  voice,
  wordsPerMinute: Number(rate),
  segmentCount: rendered.length,
  captionCueCount: cues.length,
  durationSeconds: round(duration(narrationPath)),
  narration: narrationPath,
  captions: captionsPath,
  scenes: rendered.map(({ path, speech, ...scene }) => scene),
};
await writeFile(
  resolve(outputDir, "narration-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
console.log(JSON.stringify(receipt, null, 2));

function validateScene(scene, index) {
  for (const key of ["id", "title", "detail", "caption", "speech"]) {
    if (typeof scene[key] !== "string" || !scene[key].trim()) {
      throw new Error(`Scene ${index + 1} requires a non-empty ${key}.`);
    }
  }
}

function duration(path) {
  return Number(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ]).trim());
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function splitCaption(text, target = 72) {
  const words = text.split(/\s+/);
  const totalCharacters = words.reduce((sum, word) => sum + word.length, 0) + words.length - 1;
  const chunkCount = Math.max(1, Math.ceil(totalCharacters / target));
  const chunks = [];
  let cursor = 0;
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const wordsRemaining = words.length - cursor;
    const chunksRemaining = chunkCount - chunkIndex;
    const targetWords = Math.max(1, Math.ceil(wordsRemaining / chunksRemaining));
    const chunk = words.slice(cursor, cursor + targetWords).join(" ");
    chunks.push(chunk);
    cursor += targetWords;
  }
  return chunks;
}

function srtTime(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${String(millis).padStart(3, "0")}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function wrap(text, width = 42) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
