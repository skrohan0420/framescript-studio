import { useEffect, useState } from "react";
import {
  Code2,
  Home,
  FolderOpen,
  Plus,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Copy,
  Pencil,
  RotateCcw,
  ArrowRight,
  Type,
  Sparkles,
  HardDrive,
  X,
  Film,
  Play,
} from "lucide-react";
import { bridge } from "./bridge";
import type { ProjectSummary } from "../shared/rpc";
import type { Project } from "../shared/project";
export type HomeProjectOptions = {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tool: string;
};
export function ProjectHome({
  workspace,
  onContinue,
  onCreate,
  onOpen,
  onImport,
  onRenameCurrent,
}: {
  workspace: Project;
  onContinue: () => void;
  onCreate: (options: HomeProjectOptions) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onImport: () => Promise<void>;
  onRenameCurrent?: (name: string) => void;
}) {
  const [section, setSection] = useState("home"),
    [projects, setProjects] = useState<ProjectSummary[]>([]),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recent"),
    [list, setList] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [create, setCreate] = useState(false),
    [name, setName] = useState("Untitled project"),
    [format, setFormat] = useState("3840x2160"),
    [fps, setFps] = useState(60),
    [tool, setTool] = useState("code");
  const [rename, setRename] = useState<ProjectSummary | null>(null),
    [renameValue, setRenameValue] = useState("");
  const refresh = async () => {
    setLoading(true);
    try {
      setProjects(await bridge.call("projectList", section === "trash"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [section]);
  const act = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const filtered = projects
    .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.updated - a.updated,
    );
  const openCreate = (view = "code") => {
    setTool(view);
    setCreate(true);
  };
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
  return (
    <div className="project-home">
      <aside className="home-sidebar">
        <div className="home-brand">
          <span>
            <Code2 size={22} />
          </span>
          <div>
            <strong>FrameScript</strong>
            <small>STUDIO</small>
          </div>
        </div>
        <div className="home-workspace-label">
          <span className="home-avatar">FS</span>
          <div>
            <strong>My workspace</strong>
            <small>Personal projects</small>
          </div>
        </div>
        <nav aria-label="Project navigation">
          <button
            className={section === "home" ? "active" : ""}
            onClick={() => setSection("home")}
          >
            <Home size={17} /> Home
          </button>
          <button
            className={section === "projects" ? "active" : ""}
            onClick={() => setSection("projects")}
          >
            <FolderOpen size={17} /> All projects
          </button>
          <button
            className={section === "trash" ? "active" : ""}
            onClick={() => setSection("trash")}
          >
            <Trash2 size={17} /> Trash
          </button>
        </nav>
        <div className="home-sidebar-section">
          <small>CREATE</small>
          <button onClick={() => openCreate("code")}>
            <Film size={16} /> Video project
          </button>
          <button onClick={() => openCreate("typography")}>
            <Type size={16} /> Typography
          </button>
          <button onClick={() => openCreate("prompts")}>
            <Sparkles size={16} /> Prompt builder
          </button>
        </div>
        <div className="home-local">
          <HardDrive size={16} />
          <div>
            <strong>Made here. Saved here.</strong>
            <small>Your projects stay on this computer.</small>
          </div>
        </div>
      </aside>
      <main className="home-main">
        <header className="home-topbar">
          <div>
            <small>YOUR CREATIVE WORKSPACE</small>
            <h1>
              {section === "trash"
                ? "Trash"
                : section === "projects"
                  ? "Your projects"
                  : "Let’s make something move."}
            </h1>
          </div>
          <button
            className="home-import"
            disabled={busy}
            onClick={() => void act(onImport)}
          >
            <FolderOpen size={15} /> Open .frame file
          </button>
        </header>
        {error && (
          <div className="home-error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {section === "home" && (
          <>
            <button className="home-create-banner" onClick={() => openCreate()}>
              <span className="home-create-symbol">
                <Plus size={27} />
              </span>
              <span>
                <strong>Create project</strong>
                <small>A blank canvas for your next idea</small>
              </span>
              <ArrowRight size={24} />
            </button>
            <div className="home-starters">
              <button
                className="home-starter motion"
                onClick={() => openCreate("code")}
              >
                <span className="starter-graphic">
                  <i />
                  <i />
                  <i />
                </span>
                <div>
                  <small>BUILD SOMETHING ORIGINAL</small>
                  <strong>Motion, made yours.</strong>
                  <span>
                    Start with a fresh scene <ArrowRight size={14} />
                  </span>
                </div>
              </button>
              <button
                className="home-starter type"
                onClick={() => openCreate("typography")}
              >
                <span className="starter-type">
                  Aa<span>Make it move.</span>
                </span>
                <div>
                  <small>TEXT WITH PERSONALITY</small>
                  <strong>Typography studio</strong>
                  <span>
                    Explore animated text <ArrowRight size={14} />
                  </span>
                </div>
              </button>
              <button className="home-starter resume" onClick={onContinue}>
                <Play size={22} />
                <div>
                  <small>PICK UP WHERE YOU LEFT OFF</small>
                  <strong>{workspace.name}</strong>
                  <span>
                    Continue editing <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            </div>
          </>
        )}
        <section
          className="home-project-section"
          aria-label={section === "trash" ? "Trashed projects" : "Projects"}
        >
          <div className="home-project-heading">
            <h2>
              {section === "trash" ? "Recently removed" : "Projects"}
              <span>{projects.length}</span>
            </h2>
            <div className="home-project-tools">
              <label className="home-search">
                <Search size={14} />
                <input
                  aria-label="Search projects"
                  placeholder="Search projects"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Sort projects"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Last edited</option>
                <option value="name">Name</option>
              </select>
              <button
                aria-label={list ? "Grid view" : "List view"}
                title={list ? "Grid view" : "List view"}
                onClick={() => setList(!list)}
              >
                {list ? <LayoutGrid size={16} /> : <List size={16} />}
              </button>
            </div>
          </div>
          {loading ? (
            <div className="home-empty">Loading your projects…</div>
          ) : !filtered.length ? (
            <div className="home-empty">
              <FolderOpen size={30} />
              <strong>
                {search
                  ? "No matching projects"
                  : section === "trash"
                    ? "Your trash is empty"
                    : "A little space for big ideas."}
              </strong>
              <p>
                {search
                  ? "Try another project name."
                  : section === "trash"
                    ? "Removed projects appear here and can be restored."
                    : "Create your first project, import a .frame file, or continue your current workspace."}
              </p>
              {!search && section !== "trash" && (
                <button className="primary" onClick={() => openCreate()}>
                  <Plus size={15} /> Create project
                </button>
              )}
            </div>
          ) : (
            <div className={"home-project-grid " + (list ? "list" : "")}>
              {filtered.map((project, index) => (
                <article key={project.id} className="home-project-card">
                  <button
                    className={"home-project-cover poster-" + (index % 4)}
                    aria-label={`Open ${project.name}`}
                    disabled={busy || section === "trash"}
                    onClick={() => void act(() => onOpen(project.id))}
                  >
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt="" />
                    ) : (
                      <div className="home-poster-art">
                        <i />
                        <span>
                          <Film size={26} />
                          {project.name.slice(0, 24)}
                        </span>
                        <b />
                      </div>
                    )}
                    <span className="home-project-duration">
                      {time(project.duration)}
                    </span>
                  </button>
                  <div className="home-project-info">
                    <button
                      disabled={busy || section === "trash"}
                      onClick={() => void act(() => onOpen(project.id))}
                    >
                      <strong title={project.name}>{project.name}</strong>
                    </button>
                    <small>
                      {project.width} × {project.height} · {project.scenes}{" "}
                      {project.scenes === 1 ? "scene" : "scenes"}
                    </small>
                    <small>
                      {new Date(project.updated).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  </div>
                  <div className="home-card-actions">
                    {section === "trash" ? (
                      <button
                        disabled={busy}
                        aria-label={`Restore ${project.name}`}
                        onClick={() =>
                          void act(() =>
                            bridge.call("projectRestore", project.id),
                          )
                        }
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          aria-label={`Rename ${project.name}`}
                          title="Rename"
                          onClick={() => {
                            setRename(project);
                            setRenameValue(project.name);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          disabled={busy}
                          aria-label={`Duplicate ${project.name}`}
                          title="Duplicate"
                          onClick={() =>
                            void act(() =>
                              bridge.call("projectDuplicate", project.id),
                            )
                          }
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          disabled={busy}
                          aria-label={`Move ${project.name} to trash`}
                          title="Move to trash"
                          onClick={() =>
                            void act(() =>
                              bridge.call("projectTrash", project.id),
                            )
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {create && (
        <div className="home-modal-backdrop">
          <form
            className="home-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create project"
            onSubmit={(event) => {
              event.preventDefault();
              const [width, height] = format.split("x").map(Number);
              void act(async () => {
                await onCreate({
                  name: name.trim() || "Untitled project",
                  width,
                  height,
                  fps,
                  duration: 10,
                  tool,
                });
                setCreate(false);
              });
            }}
          >
            <div>
              <h2>A fresh start.</h2>
              <button
                type="button"
                aria-label="Close create project"
                onClick={() => setCreate(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p>Set up your canvas. You can change these later.</p>
            <label className="field">
              <span>Project name</span>
              <input
                autoFocus
                aria-label="New project name"
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Canvas</span>
              <select
                aria-label="New project canvas"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option value="3840x2160">4K · Landscape · 16:9</option>
                <option value="1920x1080">1080p · Landscape · 16:9</option>
                <option value="2160x3840">4K · Portrait · 9:16</option>
                <option value="1080x1920">1080p · Portrait · 9:16</option>
                <option value="1080x1080">Square · 1:1</option>
              </select>
            </label>
            <div>
              <label className="field">
                <span>Frame rate</span>
                <select
                  aria-label="New project frame rate"
                  value={fps}
                  onChange={(event) => setFps(Number(event.target.value))}
                >
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </label>
            </div>
            <button
              className="primary home-modal-submit"
              disabled={busy}
              type="submit"
            >
              <Plus size={16} /> Create project
            </button>
          </form>
        </div>
      )}
      {rename && (
        <div className="home-modal-backdrop">
          <form
            className="home-modal"
            role="dialog"
            aria-label="Rename project"
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await bridge.call(
                  "projectRename",
                  rename.id,
                  renameValue.trim(),
                );
                if (rename.current) onRenameCurrent?.(renameValue.trim());
                setRename(null);
              });
            }}
          >
            <h2>Rename project</h2>
            <input
              autoFocus
              aria-label="Project title"
              maxLength={200}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setRename(null)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={!renameValue.trim() || busy}
              >
                Save name
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
