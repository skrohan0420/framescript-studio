import initSqlJs, { type Database } from "sql.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { projectSchema, type Project } from "../shared/project";
import type { CodeSnapshot } from "../shared/rpc";
const require = createRequire(path.resolve("package.json"));
export class StudioDatabase {
  private mediaCache = new Map<string, { data: string; reference: string }>();
  private constructor(
    private db: Database,
    private directory: string,
    private createDatabase: (bytes?: Uint8Array) => Database,
  ) {}
  static async open(directory: string) {
    fs.mkdirSync(directory, { recursive: true });
    fs.mkdirSync(path.join(directory, "media"), { recursive: true });
    const SQL = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });
    const file = path.join(directory, "studio.db");
    let opened: Database;
    try {
      opened = new SQL.Database(
        fs.existsSync(file) ? fs.readFileSync(file) : undefined,
      );
      if (opened.exec("PRAGMA quick_check")[0]?.values[0]?.[0] !== "ok")
        throw Error("Database integrity check failed");
    } catch (error) {
      // Preserve the damaged database and the last known-good startup backup.
      const backup = file + ".startup-backup";
      if (!fs.existsSync(backup)) throw error;
      opened = new SQL.Database(fs.readFileSync(backup));
      if (opened.exec("PRAGMA quick_check")[0]?.values[0]?.[0] !== "ok")
        throw error;
      fs.copyFileSync(file, file + ".corrupt-" + Date.now());
      fs.copyFileSync(backup, file);
    }
    if (fs.existsSync(file)) fs.copyFileSync(file, file + ".startup-backup");
    const instance = new StudioDatabase(
      opened,
      directory,
      (bytes) => new SQL.Database(bytes),
    );
    instance.db.run(
      "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,header TEXT NOT NULL,filename TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recovery (id TEXT PRIMARY KEY,payload TEXT NOT NULL,editor TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);",
    );
    instance.db.run(`CREATE TABLE IF NOT EXISTS code_versions (
      id TEXT PRIMARY KEY, project TEXT NOT NULL, scene TEXT NOT NULL,
      payload BLOB NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS code_versions_scope ON code_versions(project, scene);`);
    if (!instance.get("migration-v1")) {
      const legacy = path.join(directory, "projects");
      if (fs.existsSync(legacy))
        for (const name of fs
          .readdirSync(legacy)
          .filter((f) => f.endsWith(".frame"))) {
          try {
            instance.putProject(
              name,
              projectSchema.parse(
                JSON.parse(fs.readFileSync(path.join(legacy, name), "utf8")),
              ),
            );
          } catch {
            console.warn("Skipped invalid legacy project:", name);
          }
        }
      for (const [key, name] of [
        ["settings", "settings.json"],
        ["workspace", "recovery.frame"],
      ]) {
        const legacyFile = path.join(directory, name);
        if (fs.existsSync(legacyFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
            instance.set(
              key,
              key === "workspace"
                ? instance.pack(projectSchema.parse(data))
                : data,
            );
          } catch {
            console.warn("Skipped invalid legacy data:", name);
          }
        }
      }
      instance.set("migration-v1", true);
    }
    instance.flush();
    return instance;
  }
  private row(sql: string, args: any[] = []) {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(args);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
  }
  get(key: string): any {
    const row = this.row("SELECT value FROM kv WHERE key=?", [key]);
    return row ? JSON.parse(String(row.value)) : null;
  }
  set(key: string, value: any) {
    this.transaction(() => this.writeValue(key, value));
  }
  private writeValue(key: string, value: unknown) {
    this.db.run(
      "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [key, JSON.stringify(value)],
    );
  }
  private transaction<T>(operation: () => T): T {
    this.db.run("BEGIN");
    let committed = false;
    try {
      const result = operation();
      this.db.run("COMMIT");
      committed = true;
      this.flush();
      return result;
    } catch (error) {
      if (!committed) {
        this.db.run("ROLLBACK");
        this.mediaCache.clear();
        throw error;
      }
      try {
        this.db.run("ROLLBACK");
      } catch {}
      // A failed disk write must not leave newer, unpersisted state in memory.
      this.db.close();
      const file = path.join(this.directory, "studio.db");
      this.db = this.createDatabase(
        fs.existsSync(file) ? fs.readFileSync(file) : undefined,
      );
      this.mediaCache.clear();
      throw error;
    }
  }
  private flush() {
    const file = path.join(this.directory, "studio.db"),
      temporary = file + ".tmp";
    fs.writeFileSync(temporary, this.db.export());
    fs.renameSync(temporary, file);
  }
  private pack(project: Project) {
    const copy = projectSchema.parse(project);
    for (const asset of [
      ...copy.assets,
      ...(copy.audio ?? []),
      ...(copy.audioLibrary ?? []),
    ]) {
      const cacheKey = ("lane" in asset ? "audio:" : "image:") + asset.id;
      const cached = this.mediaCache.get(cacheKey);
      if (cached?.data === asset.data) {
        asset.data = cached.reference;
        continue;
      }
      const original = asset.data;
      const match = asset.data.match(/^data:([^,]+),(.*)$/s);
      if (!match) throw Error("Invalid embedded media");
      const bytes = match[1].includes(";base64")
        ? Buffer.from(match[2], "base64")
        : Buffer.from(decodeURIComponent(match[2]));
      const id = createHash("sha256")
        .update(match[1])
        .update(bytes)
        .digest("hex");
      const filename = id + ".bin",
        file = path.join(this.directory, "media", filename);
      if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
      this.db.run(
        "INSERT OR IGNORE INTO media(id,header,filename) VALUES(?,?,?)",
        [id, match[1], filename],
      );
      asset.data = "media://" + id;
      // Cache only a bounded amount of media; portable files still embed bytes.
      if (original.length <= 32_000_000) {
        this.mediaCache.delete(cacheKey);
        let cachedSize = Array.from(this.mediaCache.values()).reduce(
          (sum, entry) => sum + entry.data.length,
          0,
        );
        while (
          this.mediaCache.size &&
          (cachedSize + original.length > 32_000_000 ||
            this.mediaCache.size >= 32)
        ) {
          const oldest = this.mediaCache.keys().next().value!;
          cachedSize -= this.mediaCache.get(oldest)!.data.length;
          this.mediaCache.delete(oldest);
        }
        this.mediaCache.set(cacheKey, {
          data: original,
          reference: asset.data,
        });
      }
    }
    return copy;
  }
  private unpack(value: any): Project {
    for (const asset of [
      ...value.assets,
      ...(value.audio ?? []),
      ...(value.audioLibrary ?? []),
    ])
      if (asset.data.startsWith("media://")) {
        const row = this.row("SELECT header,filename FROM media WHERE id=?", [
          asset.data.slice(8),
        ]);
        if (!row) throw Error("Project media record is missing");
        const bytes = fs.readFileSync(
          path.join(this.directory, "media", String(row.filename)),
        );
        asset.data =
          "data:" +
          row.header +
          "," +
          (String(row.header).includes(";base64")
            ? bytes.toString("base64")
            : encodeURIComponent(bytes.toString("utf8")));
      }
    return projectSchema.parse(value);
  }
  workspace() {
    const value = this.get("workspace");
    return value ? this.unpack(value) : null;
  }
  saveWorkspace(
    p: Project,
    editor?: unknown,
    projectId?: string,
    draftScope?: string,
  ) {
    this.transaction(() => {
      const payload = this.pack(p);
      if (projectId) this.recordProjectCode(projectId, p, "Autosave");
      else if (draftScope) this.recordCode(draftScope, p, "Autosave");
      this.writeValue("workspace", payload);
      if (projectId)
        this.db.run(
          "UPDATE projects SET payload=?,updated=? WHERE id=? AND deleted=0",
          [JSON.stringify(payload), Date.now(), projectId],
        );
      if (editor !== undefined) this.writeValue("workspaceEditor", editor);
    });
  }
  checkpoint(reason: string, project?: Project, editor?: unknown) {
    const id = crypto.randomUUID();
    return this.transaction(() => {
      const payload = project ? this.pack(project) : this.get("workspace");
      if (!payload) return;
      const text = JSON.stringify(payload),
        editorText = JSON.stringify(
          editor ?? this.get("workspaceEditor") ?? {},
        );
      const previous = this.row(
        "SELECT id,payload,editor,reason FROM recovery ORDER BY created DESC,rowid DESC LIMIT 1",
      );
      if (
        previous?.payload === text &&
        previous.editor === editorText &&
        previous.reason === reason
      )
        return String(previous.id);
      this.db.run(
        "INSERT INTO recovery(id,payload,editor,reason,created) VALUES(?,?,?,?,?)",
        [id, text, editorText, reason.slice(0, 200), Date.now()],
      );
      this.db.run(
        "DELETE FROM recovery WHERE id NOT IN (SELECT id FROM recovery ORDER BY created DESC,rowid DESC LIMIT 20)",
      );
      return id;
    });
  }
  recoveryList() {
    const result = this.db.exec(
      "SELECT id,reason,created,json_extract(payload,'$.name') AS name FROM recovery ORDER BY created DESC,rowid DESC",
    );
    return (
      result[0]?.values.map(([id, reason, created, name]) => ({
        id: String(id),
        reason: String(reason),
        created: Number(created),
        name: String(name),
      })) ?? []
    );
  }
  recoveryProject(id: string) {
    const row = this.row("SELECT payload,editor FROM recovery WHERE id=?", [
      id,
    ]);
    if (!row) throw Error("Recovery version not found");
    return {
      project: this.unpack(JSON.parse(String(row.payload))),
      editor: JSON.parse(String(row.editor)),
    };
  }
  private recordProjectCode(id: string, p: Project, reason: string) {
    if (
      !this.row("SELECT 1 FROM code_versions WHERE project=? LIMIT 1", [id])
    ) {
      const previous = this.row(
        "SELECT payload FROM projects WHERE id=? AND deleted=0",
        [id],
      );
      if (previous)
        this.recordCode(
          id,
          JSON.parse(String(previous.payload)),
          "Previous save",
        );
    }
    this.recordCode(id, p, reason);
  }
  private recordCode(id: string, p: Project, reason: string) {
    const scenes = p.workflow?.scenes ?? [p];
    for (const code of scenes) {
      const scene = "id" in code ? `scene:${code.id}` : "project";
      const payload = JSON.stringify({
        html: code.html,
        css: code.css,
        js: code.js,
      });
      const digest = createHash("sha256").update(payload).digest();
      const latest = this.row(
        "SELECT id,reason,substr(payload,1,32) AS digest FROM code_versions WHERE project=? AND scene=? ORDER BY rowid DESC LIMIT 1",
        [id, scene],
      );
      if (
        latest?.digest instanceof Uint8Array &&
        digest.equals(latest.digest)
      ) {
        if (reason === "Manual save" && latest.reason !== reason)
          this.db.run(
            "UPDATE code_versions SET reason=?,created=? WHERE id=?",
            [reason, Date.now(), latest.id],
          );
        continue;
      }
      this.db.run("INSERT INTO code_versions VALUES(?,?,?,?,?,?)", [
        crypto.randomUUID(),
        id,
        scene,
        Buffer.concat([digest, gzipSync(payload)]),
        reason,
        Date.now(),
      ]);
      this.db.run(
        `DELETE FROM code_versions WHERE project=? AND scene=? AND rowid NOT IN (
        SELECT rowid FROM code_versions WHERE project=? AND scene=? ORDER BY (id=?) DESC,rowid DESC LIMIT 20
      )`,
        [id, scene, id, scene, this.baselineId(id, scene) ?? ""],
      );
    }
  }
  private baselineId(project: string, scene: string) {
    return this.row(
      `SELECT id FROM code_versions WHERE project=? AND scene=?
      ORDER BY (reason <> 'Autosave') DESC, CASE WHEN reason = 'Autosave' THEN rowid ELSE -rowid END LIMIT 1`,
      [project, scene],
    )?.id as string | undefined;
  }
  codeBaseline(project: string, scene: string | null): CodeSnapshot | null {
    const id = this.baselineId(
      project,
      scene === null ? "project" : `scene:${scene}`,
    );
    return id ? this.codeVersion(project, scene, id) : null;
  }
  codeHistory(id: string, scene: string | null) {
    return (
      this.db.exec(
        "SELECT id,created,reason FROM code_versions WHERE project=? AND scene=? ORDER BY rowid DESC",
        [id, scene === null ? "project" : `scene:${scene}`],
      )[0]?.values ?? []
    ).map(([id, created, reason]) => ({
      id: String(id),
      created: Number(created),
      reason: String(reason),
    }));
  }
  codeVersion(project: string, scene: string | null, id: string): CodeSnapshot {
    const row = this.row(
      "SELECT payload FROM code_versions WHERE project=? AND scene=? AND id=?",
      [project, scene === null ? "project" : `scene:${scene}`, id],
    );
    if (!row) throw Error("Code version is no longer available.");
    const payload = row.payload;
    return JSON.parse(
      payload instanceof Uint8Array
        ? gunzipSync(payload.subarray(32)).toString("utf8")
        : String(payload),
    );
  }
  clearDraftCode() {
    this.transaction(() =>
      this.db.run("DELETE FROM code_versions WHERE project='draft'"),
    );
  }
  putProject(id: string, p: Project, draftScope?: string) {
    this.transaction(() => {
      if (draftScope)
        this.db.run("UPDATE code_versions SET project=? WHERE project=?", [
          id,
          draftScope,
        ]);
      this.recordProjectCode(id, p, "Manual save");
      const payload = JSON.stringify(this.pack(p));
      this.db.run(
        "INSERT INTO projects(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated,deleted=0",
        [id, payload, Date.now()],
      );
    });
  }
  project(id: string) {
    const row = this.row(
      "SELECT payload FROM projects WHERE id=? AND deleted=0",
      [id],
    );
    if (!row) throw Error("Project not found");
    return this.unpack(JSON.parse(String(row.payload)));
  }
  renameProject(id: string, name: string) {
    const project = this.project(id);
    const workspace =
      this.get("currentProject") === id ? this.workspace() : null;
    this.transaction(() => {
      this.db.run(
        "UPDATE projects SET payload=?,updated=? WHERE id=? AND deleted=0",
        [JSON.stringify(this.pack({ ...project, name })), Date.now(), id],
      );
      if (workspace)
        this.writeValue("workspace", this.pack({ ...workspace, name }));
    });
  }
  recents() {
    const stmt = this.db.prepare(
      "SELECT id FROM projects WHERE deleted=0 ORDER BY updated DESC,id DESC LIMIT 30",
    );
    const ids: string[] = [];
    try {
      while (stmt.step()) ids.push(String(stmt.getAsObject().id));
    } finally {
      stmt.free();
    }
    return ids;
  }
  trash(id: string) {
    this.transaction(() =>
      this.db.run("UPDATE projects SET deleted=1 WHERE id=?", [id]),
    );
  }
  listProjects(deleted = false) {
    const statement = this.db.prepare(
      "SELECT id,payload,updated FROM projects WHERE deleted=? ORDER BY updated DESC,id DESC LIMIT 200",
    );
    statement.bind([deleted ? 1 : 0]);
    const result = [];
    try {
      while (statement.step()) {
        const row = statement.getAsObject();
        const project = JSON.parse(String(row.payload));
        result.push({
          id: String(row.id),
          name: String(project.name),
          updated: Number(row.updated),
          duration:
            project.workflow?.scenes?.reduce(
              (sum: number, scene: { duration: number }) =>
                sum + scene.duration,
              0,
            ) ?? project.settings.duration,
          width: project.settings.width,
          height: project.settings.height,
          scenes: project.workflow?.scenes?.length ?? 1,
          thumbnail: this.get("thumbnail:" + row.id) as string | undefined,
          current: this.get("currentProject") === row.id,
        });
      }
    } finally {
      statement.free();
    }
    return result;
  }
  restoreProject(id: string) {
    this.transaction(() =>
      this.db.run("UPDATE projects SET deleted=0,updated=? WHERE id=?", [
        Date.now(),
        id,
      ]),
    );
  }
  deleteTrashedProject(id: string) {
    this.transaction(() => {
      this.db.run("DELETE FROM projects WHERE id=? AND deleted=1", [id]);
      if (!this.db.getRowsModified())
        throw Error("Project is no longer in Trash.");
      this.db.run("DELETE FROM kv WHERE key=?", ["thumbnail:" + id]);
      this.db.run("DELETE FROM code_versions WHERE project=?", [id]);
      if (this.get("currentProject") === id)
        this.writeValue("currentProject", null);
    });
  }
  duplicateProject(id: string, nextId: string) {
    const project = this.project(id);
    this.putProject(nextId, {
      ...project,
      name: project.name.slice(0, 190) + " copy",
    });
    const thumbnail = this.get("thumbnail:" + id);
    if (thumbnail) this.set("thumbnail:" + nextId, thumbnail);
  }
  close() {
    this.db.close();
  }
}
