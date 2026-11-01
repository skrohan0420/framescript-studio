import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { ZipArchive } from "archiver";
import { projectSchema, exportSchema } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { atomicWrite, saveProject, loadProject } from "./storage";
import { models, generate, type AIConfig } from "./ai";
import { ChatGPTConnection } from "./chatgpt";
import {
  storyboardSchema,
  plannerInstruction,
  verifyPlan,
} from "../shared/workflow";
import {
  googleImageModels,
  generateImage,
  elevenCatalog,
  elevenAudio,
} from "./media";

const dataDir = path.resolve(
  process.env.FRAMESCRIPT_DATA_DIR || ".framescript",
);
const projectsDir = path.join(dataDir, "projects"),
  exportsDir = path.join(dataDir, "exports");
const port = Number(process.env.PORT || 5173),
  dev = process.env.NODE_ENV !== "production";
type Client = {
  current?: string;
  ai?: AbortController;
  worker?: Worker;
  progress?: unknown;
  listeners: Set<ServerResponse>;
  key?: string;
  geminiKey?: string;
  elevenKey?: string;
  mediaAbort?: AbortController;
  chatgpt: ChatGPTConnection;
};
const clients = new Map<string, Client>();
const downloads = new Map<
  string,
  { file: string; name: string; owner: string }
>();
const json = (res: ServerResponse, value: unknown, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ result: value }));
};
const cleanName = (s: string) =>
  s.replace(/[^a-z0-9 _.-]/gi, "_").slice(0, 100) || "animation";
