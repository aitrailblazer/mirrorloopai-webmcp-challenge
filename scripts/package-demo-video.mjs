import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const outputDir = resolve(process.argv[2] ?? "docs/demo/output");
const videoInput = resolve(outputDir, "mirrorloop-webmcp-demo-silent.webm");
const audioInput = resolve(outputDir, "narration.aiff");
const captions = resolve(outputDir, "mirrorloop-webmcp-demo.srt");
const output = resolve(outputDir, "mirrorloop-webmcp-challenge-demo.mp4");
const recordingReceipt = JSON.parse(
  await readFile(resolve(outputDir, "recording-receipt.json"), "utf8"),
);

const videoDuration = duration(videoInput);
const audioDuration = duration(audioInput);
const trimStart = Number(recordingReceipt.trimStartSeconds ?? 0);
const trimmedVideoDuration = Math.max(0, videoDuration - trimStart);
const padding = Math.max(0, audioDuration - trimmedVideoDuration + 0.5);
const escapedCaptions = captions
  .replaceAll("\\", "\\\\")
  .replaceAll(":", "\\:")
  .replaceAll("'", "\\'");
const videoFilter = [
  "scale=1152:720:flags=lanczos",
  "pad=1440:900:144:0:color=0x050712",
  `subtitles='${escapedCaptions}':force_style='FontName=Arial,FontSize=15,PrimaryColour=&H0066D1FF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginL=35,MarginR=35,MarginV=20'`,
  `tpad=stop_mode=clone:stop_duration=${padding.toFixed(3)}`,
].join(",");
run("ffmpeg", [
  "-y", "-v", "error",
  "-ss", trimStart.toFixed(3), "-i", videoInput,
  "-i", audioInput,
  "-vf", videoFilter,
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "20",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "192k",
  "-shortest",
  "-movflags", "+faststart",
  output,
]);

const probe = JSON.parse(run("ffprobe", [
  "-v", "error",
  "-show_entries", "format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate",
  "-of", "json",
  output,
]));
const finalDuration = Number(probe.format?.duration);
const streamTypes = new Set((probe.streams ?? []).map(({ codec_type: type }) => type));
const captionEnd = lastCaptionEnd(await readFile(captions, "utf8"));
if (!Number.isFinite(finalDuration) || finalDuration >= 180) {
  throw new Error(`Final video must be under 180 seconds; observed ${finalDuration}.`);
}
if (!streamTypes.has("video") || !streamTypes.has("audio")) {
  throw new Error("Final video must contain both video and audio streams.");
}
if (Math.abs(finalDuration - audioDuration) > 0.075) {
  throw new Error(`Audio/video duration drift exceeds 75ms: ${finalDuration} vs ${audioDuration}.`);
}
if (captionEnd > audioDuration || audioDuration - captionEnd > 2) {
  throw new Error(`Caption timeline is not synchronized with narration: ${captionEnd} vs ${audioDuration}.`);
}

const receipt = {
  videoInput,
  audioInput,
  captions,
  output,
  videoInputSeconds: round(videoDuration),
  videoTrimStartSeconds: round(trimStart),
  trimmedVideoInputSeconds: round(trimmedVideoDuration),
  audioInputSeconds: round(audioDuration),
  captionEndSeconds: round(captionEnd),
  finalSeconds: round(finalDuration),
  outputBytes: Number(probe.format.size),
  sha256: createHash("sha256").update(await readFile(output)).digest("hex"),
  streams: probe.streams,
  verification: {
    underThreeMinutes: true,
    containsVideo: true,
    containsAudio: true,
    captionsFilePrepared: true,
    openCaptionsBurnedIn: true,
    captionColor: "yellow",
    captionSafeArea: "Dedicated 180px lower band outside the 1152x720 scaled page content.",
    audioVideoDriftMilliseconds: Math.round(Math.abs(finalDuration - audioDuration) * 1000),
    captionsWithinNarration: true,
  },
};
await writeFile(
  resolve(outputDir, "final-video-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
console.log(JSON.stringify(receipt, null, 2));

function duration(path) {
  return Number(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    path,
  ]).trim());
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function lastCaptionEnd(contents) {
  const matches = [...contents.matchAll(/-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g)];
  if (!matches.length) throw new Error("Caption file contains no timing cues.");
  const [, hours, minutes, seconds, milliseconds] = matches.at(-1);
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds) / 1000
  );
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}
