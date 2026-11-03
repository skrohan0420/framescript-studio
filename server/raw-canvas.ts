import {
  createSecureServer,
  type ServerHttp2Session,
  type Http2SecureServer,
  type Http2ServerRequest,
  type Http2ServerResponse,
} from "node:http2";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http";
import { loopbackTls } from "./loopback-tls";
import type { Page, CDPSession } from "playwright";

export class RawCanvasUnsupported extends Error {}

export async function isolateRawCanvas(session: CDPSession, urlPrefix: string) {
  // Native URL filtering avoids Fetch interception serializing entire pixel uploads.
  // Raw uploads must never be mirrored into DevTools request-body buffers.
  await session.send("Network.enable", {
    maxPostDataSize: 1,
    maxTotalBufferSize: 1024 * 1024,
    maxResourceBufferSize: 64 * 1024,
  });
  await session.send("Network.setBlockedURLs", {
    urlPatterns: [{ urlPattern: urlPrefix + "*", block: false }],
    urls: ["http://*", "https://*", "file://*", "ftp://*", "ws://*", "wss://*"],
  });
}

/** Binary loopback transport. Only an opaque, unscaled, undecorated canvas
 * can bypass the browser compositor. Validate again after every frame seek.
 */
export async function rawCanvasTransport(
  width: number,
  height: number,
  options: { streaming?: boolean } = {},
) {
  const streaming = options.streaming ?? true;
  const bytes = width * height * 4;
  const token = crypto.randomUUID();
  let next = 0;
  const pending = new Map<
    string,
    { resolve: (buffer: Buffer) => void; reject: (error: Error) => void }
  >();
  const sessions = new Set<ServerHttp2Session>();
  const receive = (
    request: IncomingMessage | Http2ServerRequest,
    response: ServerResponse | Http2ServerResponse,
  ) => {
    const key = request.url ?? "";
    const receiver = pending.get(key);
    if (request.method === "OPTIONS" && receiver) {
      response.statusCode = 204;
      response.setHeader("Access-Control-Allow-Origin", "null");
      response.setHeader("Access-Control-Allow-Methods", "POST");
      response.setHeader("Access-Control-Allow-Headers", "content-type");
      response.setHeader("Access-Control-Max-Age", "86400");
      response.end();
      return;
    }
    if (request.method !== "POST" || !receiver) {
      response.statusCode = 404;
      response.end();
      return;
    }
    // A key can accept only one upload, including while it is in flight.
    const receiverKey = key + ":receiving";
    pending.delete(key);
    pending.set(receiverKey, receiver);
    response.setHeader("Access-Control-Allow-Origin", "null");
    let length = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > bytes) {
        receiver.reject(Error("Raw frame exceeds expected dimensions"));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("error", receiver.reject);
    request.on("end", () => {
      pending.delete(receiverKey);
      if (length !== bytes) {
        receiver.reject(Error("Incomplete raw frame"));
        response.statusCode = 400;
        response.end();
      } else {
        receiver.resolve(Buffer.concat(chunks, bytes));
        response.end("ok");
      }
    });
  };
  const server = streaming
    ? createSecureServer(
        {
          ...(await loopbackTls()),
          settings: {
            initialWindowSize: 32 * 1024 * 1024,
            maxFrameSize: 1024 * 1024,
          },
          maxSessionMemory: 128,
        },
        receive,
      )
    : createServer(receive);
  if (streaming)
    (server as Http2SecureServer).on("session", (session) => {
      session.setLocalWindowSize(128 * 1024 * 1024);
      sessions.add(session);
      session.on("error", () => {});
      session.once("close", () => sessions.delete(session));
    });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing raw transport address");
  const origin = `${streaming ? "https" : "http"}://127.0.0.1:${address.port}`;
  return {
    origin,
    urlPrefix: `${origin}/${token}/`,
    async capture(page: Page) {
      const key = `/${token}/${next++}`;
      const data = new Promise<Buffer>((resolve, reject) =>
        pending.set(key, { resolve, reject }),
      );
      // Attach rejection handling immediately; page evaluation can fail before transfer.
      data.catch(() => {});
      const timer = setTimeout(() => {
        (pending.get(key) ?? pending.get(key + ":receiving"))?.reject(
          Error("Raw canvas transfer timed out"),
        );
        pending.delete(key);
        pending.delete(key + ":receiving");
      }, 30000);
      try {
        const transfer = page
          .evaluate(
            async ({ url, width, height, streaming }) => {
              const canvas = (window as any).__fsDirectCanvas(width, height);
              if (!(canvas instanceof HTMLCanvasElement)) return canvas;
              const context = canvas.getContext("2d");
              let pixels: Uint8Array | Uint8ClampedArray;
              if (!context) {
                const gl =
                  canvas.getContext("webgl2") ?? canvas.getContext("webgl");
                // Non-preserved WebGL buffers can be cleared between tasks.
                if (!gl?.getContextAttributes()?.preserveDrawingBuffer)
                  return false;
                if (gl.drawingBufferColorSpace !== "srgb" || gl.isContextLost())
                  return false;
                if (
                  gl instanceof WebGL2RenderingContext &&
                  (gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) ||
                    gl.getParameter(gl.PACK_ROW_LENGTH) !== 0 ||
                    gl.getParameter(gl.PACK_SKIP_PIXELS) !== 0 ||
                    gl.getParameter(gl.PACK_SKIP_ROWS) !== 0)
                )
                  return false;
                pixels = new Uint8Array(width * height * 4);
                const target =
                  gl instanceof WebGL2RenderingContext
                    ? gl.READ_FRAMEBUFFER
                    : gl.FRAMEBUFFER;
                const binding = gl.getParameter(
                  gl instanceof WebGL2RenderingContext
                    ? gl.READ_FRAMEBUFFER_BINDING
                    : gl.FRAMEBUFFER_BINDING,
                );
                gl.bindFramebuffer(target, null);
                const alignment = gl.getParameter(gl.PACK_ALIGNMENT);
                try {
                  gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
                  if (
                    gl instanceof WebGL2RenderingContext &&
                    gl.getParameter(gl.READ_BUFFER) !== gl.BACK
                  )
                    return false;
                  gl.readPixels(
                    0,
                    0,
                    width,
                    height,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    pixels,
                  );
                } finally {
                  gl.pixelStorei(gl.PACK_ALIGNMENT, alignment);
                  gl.bindFramebuffer(target, binding);
                }
                // WebGL's origin is bottom-left; FFmpeg expects top-down rows.
                const stride = width * 4,
                  row = new Uint8Array(stride);
                for (let y = 0; y < Math.floor(height / 2); y++) {
                  const top = y * stride,
                    bottom = (height - y - 1) * stride;
                  row.set(pixels.subarray(top, top + stride));
                  pixels.copyWithin(top, bottom, bottom + stride);
                  pixels.set(row, bottom);
                }
              } else {
                const attributes = context.getContextAttributes();
                if (
                  attributes.colorSpace !== "srgb" ||
                  (attributes as { colorType?: string }).colorType !== "unorm8"
                )
                  return false;
                pixels = context.getImageData(0, 0, width, height).data;
              }
              for (let i = 3; i < pixels.length; i += 4)
                if (pixels[i] !== 255)
                  return "Translucent pixel at " + i + ": " + pixels[i];
              const response = await fetch(url, {
                method: "POST",
                // BufferSource avoids Chromium's Blob storage quota on long
                // 4K exports (one RGBA frame alone is ~33 MB).
                body: streaming
                  ? new ReadableStream({
                      start(controller) {
                        controller.enqueue(new Uint8Array(pixels.buffer));
                        controller.close();
                      },
                    })
                  : new Blob([pixels.buffer as ArrayBuffer]),
                ...(streaming ? { duplex: "half" } : {}),
              } as RequestInit);
              if (!response.ok) throw Error("Raw frame transfer failed");
              // Drain the response so Chromium can release the upload body and
              // reuse the connection during long high-resolution exports.
              await response.arrayBuffer();
              return true;
            },
            { url: origin + key, width, height, streaming },
          )
          .then((supported) => {
            if (supported !== true)
              throw new RawCanvasUnsupported(
                "Scene needs browser compositing: " + supported,
              );
          });
        const [buffer] = await Promise.all([data, transfer]);
        return buffer;
      } finally {
        clearTimeout(timer);
        pending.delete(key);
        pending.delete(key + ":receiving");
      }
    },
    async close() {
      for (const receiver of pending.values())
        receiver.reject(Error("Raw transport closed"));
      pending.clear();
      for (const session of sessions) session.destroy();
      if (!streaming) (server as Server).closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
