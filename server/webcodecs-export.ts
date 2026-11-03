import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { webCodecsSource } from "./webcodecs-source.generated";
import { documentFor } from "../shared/runtime";
import {
  frameTimes,
  type Project,
  type ExportOptions,
} from "../shared/project";
import { isolateRawCanvas } from "./raw-canvas";
import { mixAudio } from "./audio-export";
import { runProcess } from "./process";
import type { RenderMetrics, RenderTuning } from "./export-plan";
import type { Progress } from "./export";

// Experimental: the encoder differs from FFmpeg and cannot inherit its CRF
// quality guarantee. This path is benchmark-only until quality gates approve it.
export async function webCodecsExport(
  project: Project,
  options: ExportOptions,
  destination: string,
  ffmpeg: string,
  signal: AbortSignal,
  progress: (p: Progress) => void,
  executablePath: string | undefined,
  tuning: RenderTuning,
) {
  const started = performance.now();
  const temp = destination + ".partial-" + crypto.randomUUID() + ".mp4";
  await fs.mkdir(path.dirname(temp), { recursive: true });
  const file = await fs.open(temp, "wx");
  let browser: Browser | undefined,
    html = "",
    origin = "";
  let failure: Error | undefined;
  const token = "/" + crypto.randomUUID() + "/";
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "", origin);
      if (request.method === "GET" && url.pathname === token + "scene") {
        response
          .writeHead(200, {
            "Content-Type": "text/html",
            "Cache-Control": "no-store",
          })
          .end(html);
        return;
      }
      const position = Number(url.searchParams.get("position"));
      if (
        request.method !== "POST" ||
        url.pathname !== token + "encoded" ||
        !Number.isSafeInteger(position) ||
        position < 0 ||
        position > 16 * 1024 ** 3
      ) {
        response.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 4 * 1024 ** 2) throw Error("Encoded chunk exceeds limit");
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);
      let written = 0;
      while (written < data.length)
        written += (
          await file.write(
            data,
            written,
            data.length - written,
            position + written,
          )
        ).bytesWritten;
      response.end("ok");
    } catch (error) {
      failure = error as Error;
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  const abort = () => {
    void browser?.close();
    server.closeAllConnections();
  };
  signal.addEventListener("abort", abort, { once: true });
  const metrics: RenderMetrics = {
    path: "webcodecs",
    transport: "webcodecs",
    encoder: "webcodecs-avc",
    workers: 1,
    capture: "rgba",
    frames: 0,
    bytes: 0,
    seekMs: 0,
    captureMs: 0,
    decodeMs: 0,
    backpressureMs: 0,
    pipelineMs: 0,
    encoderDrainMs: 0,
    verificationMs: 0,
  };
  try {
    if (signal.aborted) throw Error("Export cancelled");
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Missing encoded transport address");
    origin = `http://127.0.0.1:${address.port}`;
    html = documentFor(project, {
      export: true,
      exportTransportOrigin: origin,
    });
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args:
        tuning.gpu === "angle" ? ["--use-gl=angle", "--use-angle=d3d11"] : [],
    });
    metrics.browser = browser.version();
    const session = await browser.newBrowserCDPSession();
    const info = await session.send("SystemInfo.getInfo");
    metrics.gpu = String(info.gpu.auxAttributes?.glRenderer ?? "Unknown");
    await session.detach();
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    const pageSession = await page.context().newCDPSession(page);
    await isolateRawCanvas(pageSession, origin + token);
    await page.exposeFunction("__fsExportProgress", (done: number) => {
      if (Number.isInteger(done) && done > 0)
        progress({
          stage: "Direct encoding (experimental)",
          done,
          total: frameTimes(options).length,
          destination,
        });
    });
    let sceneError = "";
    page.on("pageerror", (e) => {
      sceneError = e.message;
    });
    await page.goto(origin + token + "scene", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: webCodecsSource });
    metrics.startupMs = performance.now() - started;
    const pipeline = performance.now();
    const times = frameTimes(options);
    const result = await page.evaluate(
      (config) => (window as any).__fsEncode(config),
      {
        times,
        width: options.width,
        height: options.height,
        fps: options.fps,
        url: origin + token + "encoded",
        bitrate: Math.max(
          8_000_000,
          options.width * options.height * options.fps * 0.16,
        ),
      },
    );
    if (sceneError) throw Error(sceneError);
    if (failure) throw failure;
    metrics.pipelineMs = performance.now() - pipeline;
    metrics.frames = times.length;
    metrics.bytes = result.bytes;
    metrics.seekMs = result.drawMs;
    metrics.backpressureMs = result.encodeMs;
    await file.sync();
    await file.close();
    if (project.audio?.some((a) => !a.muted)) {
      const audioStart = performance.now();
      await mixAudio(ffmpeg, temp, project, options, signal);
      metrics.audioMs = performance.now() - audioStart;
    }
    const verify = performance.now();
    await runProcess(
      ffmpeg,
      ["-v", "error", "-i", temp, "-f", "null", "-"],
      signal,
      "Direct video verification",
      600_000,
    );
    metrics.verificationMs = performance.now() - verify;
    if (signal.aborted) throw Error("Export cancelled");
    await fs.rename(temp, destination);
    metrics.bottleneck =
      "Experimental WebCodecs drawing / encoder backpressure";
    return metrics;
  } finally {
    signal.removeEventListener("abort", abort);
    await browser?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await file.close().catch(() => {});
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
