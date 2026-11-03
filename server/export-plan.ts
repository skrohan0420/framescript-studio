import { availableParallelism, freemem } from "node:os";
import type { ExportOptions, Project } from "../shared/project";
import { runProcess } from "./process";
export type VideoEncoder = "libx264" | "h264_qsv" | "h264_nvenc" | "h264_amf";
export type RenderTuning = {
  workers?: number;
  capture?: "standard" | "fast" | "jpeg";
  encoder?: "software";
  softwarePreset?: "medium" | "fast";
  rawCanvas?: boolean;
  rawStreaming?: boolean;
  webCodecs?: boolean;
  cacheDirectory?: string;
  cacheFrames?: boolean;
  cacheWholeExport?: boolean;
  gpu?: "auto" | "angle" | "software";
  autoTune?: boolean;
  failOnFallback?: boolean;
  onMetrics?: (metrics: RenderMetrics) => void;
};
export type RenderMetrics = {
  wallMs?: number;
  startupMs?: number;
  audioMs?: number;
  gpu?: string;
  browser?: string;
  cacheHits?: number;
  cacheMisses?: number;
  cacheMs?: number;
  cacheBypassed?: string;
  path?: "browser" | "direct-canvas" | "webcodecs" | "cached-video";
  webCodecsFallback?: string;
  captureFallback?: string;
  captureRetries?: number;
  graphicsFallback?: string;
  transport?:
    "http-blob" | "http2-stream" | "screenshot" | "file-copy" | "webcodecs";
  bottleneck?: string;
  tuningMs?: number;
  encoder: VideoEncoder | "webcodecs-avc";
  workers: number;
  capture: "png" | "jpeg" | "rgba";
  frames: number;
  bytes: number;
  seekMs: number;
  captureMs: number;
  decodeMs: number;
  backpressureMs: number;
  pipelineMs: number;
  encoderDrainMs: number;
  verificationMs: number;
};
const encoders = new Map<string, VideoEncoder>();
export function graphicsBackend(
  project: Project,
  options: ExportOptions,
  platform: NodeJS.Platform = process.platform,
): RenderTuning["gpu"] {
  return platform === "win32" &&
    (options.graphics === "hardware" ||
      ((options.graphics ?? "auto") === "auto" &&
        /\b(?:THREE|FrameScript3D)\b/.test(project.js + project.html)))
    ? "angle"
    : "auto";
}
export function captureFormat(
  options: ExportOptions,
  tuning: RenderTuning = {},
): "jpeg" | "png" {
  const requested =
    tuning.capture === "jpeg" ||
    (!tuning.capture && options.captureMode === "fast");
  return requested &&
    !options.transparent &&
    options.quality !== 0 &&
    ["mp4", "mkv", "webm"].includes(options.format)
    ? "jpeg"
    : "png";
}
const encoderKey = (ffmpeg: string, options: ExportOptions) =>
  [ffmpeg, options.width, options.height, options.fps, options.quality].join(
    ":",
  );
export function disableHardwareEncoder(ffmpeg: string, options: ExportOptions) {
  encoders.set(encoderKey(ffmpeg, options), "libx264");
}
export function renderWorkerCount(
  project: Project,
  options: ExportOptions,
  tuning: RenderTuning = {},
) {
  // Replay, remote resources and single snapshots require one sequential page.
  if (
    project.settings.timing === "replay" ||
    project.settings.network ||
    options.format === "png"
  )
    return 1;
  const cpuLimit = Math.max(1, Math.floor(availableParallelism() / 3));
  const memoryLimit = Math.max(1, Math.floor(freemem() / 1024 ** 3));
  const largeFrame = options.width * options.height >= 3840 * 2160;
  // Integrated-GPU readback contends for shared memory across pages. The 4K/60
  // Timeline 2 trials found no repeatable gain from two direct WebGL workers.
  const cap =
    largeFrame &&
    tuning.rawCanvas &&
    tuning.gpu === "angle" &&
    /\b(?:THREE|FrameScript3D)\b/.test(project.js)
      ? 1
      : largeFrame
        ? 2
        : 3;
  return Math.max(
    1,
    Math.min(
      tuning.workers ?? cap,
      tuning.workers ? 4 : cap,
      cpuLimit,
      memoryLimit,
    ),
  );
}
export function preferDirectCanvas(
  project: Project,
  options: ExportOptions,
  gpu?: RenderTuning["gpu"],
) {
  return (
    options.width * options.height >= 1920 * 1080 &&
    /<canvas\b/i.test(project.html) &&
    (!/\b(?:THREE|FrameScript3D)\b/.test(project.js) || gpu === "angle")
  );
}
export function videoEncoderArgs(
  encoder: VideoEncoder,
  quality: number,
  softwarePreset = "fast",
) {
  if (encoder === "h264_qsv")
    return [
      "-c:v",
      encoder,
      "-preset",
      "veryfast",
      "-global_quality",
      String(quality),
      "-look_ahead",
      "0",
      "-pix_fmt",
      "nv12",
    ];
  if (encoder === "h264_nvenc")
    return [
      "-c:v",
      encoder,
      "-preset",
      "p4",
      "-rc",
      "vbr",
      "-cq",
      String(quality),
      "-b:v",
      "0",
      "-pix_fmt",
      "yuv420p",
    ];
  if (encoder === "h264_amf")
    return [
      "-c:v",
      encoder,
      "-quality",
      "speed",
      "-rc",
      "cqp",
      "-qp_i",
      String(quality),
      "-qp_p",
      String(quality),
      "-pix_fmt",
      "yuv420p",
    ];
  return [
    "-c:v",
    "libx264",
    "-preset",
    softwarePreset,
    "-crf",
    String(quality),
    "-pix_fmt",
    "yuv420p",
  ];
}
export async function selectVideoEncoder(
  ffmpeg: string,
  options: ExportOptions,
  signal: AbortSignal,
  tuning: RenderTuning = {},
): Promise<VideoEncoder> {
  if (
    tuning.encoder === "software" ||
    options.quality === 0 ||
    options.acceleration === "software" ||
    !["mp4", "mkv"].includes(options.format) ||
    options.width * options.height < 1920 * 1080
  )
    return "libx264";
  const key = encoderKey(ffmpeg, options);
  if (encoders.has(key)) return encoders.get(key)!;
  for (const encoder of [
    "h264_qsv",
    "h264_nvenc",
    "h264_amf",
  ] as VideoEncoder[]) {
    if (signal.aborted) throw Error("Export cancelled");
    try {
      // A real encode at the requested dimensions proves driver/device availability.
      await runProcess(
        ffmpeg,
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `color=c=black:s=${options.width}x${options.height}:r=${options.fps}`,
          "-frames:v",
          "1",
          ...videoEncoderArgs(encoder, options.quality),
          "-f",
          "null",
          "-",
        ],
        signal,
        "Hardware encoder check",
        5000,
      );
      encoders.set(key, encoder);
      return encoder;
    } catch {
      if (signal.aborted) throw Error("Export cancelled");
    }
  }
  encoders.set(key, "libx264");
  return "libx264";
}