async function body(req: IncomingMessage) {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 100_000_000) throw Error("Request exceeds 100 MB");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function readJson(file: string, fallback: unknown) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, file), "utf8"));
  } catch {
    return fallback;
  }
}
function download(file: string, name: string, owner: string) {
  const id = randomUUID();
  downloads.set(id, { file, name, owner });
  return { name, url: "/api/download/" + id };
}
async function config(c: AIConfig, client: Client): Promise<AIConfig> {
  if (
    !c ||
    !["ollama", "openai", "chatgpt"].includes(c.provider) ||
    typeof c.model !== "string"
  )
    throw Error("Invalid provider");
  return {
    provider: c.provider,
    model: c.model,
    key:
      c.provider === "chatgpt"
        ? await client.chatgpt.accessToken()
        : c.provider === "openai"
          ? client.key || process.env.OPENAI_API_KEY
          : undefined,
  };
}
async function invoke(
  name: string,
  args: any[],
  client: Client,
  owner: string,
) {
  switch (name) {
    case "mediaStatus":
      return {
        gemini: !!(client.geminiKey || process.env.GEMINI_API_KEY),
        eleven: !!(client.elevenKey || process.env.ELEVENLABS_API_KEY),
      };
    case "mediaCredentials":
      if (
        !["gemini", "eleven"].includes(args[0]) ||
        typeof args[1] !== "string" ||
        args[1].length > 1000
      )
        throw Error("Invalid media credential");
      if (args[0] === "gemini") client.geminiKey = args[1];
      else client.elevenKey = args[1];
      return true;
    case "imageModels":
      return googleImageModels(
        client.geminiKey || process.env.GEMINI_API_KEY || "",
      );
    case "elevenCatalog":
      return elevenCatalog(
        client.elevenKey || process.env.ELEVENLABS_API_KEY || "",
      );
    case "cancelMedia":
      client.mediaAbort?.abort();
      return true;
    case "generateImage":
    case "generateAudio": {
      if (client.mediaAbort) throw Error("Another media request is running.");
      const controller = new AbortController();
      client.mediaAbort = controller;
      const timeout = setTimeout(() => controller.abort(), 180000);
      try {
        return name === "generateImage"
          ? await generateImage(
              client.geminiKey || process.env.GEMINI_API_KEY || "",
              args[0],
              controller.signal,
            )
          : await elevenAudio(
              client.elevenKey || process.env.ELEVENLABS_API_KEY || "",
              args[0],
              controller.signal,
            );
      } finally {
        clearTimeout(timeout);
        client.mediaAbort = undefined;
      }
    }
    case "chatgptStatus":
      return client.chatgpt.status();
    case "chatgptConnect":
      return client.chatgpt.begin(args[0] === true);
    case "chatgptDisconnect":
      client.ai?.abort();
      return client.chatgpt.disconnect();
    case "session":
      return true;
    case "hasKey":
      return !!(client.key || process.env.OPENAI_API_KEY);
    case "credentials":
      if (typeof args[0] !== "string" || args[0].length > 1000)
        throw Error("Invalid API key");
      client.key = args[0];
      return true;
    case "newSession":
      client.current = undefined;
      return true;
    case "settingsGet":
      return readJson("settings.json", {});
    case "settingsSet": {
      const text = JSON.stringify(args[0]);
      if (text.length > 10000) throw Error("Settings too large");
      await atomicWrite(path.join(dataDir, "settings.json"), text);
      return true;
    }
    case "autosave":
      await saveProject(path.join(dataDir, "recovery.frame"), args[0]);
      return true;
    case "recover":
      try {
        return await loadProject(path.join(dataDir, "recovery.frame"));
      } catch {
        return null;
      }
    case "recents": {
      const entries = await fs.readdir(projectsDir);
      return entries
        .filter((f) => f.endsWith(".frame"))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 30);
    }
    case "openRecent": {
      const file = args[0];
      if (
        typeof file !== "string" ||
        path.basename(file) !== file ||
        !file.endsWith(".frame")
      )
        throw Error("Invalid project");
      const p = await loadProject(path.join(projectsDir, file));
      client.current = file;
      return p;
    }
    case "save":
    case "saveAs": {
      const p = projectSchema.parse(args[0]);
      const file =
        name === "save" && client.current
          ? client.current
          : cleanName(p.name) + "-" + randomUUID() + ".frame";
      await saveProject(path.join(projectsDir, file), p);
      client.current = file;
      return download(
        path.join(projectsDir, file),
        cleanName(p.name) + ".frame",
        owner,
      );
    }
    case "deleteProject": {
      if (!client.current) throw Error("Save or open a local project first.");
      await fs.mkdir(path.join(dataDir, "trash"), { recursive: true });
      await fs.rename(
        path.join(projectsDir, client.current),
        path.join(dataDir, "trash", Date.now() + "-" + client.current),
      );
      client.current = undefined;
      return true;
    }
    case "source": {
      const p = projectSchema.parse(args[0]);
      const file = path.join(exportsDir, randomUUID() + ".html");
      await atomicWrite(file, documentFor(p, { standalone: true }));
      return download(file, cleanName(p.name) + ".html", owner);
    }
    case "models":
      return models(await config(args[0], client), AbortSignal.timeout(15000));
    case "cancelAI":
      client.ai?.abort();
      return true;
    case "plan":
    case "generate": {
      if (client.ai) throw Error("Generation already running");
      const controller = new AbortController();
      client.ai = controller;
      const timeout = setTimeout(() => controller.abort(), 180000);
      try {
        const response = await generate(
          await config(args[0], client),
          args[1],
          controller.signal,
          (progress) => {
            for (const listener of client.listeners)
              listener.write("data: " + JSON.stringify(progress) + "\n\n");
          },
          name === "plan"
            ? { instruction: plannerInstruction, schema: storyboardSchema }
            : undefined,
        );
        return name === "plan"
          ? verifyPlan(args[1].prompt, response)
          : response;
      } finally {
        clearTimeout(timeout);
        client.ai = undefined;
      }
    }
    case "cancelExport":
      client.worker?.postMessage("cancel");
      return true;
    case "export": {
      if (client.worker) throw Error("Export already running");
      const project = projectSchema.parse(args[0]),
        options = exportSchema.parse(args[1]);
      const id = randomUUID(),
        destination = path.join(exportsDir, id + "." + options.format);
      const ffmpeg = require("ffmpeg-static");
      try {
        await new Promise<void>((resolve, reject) => {
          const worker = new Worker(path.join(__dirname, "export-worker.cjs"), {
            workerData: { project, options, destination, ffmpeg },
          });
          client.worker = worker;
          let settled = false;
          worker.on("message", (data) => {
            if (data.type === "progress") {
              client.progress = data.progress;
              for (const listener of client.listeners)
                listener.write(
                  "data: " + JSON.stringify(data.progress) + "\n\n",
                );
            } else {
              settled = true;
              data.type === "complete" ? resolve() : reject(Error(data.error));
            }
          });
          worker.on("error", reject);
          worker.on("exit", (code) => {
            if (!settled) reject(Error("Render worker stopped (" + code + ")"));
          });
        });
        if (options.format === "sequence") {
          const file = destination + ".zip";
          try {
            await new Promise<void>((resolve, reject) => {
              const output = createWriteStream(file),
                archive = new ZipArchive({ zlib: { level: 1 } });
              output.on("close", resolve);
              output.on("error", reject);
              archive.on("error", reject);
              archive.pipe(output);
              archive.directory(destination, false);
              void archive.finalize();
            });
          } finally {
            await fs.rm(destination, { recursive: true, force: true });
          }
          return download(file, cleanName(project.name) + "-frames.zip", owner);
        }
        return download(
          destination,
          cleanName(project.name) + "." + options.format,
          owner,
        );
      } finally {
        client.worker = undefined;
      }
    }
    default:
      throw Error("Unknown operation");
  }
}

