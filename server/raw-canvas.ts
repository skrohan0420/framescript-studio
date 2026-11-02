import { createServer } from "node:http";
import type { Page, CDPSession } from "playwright";

export class RawCanvasUnsupported extends Error {}

export async function isolateRawCanvas(session: CDPSession, urlPrefix: string) {
  // Native URL filtering avoids Fetch interception serializing entire pixel uploads.
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", {
    urlPatterns: [{ urlPattern: urlPrefix + "*", block: false }],
    urls: ["http://*", "https://*", "file://*", "ftp://*", "ws://*", "wss://*"],
  });
}

/** Binary loopback transport. Only an opaque, unscaled, undecorated 2D canvas
 * can bypass the browser compositor. Validate again after every frame seek.
 */
export async function rawCanvasTransport(width: number, height: number) {
  const bytes = width * height * 4;
  const token = crypto.randomUUID();
  let next = 0;
  const pending = new Map<
    string,
    { resolve: (buffer: Buffer) => void; reject: (error: Error) => void }
  >();
  const server = createServer((request, response) => {
    const key = request.url ?? "";
    const receiver = pending.get(key);
    if (request.method !== "POST" || !receiver) {
      response.writeHead(404).end();
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
        response.writeHead(400).end();
      } else {
        receiver.resolve(Buffer.concat(chunks, bytes));
        response.end("ok");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing raw transport address");
  const origin = `http://127.0.0.1:${address.port}`;
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
            async ({ url, width, height }) => {
              const canvas = document.querySelector("canvas");
              if (
                !canvas ||
                canvas.width !== width ||
                canvas.height !== height ||
                canvas.parentElement !== document.body ||
                innerWidth !== width ||
                innerHeight !== height
              )
                return false;
              const allowed = new Set([
                "HTML",
                "HEAD",
                "BODY",
                "META",
                "STYLE",
                "SCRIPT",
                "TITLE",
                "CANVAS",
              ]);
              for (const element of document.querySelectorAll("*")) {
                if (
                  !allowed.has(element.tagName) ||
                  element.shadowRoot ||
                  (element.tagName === "CANVAS" && element !== canvas)
                )
                  return false;
              }
              if (
                [...document.body.childNodes].some(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    node.textContent?.trim(),
                )
              )
                return false;
              for (const element of [
                document.documentElement,
                document.body,
                canvas,
              ]) {
                const style = getComputedStyle(element);
                for (const [property, expected] of Object.entries({
                  opacity: "1",
                  visibility: "visible",
                  filter: "none",
                  "backdrop-filter": "none",
                  "mix-blend-mode": "normal",
                  "clip-path": "none",
                  "mask-image": "none",
                  "-webkit-mask-box-image-source": "none",
                  "offset-path": "none",
                  content: "normal",
                  clip: "auto",
                  "box-shadow": "none",
                  "border-top-width": "0px",
                  "border-right-width": "0px",
                  "border-bottom-width": "0px",
                  "border-left-width": "0px",
                  "border-top-left-radius": "0px",
                  "border-top-right-radius": "0px",
                  "border-bottom-left-radius": "0px",
                  "border-bottom-right-radius": "0px",
                  "outline-style": "none",
                  "padding-top": "0px",
                  "padding-left": "0px",
                  "padding-right": "0px",
                  "padding-bottom": "0px",
                  perspective: "none",
                  translate: "none",
                  rotate: "none",
                  scale: "none",
                  zoom: "1",
                  "-webkit-box-reflect": "none",
                  "content-visibility": "visible",
                }))
                  if (style.getPropertyValue(property) !== expected)
                    return `${element.tagName} ${property}: ${style.getPropertyValue(property)}`;
                if (
                  style.transform !== "none" &&
                  style.transform !== "matrix(1, 0, 0, 1, 0, 0)"
                )
                  return false;
                for (const pseudo of ["::before", "::after"]) {
                  const content = getComputedStyle(element, pseudo).content;
                  if (content !== "none" && content !== "normal") return false;
                }
              }
              const rect = canvas.getBoundingClientRect();
              if (
                rect.x !== 0 ||
                rect.y !== 0 ||
                rect.width !== width ||
                rect.height !== height
              )
                return false;
              for (const element of [document.documentElement, document.body]) {
                const rootRect = element.getBoundingClientRect();
                if (
                  rootRect.x !== 0 ||
                  rootRect.y !== 0 ||
                  rootRect.width !== width ||
                  rootRect.height !== height
                )
                  return false;
              }
              const context = canvas.getContext("2d");
              if (!context) return false;
              const attributes = context.getContextAttributes();
              if (
                attributes.colorSpace !== "srgb" ||
                (attributes as { colorType?: string }).colorType !== "unorm8"
              )
                return false;
              const image = context.getImageData(0, 0, width, height);
              for (let i = 3; i < image.data.length; i += 4)
                if (image.data[i] !== 255) return false;
              const response = await fetch(url, {
                method: "POST",
                body: new Blob([image.data.buffer]),
              });
              if (!response.ok) throw Error("Raw frame transfer failed");
              return true;
            },
            { url: origin + key, width, height },
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
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

