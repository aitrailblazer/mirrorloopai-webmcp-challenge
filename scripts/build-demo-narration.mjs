import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? "docs/demo/narration.txt");
const outputDir = resolve(process.argv[3] ?? "docs/demo/output");
const voice = process.env.MIRRORLOOP_DEMO_VOICE ?? "Ava (Enhanced)";
const rate = process.env.MIRRORLOOP_DEMO_RATE ?? "200";

await mkdir(outputDir, { recursive: true });
const paragraphs = (await readFile(sourcePath, "utf8"))
  .trim()
  .split(/\n\s*\n/)
  .map((value) => value.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const segments = [];
for (const [index, paragraph] of paragraphs.entries()) {
  const path = resolve(outputDir, `narration-${String(index + 1).padStart(2, "0")}.aiff`);
  run("say", ["-v", voice, "-r", rate, paragraph, "-o", path]);
  const duration = Number(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ]).trim());
  segments.push({ path, paragraph, duration });
}

const concatPath = resolve(outputDir, "narration-concat.txt");
await writeFile(
  concatPath,
  `${segments.map(({ path }) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n")}\n`,
);
const narrationPath = resolve(outputDir, "narration.aiff");
run("ffmpeg", [
  "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concatPath,
  "-c", "copy", narrationPath,
]);

let cursor = 0;
const subtitles = segments.map(({ paragraph, duration }, index) => {
  const start = cursor;
  cursor += duration;
  return `${index + 1}\n${srtTime(start)} --> ${srtTime(cursor)}\n${wrap(paragraph)}\n`;
});
const captionsPath = resolve(outputDir, "mirrorloop-webmcp-demo.srt");
await writeFile(captionsPath, `${subtitles.join("\n")}\n`);

const receipt = {
  source: sourcePath,
  voice,
  wordsPerMinute: Number(rate),
  segmentCount: segments.length,
  durationSeconds: Math.round(cursor * 1000) / 1000,
  narration: narrationPath,
  captions: captionsPath,
};
await writeFile(
  resolve(outputDir, "narration-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
console.log(JSON.stringify(receipt, null, 2));

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
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

function wrap(text, width = 72) {
  const words = text.split(" ");
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
