import { chromium, type Browser } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { documentFor } from "../shared/runtime";
import { mixAudio } from "./audio-export";
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
) {
  const p = projectSchema.parse(project),
    o = exportSchema.parse(options);
  const times = o.format === "png" ? [o.time] : frameTimes(o);
  const sequence = o.format === "sequence";
  const temp =
    destination +
    ".partial-" +
    crypto.randomUUID() +
    (sequence ? "" : "." + o.format);
  let browser: Browser | undefined;
  let encoder: ReturnType<typeof spawn> | undefined;
  let logs = "";
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
    let closed: Promise<number | null> | undefined;
    if (!["png", "sequence"].includes(o.format)) {
      const args = [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-framerate",
        String(o.fps),
        "-i",
        "pipe:0",
        "-an",
      ];
      if (["mp4", "mkv"].includes(o.format))
        args.push(
          "-c:v",
          "libx264",
          "-crf",
          String(o.quality),
          "-pix_fmt",
          "yuv420p",
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
    for (let i = 0; i < times.length; i++) {
      check();
      const t = times[i];
      if (p.settings.timing === "replay") {
        await page.clock.runFor(Math.max(0, (t - previous) * 1000));
        previous = t;
      } else await page.evaluate((t) => (window as any).__fsSeek(t), t);
      if (renderError) throw Error("Animation failed: " + renderError);
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
      const png = await page.screenshot({
        type: "png",
        omitBackground: o.transparent,
        animations: "allow",
        timeout: 30000,
      });
      check();
      if (sequence)
        await fs.writeFile(
          path.join(temp, `frame-${String(i).padStart(6, "0")}.png`),
          png,
        );
      else if (o.format === "png") await fs.writeFile(temp, png);
      else {
        if (encoder!.exitCode !== null) throw Error(logs);
        if (!encoder!.stdin!.write(png)) await once(encoder!.stdin!, "drain");
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
      if (code !== 0) throw Error("FFmpeg failed: " + logs);
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
    if (!sequence && !["png", "gif"].includes(o.format))
      await new Promise<void>((resolve, reject) => {
        const verify = spawn(
          ffmpeg,
          ["-v", "error", "-i", temp, "-f", "null", "-"],
          { windowsHide: true },
        );
        let error = "";
        verify.stderr.on("data", (d) => {
          error += d;
        });
        verify.on("error", reject);
        verify.on("close", (code) =>
          code === 0 ? resolve() : reject(Error(error)),
        );
      });
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
    if (signal.aborted) throw Error("Export cancelled");
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    encoder?.kill();
    await browser?.close();
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}
