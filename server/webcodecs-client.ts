import {
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
} from "mediabunny";

// Bundled as classic JavaScript and injected only for the experimental export.
(window as any).__fsEncode = async (config: {
  times: number[];
  fps: number;
  width: number;
  height: number;
  url: string;
  bitrate: number;
}) => {
  const w = window as any;
  if (!w.VideoEncoder || !w.isSecureContext)
    throw Error("WebCodecs is unavailable in this render context");
  let bytes = 0,
    drawMs = 0,
    encodeMs = 0;
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "fragmented" }),
    target: new StreamTarget(
      new WritableStream({
        async write({ data, position }) {
          const response = await fetch(config.url + "?position=" + position, {
            method: "POST",
            body: data,
          });
          if (!response.ok) throw Error("Encoded frame transfer failed");
          await response.arrayBuffer();
          bytes += data.length;
        },
      }),
      { chunked: true, chunkSize: 1024 * 1024 },
    ),
  });
  // A staging canvas makes opacity verification explicit and preserves the full
  // requested resolution. No effect, antialiasing or frame is omitted.
  const staging = document.createElement("canvas");
  staging.width = config.width;
  staging.height = config.height;
  const context = staging.getContext("2d", { willReadFrequently: true })!;
  const source = new CanvasSource(staging, {
    codec: "avc",
    quality: new Quality({ bitrate: config.bitrate }),
    latencyMode: "quality",
  });
  output.addVideoTrack(source, { frameRate: config.fps });
  await output.start();
  try {
    for (let i = 0; i < config.times.length; i++) {
      const drawStart = performance.now();
      w.__fsSeek(config.times[i]);
      const canvas = w.__fsDirectCanvas(config.width, config.height);
      if (!(canvas instanceof HTMLCanvasElement))
        throw Error("Scene requires browser compositing: " + canvas);
      context.clearRect(0, 0, config.width, config.height);
      context.drawImage(canvas, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        config.width,
        config.height,
      ).data;
      for (let j = 3; j < pixels.length; j += 4)
        if (pixels[j] !== 255) throw Error("Scene contains translucent pixels");
      drawMs += performance.now() - drawStart;
      const encodeStart = performance.now();
      await source.add(i / config.fps, 1 / config.fps);
      encodeMs += performance.now() - encodeStart;
      if (i % 30 === 0 || i === config.times.length - 1)
        await w.__fsExportProgress?.(i + 1);
    }
    source.close();
    await output.finalize();
    return { bytes, drawMs, encodeMs };
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  }
};
