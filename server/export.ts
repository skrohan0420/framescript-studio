import { chromium, type Browser } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { documentFor } from "../shared/runtime";
import { mixAudio } from "./audio-export";
import { runProcess } from "./process";
import {
  renderWorkerCount,
  selectVideoEncoder,
  disableHardwareEncoder,
  videoEncoderArgs,
  type VideoEncoder,
  type RenderTuning,
} from "./export-plan";
import {
  exportSchema,
  frameTimes,
  projectSchema,
  type Project,
  type ExportOptions,
} from "../shared/project";
export type Progress = {
  stage: string;
  done: number;
  total: number;
  destination: string;
};
export async function renderExport(
  project: Project,
  options: ExportOptions,
  destination: string,
  ffmpeg: string,
  signal: AbortSignal,
  progress: (p: Progress) => void,
  executablePath?: string,
  tuning: RenderTuning = {},
) {
  const optionsParsed = exportSchema.parse(options);
  if (["mp4", "mkv"].includes(optionsParsed.format) && optionsParsed.width * optionsParsed.height >= 1920 * 1080 && optionsParsed.acceleration !== "software" && tuning.encoder !== "software") progress({ stage: "Checking hardware acceleration", done: 0, total: frameTimes(optionsParsed).length, destination });
  const selectedEncoder = await selectVideoEncoder(
    ffmpeg,
    optionsParsed,
    signal,
    tuning,
  );
  try {
    return await renderExportAttempt(
      project,
      optionsParsed,
      destination,
      ffmpeg,
      signal,
      progress,
      executablePath,
      tuning,
      selectedEncoder,
    );
  } catch (error) {
    if (
      !(error instanceof EncoderFailure) ||
      selectedEncoder === "libx264" ||
      signal.aborted
    )
      throw error;
    disableHardwareEncoder(ffmpeg, optionsParsed);
    progress({
      stage: "Retrying with software encoding",
      done: 0,
      total: frameTimes(optionsParsed).length,
      destination,
    });
    return renderExportAttempt(
      project,
      optionsParsed,
      destination,
      ffmpeg,
      signal,
      progress,
      executablePath,
      tuning,
      "libx264",
    );
  }
}
class EncoderFailure extends Error {}
async function renderExportAttempt(
  project: Project,
  options: ExportOptions,
  destination: string,
  ffmpeg: string,
  signal: AbortSignal,
  progress: (p: Progress) => void,
  executablePath: string | undefined,
  tuning: RenderTuning,
  videoEncoder: VideoEncoder,
) {
  const requestedSignal = signal;
  signal = AbortSignal.any([signal, AbortSignal.timeout(7_200_000)]);
  const p = projectSchema.parse(project),
    o = exportSchema.parse(options);
  const times = o.format === "png" ? [o.time] : frameTimes(o);
  const sequence = o.format === "sequence";
  const jpeg = tuning.capture === "jpeg" && !o.transparent && ["mp4", "mkv", "webm"].includes(o.format);
  const temp =
    destination +
    ".partial-" +
    crypto.randomUUID() +
    (sequence ? "" : "." + o.format);
  let browser: Browser | undefined;
  let encoder: ReturnType<typeof spawn> | undefined;
  let logs = "";
  let closed: Promise<number | null> | undefined;
  const check = () => {
    if (signal.aborted) throw Error("Export cancelled");
  };
  const abort = () => {
    encoder?.kill();
    void browser?.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    check();
    if (sequence) await fs.mkdir(temp);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: executablePath ? ["--headless"] : [],
    });
    const context = await browser.newContext({
      viewport: { width: o.width, height: o.height },
      deviceScaleFactor: 1,
      acceptDownloads: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      const u = route.request().url();
      return u.startsWith("data:") ||
        u.startsWith("about:") ||
        (p.settings.network && /^https?:/.test(u))
        ? route.continue()
        : route.abort();
    });
    const workers = Math.min(times.length, renderWorkerCount(p, o, tuning));
    progress({
      stage:
        videoEncoder === "libx264"
          ? "Preparing export"
          : "Preparing hardware-accelerated export",
      done: 0,
      total: times.length,
      destination,
    });
    const preparePage = async () => {
      const page = await context.newPage();
      let renderError = "";
      page.on("pageerror", (e) => {
        renderError = e.message;
      });
      if (p.settings.timing === "replay") await page.clock.install({ time: 0 });
      await page.setContent(
        documentFor(p, { export: true, transparent: o.transparent }),
        { waitUntil: "load" },
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((i) => i.decode().catch(() => {})),
        );
      });
      const scaleX = o.width / p.settings.width,
        scaleY = o.height / p.settings.height;
      const sx =
          o.fit === "stretch"
            ? scaleX
            : o.fit === "fill"
              ? Math.max(scaleX, scaleY)
              : Math.min(scaleX, scaleY),
        sy = o.fit === "stretch" ? scaleY : sx;
      await page.evaluate(
        ({ width, height, sx, sy, ow, oh }) => {
          const body = document.body;
          Object.assign(body.style, {
            width: width + "px",
            height: height + "px",
            transformOrigin: "0 0",
            transform: `translate(${(ow - width * sx) / 2}px,${(oh - height * sy) / 2}px) scale(${sx},${sy})`,
          });
        },
        {
          width: p.settings.width,
          height: p.settings.height,
          sx,
          sy,
          ow: o.width,
          oh: o.height,
        },
      );
      const session = await context.newCDPSession(page);
      if (o.transparent)
        await session.send("Emulation.setDefaultBackgroundColorOverride", {
          color: { r: 0, g: 0, b: 0, a: 0 },
        });
      return { page, session, error: () => renderError };
    };
    const renderers = await Promise.all(
      Array.from({ length: workers }, preparePage),
    );
    if (!["png", "sequence"].includes(o.format)) {
      const args = [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        jpeg ? "mjpeg" : "png",
        "-framerate",
        String(o.fps),
        "-i",
        "pipe:0",
        "-an",
      ];
      if (["mp4", "mkv"].includes(o.format))
        args.push(
          ...videoEncoderArgs(
            videoEncoder,
            o.quality,
            tuning.softwarePreset ?? "fast",
          ),
        );
      if (o.format === "mp4") args.push("-movflags", "+faststart");
      if (o.format === "webm")
        args.push(
          "-c:v",
          "libvpx-vp9",
          "-crf",
          String(o.quality),
          "-b:v",
          "0",
          "-pix_fmt",
          o.transparent ? "yuva420p" : "yuv420p",
          ...(o.transparent ? ["-auto-alt-ref", "0"] : []),
        );
      if (o.format === "gif")
        args.push(
          "-filter_complex",
          "[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse",
        );
      args.push(temp);
      encoder = spawn(ffmpeg, args, {
        windowsHide: true,
        stdio: ["pipe", "ignore", "pipe"],
      });
      closed = new Promise((resolve, reject) => {
        encoder!.once("error", reject);
        encoder!.once("close", resolve);
      });
      closed.catch(() => {});
      encoder.stdin!.on("error", () => {});
      encoder.stderr!.on("data", (d) => {
        logs = (logs + d).slice(-12000);
      });
    }
    let previous = 0;
    const capture = async (
      renderer: (typeof renderers)[number],
      index: number,
    ) => {
      check();
      const { page, session } = renderer;
      const t = times[index];
      if (p.settings.timing === "replay") {
        await page.clock.runFor(Math.max(0, (t - previous) * 1000));
        previous = t;
      } else await page.evaluate((t) => (window as any).__fsSeek(t), t);
      if (renderer.error())
        throw Error("Animation failed: " + renderer.error());
      for (const child of page.frames().slice(1)) {
        const element = await child.frameElement();
        const info = await element.evaluate((el) => ({
          visible: getComputedStyle(el as Element).visibility !== "hidden",
          start: (el as HTMLElement).dataset.start,
        }));
        if (info.visible && info.start !== undefined)
          await child.evaluate(
            (time) => (window as any).__fsSeek?.(time),
            Math.max(0, t - Number(info.start)),
          );
      }
      if (tuning.capture === "standard")
        return page.screenshot({
          type: "png",
          omitBackground: o.transparent,
          animations: "allow",
          timeout: 30000,
        });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          session.send("Page.captureScreenshot", {
            format: jpeg ? "jpeg" : "png",
            ...(jpeg ? { quality: 100 } : {}),
            fromSurface: true,
            captureBeyondViewport: false,
            optimizeForSpeed: true,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Frame capture timed out")),
              30000,
            );
          }),
        ]);
        if (renderer.error())
          throw Error("Animation failed: " + renderer.error());
        return Buffer.from(result.data, "base64");
      } finally {
        clearTimeout(timer);
      }
    };
    // At most one in-flight capture per page; drain to FFmpeg strictly in frame order.
    // Settled records prevent later workers from causing unhandled rejections on cancellation.
    const schedule = (index: number) =>
      capture(renderers[index % workers], index).then(
        (data) => ({ data, error: undefined }),
        (error: unknown) => ({ data: undefined, error }),
      );
    const pending = Array.from({ length: workers }, (_, index) =>
      schedule(index),
    );
    for (let i = 0; i < times.length; i++) {
      const result = await pending[i % workers];
      if (result.error !== undefined) throw result.error;
      const png = result.data!;
      check();
      if (i + workers < times.length)
        pending[i % workers] = schedule(i + workers);
      if (sequence)
        await fs.writeFile(
          path.join(temp, `frame-${String(i).padStart(6, "0")}.png`),
          png,
        );
      else if (o.format === "png") await fs.writeFile(temp, png);
      else {
        if (encoder!.exitCode !== null || encoder!.stdin!.destroyed)
          throw new EncoderFailure("FFmpeg stopped: " + logs);
        let accepted: boolean;
        try {
          accepted = encoder!.stdin!.write(png);
        } catch {
          throw new EncoderFailure("FFmpeg input failed: " + logs);
        }
        if (!accepted) {
          const drain = new AbortController();
          try {
            await Promise.race([
              once(encoder!.stdin!, "drain", {
                signal: AbortSignal.any([signal, drain.signal]),
              }),
              closed!.then(() => {
                throw new EncoderFailure(
                  "Encoder stopped before accepting the frame: " + logs,
                );
              }),
            ]);
          } catch (error) {
            if (signal.aborted) throw error;
            throw new EncoderFailure("Encoder stopped while writing a frame: " + logs);
          } finally {
            drain.abort();
          }
        }
      }
      progress({
        stage: "Rendering",
        done: i + 1,
        total: times.length,
        destination,
      });
    }
    if (encoder) {
      progress({
        stage: "Encoding",
        done: times.length,
        total: times.length,
        destination,
      });
      encoder.stdin!.end();
      const code = await closed;
      if (code !== 0) throw new EncoderFailure("FFmpeg failed: " + logs);
    }
    check();
    if (
      ["mp4", "mkv", "webm"].includes(o.format) &&
      p.audio?.some((a) => !a.muted)
    ) {
      progress({
        stage: "Mixing audio",
        done: times.length,
        total: times.length,
        destination,
      });
      await mixAudio(ffmpeg, temp, p, o, signal);
      check();
    }
    if (!sequence && (await fs.stat(temp)).size < 32)
      throw Error("Encoder produced an empty file");
    if (!sequence && !["png", "gif"].includes(o.format)) {
      progress({
        stage: "Verifying video",
        done: times.length,
        total: times.length,
        destination,
      });
      await runProcess(
        ffmpeg,
        ["-v", "error", "-i", temp, "-f", "null", "-"],
        signal,
        "Video verification",
        600_000,
      );
    }
    check();
    await fs.rename(temp, destination);
    progress({
      stage: "Complete",
      done: times.length,
      total: times.length,
      destination,
    });
    return destination;
  } catch (error) {
    if (signal.aborted)
      throw Error(
        requestedSignal.aborted
          ? "Export cancelled"
          : "Export exceeded its two-hour time limit",
      );
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    encoder?.kill();
    // Wait for the pipe/encoder to release the partial output on Windows.
    await closed?.catch(() => {});
    await browser?.close();
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}
