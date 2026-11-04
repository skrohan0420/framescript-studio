import { WindowsCredentialStore } from "./credentials";
import { rpcSchemas, type RpcName, type RpcResults } from "../shared/rpc";
import { StudioDatabase } from "./database";
import {
  clearTerminal,
  runTerminal,
  stopTerminal,
  stopTerminals,
  terminalState,
} from "./terminal";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { ExportQueue } from "./export-queue";
import { ExportRetention } from "./export-retention";
import { archiveSequence } from "./archive";
import { writeStructuredEditPackage } from "./structured-edit-package";
import { projectSchema, exportSchema } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { atomicWrite, saveProject, loadProject } from "./storage";
import { models, generate, type AIConfig } from "./ai";
import { ChatGPTConnection } from "./chatgpt";
import { checkService, serviceIdSchema } from "./services";
import {
  serviceIds,
  type ServiceId,
  type ServiceCheck,
} from "../shared/services";
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
  transcribeAudio,
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
  vault?: WindowsCredentialStore;
  credentialError?: string;
  remembered?: Record<string, boolean>;
  ai?: AbortController;
  exports?: Map<
    string,
    { controller: AbortController; worker?: Worker; progress?: unknown }
  >;
  cancelledExports?: Map<string, number>;
  listeners: Set<ServerResponse>;
  key?: string;
  geminiKey?: string;
  elevenKey?: string;
  mediaAbort?: AbortController;
  chatgpt: ChatGPTConnection;
  serviceChecks?: Partial<Record<ServiceId, ServiceCheck>>;
};
let database: StudioDatabase;
const exportQueue = new ExportQueue(2);
const exportRetention = new ExportRetention(exportsDir);
let cleanupQueue: Promise<unknown> = Promise.resolve();
function inspectExports(clear = false) {
  const task = cleanupQueue.then(async () => {
    const { removed, ...summary } = await exportRetention.inspect(clear);
    for (const [id, item] of downloads)
      if (removed.has(item.file)) downloads.delete(id);
    return summary;
  });
  cleanupQueue = task.catch(() => {});
  return task;
}
let workspaceVersion = randomUUID();
let workspaceQueue: Promise<unknown> = Promise.resolve();
const workspaceWrites = new Set([
  "projectSave",
  "projectRename",
  "projectDuplicate",
  "projectTrash",
  "projectRestore",
  "projectDeleteForever",
  "autosave",
  "newSession",
  "openRecent",
  "save",
  "saveAs",
  "deleteProject",
  "recoveryRestore",
]);
const clients = new Map<string, Client>();
const initializingClients = new Map<string, Promise<Client>>();
async function restoreClient(owner: string): Promise<Client> {
  const vault = new WindowsCredentialStore(
    path.join(dataDir, "credentials", owner + ".dpapi"),
  );
  let credentialError = "";
  try {
    await vault.load();
  } catch (e) {
    credentialError = (e as Error).message;
  }
  return {
    listeners: new Set(),
    vault,
    credentialError,
    remembered: {
      openai: !!vault.get("openai"),
      eleven: !!vault.get("eleven"),
      gemini: !!vault.get("gemini"),
    },
    key: vault.get("openai"),
    elevenKey: vault.get("eleven"),
    geminiKey: vault.get("gemini"),
    chatgpt: new ChatGPTConnection(dataDir, { credentials: vault }),
  };
}
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
    !["ollama", "openai", "chatgpt", "gemini"].includes(c.provider) ||
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
          : c.provider === "gemini"
            ? client.geminiKey || process.env.GEMINI_API_KEY
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
    case "structuredEditPackage": {
      const requestId = randomUUID();
      const destination = path.join(exportsDir, requestId + ".zip");
      const saved = await writeStructuredEditPackage(
        args[0],
        requestId,
        args[1],
        destination,
        path.join(dataDir, "structured-edit", owner, requestId + ".json"),
        args[2],
        client.current ?? null,
        args[3],
        args[4],
      );
      return {
        ...saved,
        ...download(
          destination,
          "framescript-edit-" + requestId + ".zip",
          owner,
        ),
      };
    }
    case "structuredEditRequest": {
      const saved = (await readJson(
        path.join("structured-edit", owner, args[0] + ".json"),
        null,
      )) as RpcResults["structuredEditRequest"];
      if (!saved) return null;
      if (saved.projectId === undefined)
        throw Error(
          "This task predates project matching. Export a fresh task.",
        );
      if (saved.projectId !== (client.current ?? null))
        throw Error("This request belongs to a different project.");
      return saved;
    }
    case "exportStorage":
      return inspectExports();
    case "clearExportFiles":
      return inspectExports(true);
    case "servicesStatus": {
      const keys = {
        openai: client.key || process.env.OPENAI_API_KEY,
        eleven: client.elevenKey || process.env.ELEVENLABS_API_KEY,
        gemini: client.geminiKey || process.env.GEMINI_API_KEY,
      };
      return serviceIds.map((id) => ({
        id,
        configured:
          id === "chatgpt"
            ? client.chatgpt.status().connected
            : id === "ollama"
              ? true
              : id === "flow"
                ? false
                : !!keys[id],
        source:
          id === "chatgpt"
            ? "account"
            : id === "ollama"
              ? "local"
              : id === "flow"
                ? "external"
                : (
                      id === "openai"
                        ? client.key
                        : id === "eleven"
                          ? client.elevenKey
                          : client.geminiKey
                    )
                  ? "session"
                  : keys[id]
                    ? "environment"
                    : "none",
        remembered:
          id === "chatgpt"
            ? client.chatgpt.status().remembered
            : !!client.remembered?.[id],
        rememberSupported: process.platform === "win32",
        storageError: client.credentialError,
        check: client.serviceChecks?.[id],
      }));
    }
    case "serviceCheck": {
      const id = serviceIdSchema.parse(args[0]);
      let key: string | undefined;
      try {
        key =
          id === "chatgpt"
            ? await client.chatgpt.accessToken()
            : id === "openai"
              ? client.key || process.env.OPENAI_API_KEY
              : id === "eleven"
                ? client.elevenKey || process.env.ELEVENLABS_API_KEY
                : id === "gemini"
                  ? client.geminiKey || process.env.GEMINI_API_KEY
                  : undefined;
      } catch {
        const result: ServiceCheck = {
          state: "error",
          checkedAt: new Date().toISOString(),
          message: "Reconnect your ChatGPT account.",
        };
        (client.serviceChecks ??= {})[id] = result;
        return result;
      }
      const result = await checkService(id, key);
      (client.serviceChecks ??= {})[id] = result;
      return result;
    }
    case "serviceRemove": {
      const id = serviceIdSchema.parse(args[0]);
      await client.vault?.set(id, undefined);
      if (client.remembered) client.remembered[id] = false;
      if (id === "chatgpt") {
        client.ai?.abort();
        await client.chatgpt.disconnect();
      } else if (id === "openai") client.key = undefined;
      else if (id === "eleven") client.elevenKey = undefined;
      else if (id === "gemini") client.geminiKey = undefined;
      if (client.serviceChecks) delete client.serviceChecks[id];
      return true;
    }
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
      if (args[2] && client.credentialError)
        throw Error(client.credentialError);
      await client.vault?.set(
        args[0],
        args[2] && args[1] ? args[1] : undefined,
      );
      (client.remembered ??= {})[args[0]] = !!args[2] && !!args[1];
      if (args[0] === "gemini") client.geminiKey = args[1];
      else client.elevenKey = args[1];
      if (client.serviceChecks)
        delete client.serviceChecks[args[0] as ServiceId];
      return true;
    case "imageModels":
      return googleImageModels(
        client.geminiKey || process.env.GEMINI_API_KEY || "",
      );
    case "elevenCatalog":
      return elevenCatalog(
        client.elevenKey || process.env.ELEVENLABS_API_KEY || "",
      );
    case "transcribeAudio":
      return transcribeAudio(
        client.elevenKey || process.env.ELEVENLABS_API_KEY || "",
        args[0],
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
        const result =
          name === "generateImage"
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
        (client.serviceChecks ??= {})[
          name === "generateImage" ? "gemini" : "eleven"
        ] = {
          state: "ready",
          checkedAt: new Date().toISOString(),
          message:
            "Last generation completed. Refresh usage for the latest provider balance.",
        };
        return result;
      } catch (error) {
        (client.serviceChecks ??= {})[
          name === "generateImage" ? "gemini" : "eleven"
        ] = {
          state: "error",
          checkedAt: new Date().toISOString(),
          message:
            "The last generation did not complete. Check this connection, account access or provider limits, then retry with this service.",
        };
        throw error;
      } finally {
        const check =
          client.serviceChecks?.[
            name === "generateImage" ? "gemini" : "eleven"
          ];
        if (check?.quota) {
          delete check.quota;
          check.quotaError =
            "Usage may have changed. Refresh to read the latest provider balance.";
        }
        clearTimeout(timeout);
        client.mediaAbort = undefined;
      }
    }
    case "chatgptStatus":
      return client.chatgpt.status();
    case "chatgptConnect":
      if (client.serviceChecks) delete client.serviceChecks.chatgpt;
      return client.chatgpt.begin(args[0] === true, args[1] === true);
    case "chatgptDisconnect":
      if (client.serviceChecks) delete client.serviceChecks.chatgpt;
      client.ai?.abort();
      return client.chatgpt.disconnect();
    case "session":
      return true;
    case "terminalRun":
      return runTerminal(owner, args[0], args[1]);
    case "terminalPoll":
      return terminalState(owner, args[0]);
    case "terminalStop":
      return stopTerminal(owner, args[0], args[1]);
    case "terminalClear":
      return clearTerminal(owner, args[0]);
    case "hasKey":
      return !!(client.key || process.env.OPENAI_API_KEY);
    case "credentials":
      if (typeof args[0] !== "string" || args[0].length > 1000)
        throw Error("Invalid API credential");
      if (client.serviceChecks) delete client.serviceChecks.openai;
      if (args[1] && client.credentialError)
        throw Error(client.credentialError);
      await client.vault?.set(
        "openai",
        args[1] && args[0] ? args[0] : undefined,
      );
      (client.remembered ??= {}).openai = !!args[1] && !!args[0];
      client.key = args[0];
      return true;
    case "newSession":
      database.checkpoint("Before replacing project");
      database.clearDraftCode();
      database.set("currentProject", null);
      client.current = undefined;
      return true;
    case "settingsGet":
      return database.get("settings") ?? {};
    case "workspaceGet":
      client.current = database.get("currentProject") ?? undefined;
      return database.workspace();
    case "settingsSet": {
      const text = JSON.stringify(args[0]);
      if (text.length > 2_000_000) throw Error("Settings too large");
      database.set("settings", {
        ...(database.get("settings") ?? {}),
        ...args[0],
      });
      return true;
    }
    case "workspaceEditorGet":
      return database.get("workspaceEditor") ?? {};
    case "autosave":
      database.saveWorkspace(
        args[0],
        args[1],
        client.current === database.get("currentProject")
          ? client.current
          : undefined,
        client.current ? undefined : "draft",
      );
      return true;
    case "codeHistory":
      return database.codeHistory(client.current ?? "draft", args[0]);
    case "codeBaseline":
      return database.codeBaseline(client.current ?? "draft", args[0]);
    case "codeVersion":
      return database.codeVersion(client.current ?? "draft", args[0], args[1]);
    case "checkpoint":
      return database.checkpoint(
        String(args[0] || "Manual checkpoint"),
        args[1],
        args[2],
      );
    case "recoveryList":
      return database.recoveryList();
    case "recoveryRestore": {
      const snapshot = database.recoveryProject(String(args[0]));
      database.checkpoint("Before restoring recovery version");
      database.saveWorkspace(snapshot.project, snapshot.editor);
      database.set("currentProject", null);
      client.current = undefined;
      return snapshot;
    }
    case "recover":
      return database.workspace();
    case "recents":
      return database.recents();
    case "projectList":
      return database.listProjects(args[0] ?? false);
    case "projectSave": {
      const project = projectSchema.parse(args[0]);
      const id =
        args[1]?.create || !client.current
          ? cleanName(project.name) + "-" + randomUUID() + ".frame"
          : client.current;
      database.putProject(
        id,
        project,
        !args[1]?.create && !client.current ? "draft" : undefined,
      );
      database.saveWorkspace(project);
      database.set("currentProject", id);
      client.current = id;
      if (args[1]?.thumbnail)
        database.set("thumbnail:" + id, args[1].thumbnail);
      return id;
    }
    case "projectRename": {
      database.renameProject(args[0], args[1]);
      return true;
    }
    case "projectDuplicate": {
      const id = randomUUID() + ".frame";
      database.duplicateProject(args[0], id);
      return id;
    }
    case "projectTrash": {
      database.checkpoint("Before moving project to trash");
      database.trash(args[0]);
      if (database.get("currentProject") === args[0])
        database.set("currentProject", null);
      if (client.current === args[0]) client.current = undefined;
      return true;
    }
    case "projectRestore":
      database.restoreProject(args[0]);
      return true;
    case "projectDeleteForever": {
      const id = args[0];
      database.deleteTrashedProject(id);
      for (const session of clients.values()) {
        if (session.current === id) session.current = undefined;
      }
      return true;
    }
    case "openRecent": {
      const file = args[0];
      if (
        typeof file !== "string" ||
        path.basename(file) !== file ||
        !file.endsWith(".frame")
      )
        throw Error("Invalid project");
      const p = database.project(file);
      database.checkpoint("Before opening recent project");
      database.saveWorkspace(p);
      database.set("currentProject", file);
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
      database.putProject(
        file,
        p,
        name === "save" && !client.current ? "draft" : undefined,
      );
      database.saveWorkspace(p);
      database.set("currentProject", file);
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
      database.checkpoint("Before moving project to trash");
      await fs.mkdir(path.join(dataDir, "trash"), { recursive: true });
      await fs
        .rename(
          path.join(projectsDir, client.current),
          path.join(dataDir, "trash", Date.now() + "-" + client.current),
        )
        .catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      database.trash(client.current);
      database.set("currentProject", null);
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
        (client.serviceChecks ??= {})[serviceIdSchema.parse(args[0].provider)] =
          {
            state: "ready",
            checkedAt: new Date().toISOString(),
            message: "Last AI request completed. Model access verified.",
          };
        return name === "plan"
          ? verifyPlan(args[1].prompt, response)
          : response;
      } catch (error) {
        const id = serviceIdSchema.parse(args[0].provider);
        (client.serviceChecks ??= {})[id] = {
          state: "error",
          checkedAt: new Date().toISOString(),
          message:
            "The last AI request did not complete. Check the selected service or reconnect, then retry. Your provider selection has been kept.",
        };
        throw error;
      } finally {
        clearTimeout(timeout);
        client.ai = undefined;
      }
    }
    case "cancelExport":
      if (args[0] && !client.exports?.has(args[0])) {
        const cancelled = (client.cancelledExports ??= new Map());
        cancelled.set(args[0], Date.now());
        if (cancelled.size > 64)
          cancelled.delete(cancelled.keys().next().value!);
      }
      for (const [id, job] of client.exports ?? []) {
        if (args[0] && id !== args[0]) continue;
        job.controller.abort();
        job.worker?.postMessage("cancel");
      }
      return true;
    case "export": {
      const project = projectSchema.parse(args[0]),
        options = exportSchema.parse(args[1]);
      const id = args[2] ?? randomUUID();
      const cancelledAt = client.cancelledExports?.get(id);
      client.cancelledExports?.delete(id);
      if (cancelledAt && Date.now() - cancelledAt < 300_000)
        throw Error("Export cancelled");
      const jobs = (client.exports ??= new Map());
      if (jobs.has(id)) throw Error("Export ID is already running");
      if (jobs.size >= 10)
        throw Error("At most 10 exports can be queued per browser.");
      const destination = path.join(
        exportsDir,
        randomUUID() + "." + options.format,
      );
      const unprotect = exportRetention.protect(destination);
      const unprotectZip = exportRetention.protect(destination + ".zip");
      const ffmpeg = require("ffmpeg-static");
      const exportAbort = new AbortController();
      const job: {
        controller: AbortController;
        worker?: Worker;
        progress?: unknown;
      } = { controller: exportAbort };
      jobs.set(id, job);
      const publish = (progress: any) => {
        job.progress = { ...progress, jobId: id };
        for (const listener of client.listeners)
          listener.write("data: " + JSON.stringify(job.progress) + "\n\n");
      };
      publish({
        stage: "Queued",
        done: 0,
        total: Math.ceil((options.duration / options.speed) * options.fps),
        destination,
      });
      let release: (() => void) | undefined;
      try {
        release = await exportQueue.acquire(exportAbort.signal);
        await new Promise<void>((resolve, reject) => {
          const worker = new Worker(path.join(__dirname, "export-worker.cjs"), {
            workerData: {
              project,
              options,
              destination,
              ffmpeg,
              cacheDirectory: path.join(dataDir, "render-cache", owner!),
            },
          });
          job.worker = worker;
          if (exportAbort.signal.aborted) worker.postMessage("cancel");
          let settled = false;
          worker.on("message", (data) => {
            if (data.type === "progress") {
              publish(data.progress);
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
            publish({
              stage: "Packaging frames",
              done: 0,
              total: 1,
              destination: file,
            });
            await archiveSequence(destination, file, exportAbort.signal);
            publish({
              stage: "Complete",
              done: 1,
              total: 1,
              destination: file,
            });
          } finally {
            await fs.rm(destination, { recursive: true, force: true });
          }
          return download(
            file,
            cleanName(
              (options.fileName || project.name).replace(
                /\.(mp4|mkv|webm|gif|png|zip)$/i,
                "",
              ),
            ) + "-frames.zip",
            owner,
          );
        }
        return download(
          destination,
          cleanName(
            (options.fileName || project.name).replace(
              /\.(mp4|mkv|webm|gif|png|zip)$/i,
              "",
            ),
          ) +
            "." +
            options.format,
          owner,
        );
      } catch (error) {
        publish({
          stage: exportAbort.signal.aborted ? "Cancelled" : "Failed",
          done: 0,
          total: 1,
          error: (error as Error).message,
        });
        throw error;
      } finally {
        jobs.delete(id);
        release?.();
        unprotect();
        unprotectZip();
      }
    }
    default:
      throw Error("Unknown operation");
  }
}

async function start() {
  database = await StudioDatabase.open(dataDir);
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  await inspectExports();
  setInterval(() => void inspectExports().catch(() => {}), 3_600_000).unref();
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
        if (!owner) owner = randomUUID();
        if (!clients.has(owner)) {
          if (!initializingClients.has(owner))
            initializingClients.set(owner, restoreClient(owner));
          try {
            clients.set(owner, await initializingClients.get(owner)!);
          } finally {
            initializingClients.delete(owner);
          }
        }
        res.setHeader(
          "Set-Cookie",
          `framescript=${owner}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`,
        );
        const client = clients.get(owner)!;
        if (url.pathname === "/api/events" && req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(": connected\n\n");
          client.listeners.add(res);
          for (const job of client.exports?.values() ?? [])
            if (job.progress)
              res.write("data: " + JSON.stringify(job.progress) + "\n\n");
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
          const releaseFile = exportRetention.protect(item.file);
          res.on("close", releaseFile);
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
        const operation = url.pathname.slice("/api/".length);
        if (
          operation.startsWith("terminal") &&
          (req.headers.origin !== "http://" + host ||
            req.headers["sec-fetch-site"] !== "same-origin")
        ) {
          json(
            res,
            { error: "Terminal commands require the local studio page." },
            403,
          );
          return;
        }
        if (!Object.hasOwn(rpcSchemas, operation) || operation === "open")
          throw Error("Unknown operation");
        payload.args = rpcSchemas[operation as RpcName].parse(payload.args);
        if (
          workspaceWrites.has(operation) ||
          operation === "workspaceGet" ||
          operation === "projectList"
        ) {
          // Check and mutate in one queue so concurrent tabs cannot both pass CAS.
          const task = workspaceQueue.then(async () => {
            const expected = req.headers["x-workspace-version"];
            if (
              workspaceWrites.has(operation) &&
              expected &&
              expected !== workspaceVersion
            ) {
              json(
                res,
                {
                  error:
                    "Another tab changed this workspace. Download a recovery copy before reloading to load its latest version.",
                },
                409,
              );
              return;
            }
            if (workspaceWrites.has(operation)) workspaceVersion = randomUUID();
            res.setHeader("X-Workspace-Version", workspaceVersion);
            const result = await invoke(
              operation,
              payload.args,
              client,
              owner!,
            );
            json(res, result);
          });
          workspaceQueue = task.catch(() => {});
          await task;
        } else json(res, await invoke(operation, payload.args, client, owner));
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
    stopTerminals();
    for (const client of clients.values()) {
      client.chatgpt.close();
      client.mediaAbort?.abort();
      client.ai?.abort();
      for (const job of client.exports?.values() ?? []) {
        job.controller.abort();
        job.worker?.postMessage("cancel");
      }
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