async function start() {
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  const vite = dev
    ? await (
        await import("vite")
      ).createServer({
        server: {
          middlewareMode: true,
          hmr: { host: "127.0.0.1", port: port + 10000 },
        },
        appType: "spa",
      })
    : null;
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!host || !["127.0.0.1:" + port, "localhost:" + port].includes(host)) {
        res.writeHead(403);
        res.end("Localhost only");
        return;
      }
      const url = new URL(req.url || "/", "http://" + host);
      if (url.pathname.startsWith("/api/")) {
        if (req.headers.origin && req.headers.origin !== "http://" + host) {
          json(res, "Cross-origin request blocked", 403);
          return;
        }
        let owner = req.headers.cookie?.match(
          /(?:^|; )framescript=([a-f0-9-]{36})/,
        )?.[1];
        if (!owner || !clients.has(owner)) {
          owner = randomUUID();
          clients.set(owner, {
            listeners: new Set(),
            chatgpt: new ChatGPTConnection(dataDir),
          });
          res.setHeader(
            "Set-Cookie",
            `framescript=${owner}; HttpOnly; SameSite=Strict; Path=/`,
          );
        }
        const client = clients.get(owner)!;
        if (url.pathname === "/api/events" && req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(": connected\n\n");
          client.listeners.add(res);
          if (client.progress)
            res.write("data: " + JSON.stringify(client.progress) + "\n\n");
          const pulse = setInterval(() => res.write(": heartbeat\n\n"), 20000);
          req.on("close", () => {
            clearInterval(pulse);
            client.listeners.delete(res);
          });
          return;
        }
        if (url.pathname.startsWith("/api/download/") && req.method === "GET") {
          const item = downloads.get(url.pathname.split("/").pop()!);
          if (!item || item.owner !== owner) {
            json(res, "Download not found", 404);
            return;
          }
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${item.name}"`,
            "Cache-Control": "no-store",
          });
          createReadStream(item.file)
            .on("error", () => res.destroy())
            .pipe(res);
          return;
        }
        if (req.method !== "POST" || req.headers["x-framescript"] !== "1") {
          json(res, "API requests require the app header", 403);
          return;
        }
        const payload = await body(req);
        if (!Array.isArray(payload.args)) throw Error("Invalid arguments");
        json(
          res,
          await invoke(
            url.pathname.slice("/api/".length),
            payload.args,
            client,
            owner,
          ),
        );
        return;
      }
      if (vite) {
        vite.middlewares(req, res);
        return;
      }
      const root = path.resolve("dist"),
        requested = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!requested.startsWith(root + path.sep) && requested !== root) {
        res.writeHead(403);
        res.end();
        return;
      }
      let file = requested;
      try {
        if (!(await fs.stat(file)).isFile())
          file = path.join(root, "index.html");
      } catch {
        file = path.join(root, "index.html");
      }
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".ttf": "font/ttf",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch (error) {
      if (!res.headersSent)
        json(
          res,
          { error: error instanceof Error ? error.message : "Request failed" },
          400,
        );
      else res.destroy();
    }
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `FrameScript Studio → http://localhost:${port}\nLocal data: ${dataDir}\nPress Ctrl+C to stop.`,
    ),
  );
  const stop = () => {
    for (const client of clients.values()) {
      client.chatgpt.close();
      client.mediaAbort?.abort();
      client.ai?.abort();
      client.worker?.postMessage("cancel");
      for (const listener of client.listeners) listener.end();
    }
    server.close();
    void vite?.close();
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
void start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
