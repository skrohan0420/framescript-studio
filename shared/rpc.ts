import { z } from "zod";
import type { TranscriptWord } from "./transcript";
import { projectSchema, exportSchema, aiSchema, type Project } from "./project";
import { storyboardSchema } from "./workflow";
import { serviceIds, type ServiceStatus, type ServiceCheck } from "./services";

const config = z.object({ provider: z.string(), model: z.string() });
const chat = z.object({
  role: z.string().max(30),
  content: z.string().max(100000),
  applied: z.boolean().optional(),
});
const editor = z.object({
  sceneChats: z.record(z.string(), z.array(chat).max(1000)).optional(),
});
const aiRequest = z.object({
  project: projectSchema,
  prompt: z.string().max(30000),
  history: z.array(chat).max(1000),
  images: z.array(z.string()).max(100),
  error: z.string().optional(),
  selection: z.unknown().optional(),
});
const empty = z.tuple([]);
export const rpcSchemas = {
  session: empty,
  exportStorage: empty,
  clearExportFiles: empty,
  newSession: empty,
  hasKey: empty,
  mediaStatus: empty,
  servicesStatus: empty,
  chatgptStatus: empty,
  chatgptDisconnect: empty,
  settingsGet: empty,
  workspaceGet: empty,
  workspaceEditorGet: empty,
  recover: empty,
  recents: empty,
  projectList: z.tuple([z.boolean().optional()]),
  projectSave: z.tuple([
    projectSchema,
    z
      .object({
        create: z.boolean().optional(),
        thumbnail: z.string().startsWith("data:image/").max(600000).optional(),
      })
      .optional(),
  ]),
  projectRename: z.tuple([z.string().max(300), z.string().min(1).max(200)]),
  projectDuplicate: z.tuple([z.string().max(300)]),
  projectTrash: z.tuple([z.string().max(300)]),
  projectRestore: z.tuple([z.string().max(300)]),
  recoveryList: empty,
  open: empty,
  deleteProject: empty,
  cancelAI: empty,
  cancelMedia: empty,
  cancelExport: z.tuple([z.string().uuid().optional()]),
  serviceCheck: z.tuple([z.enum(serviceIds)]),
  serviceRemove: z.tuple([z.enum(serviceIds)]),
  credentials: z.tuple([z.string().max(1000), z.boolean().optional()]),
  mediaCredentials: z.tuple([
    z.enum(["gemini", "eleven"]),
    z.string().max(1000),
    z.boolean().optional(),
  ]),
  chatgptConnect: z.tuple([z.boolean().optional(), z.boolean().optional()]),
  settingsSet: z.tuple([z.record(z.string(), z.unknown())]),
  autosave: z.tuple([projectSchema, editor.optional()]),
  checkpoint: z.tuple([
    z.string().max(200),
    projectSchema.optional(),
    editor.optional(),
  ]),
  recoveryRestore: z.tuple([z.string().max(100)]),
  openRecent: z.tuple([z.string().max(300)]),
  save: z.tuple([projectSchema]),
  saveAs: z.tuple([projectSchema]),
  source: z.tuple([projectSchema]),
  export: z.tuple([projectSchema, exportSchema, z.string().uuid().optional()]),
  models: z.tuple([config]),
  generate: z.tuple([config, aiRequest]),
  plan: z.tuple([config, aiRequest]),
  imageModels: empty,
  elevenCatalog: empty,
  transcribeAudio: z.tuple([
    z.object({ data: z.string().max(40000000), name: z.string().max(300) }),
  ]),
  generateImage: z.tuple([
    z.object({
      model: z.string(),
      prompt: z.string(),
      references: z.array(z.string()),
      project: projectSchema,
    }),
  ]),
  generateAudio: z.tuple([
    z.object({
      type: z.enum(["voice", "sfx"]),
      text: z.string(),
      voice: z.string().optional(),
      model: z.string().optional(),
      duration: z.number().optional(),
    }),
  ]),
};
export type RpcName = keyof typeof rpcSchemas;
export type RpcArgs<K extends RpcName> = z.input<(typeof rpcSchemas)[K]>;
export type ChatMessage = z.infer<typeof chat>;
export type WorkspaceEditor = z.infer<typeof editor>;
export type RecoveryVersion = {
  id: string;
  name: string;
  reason: string;
  created: number;
};
export type ProjectSummary = {
  current?: boolean;
  id: string;
  name: string;
  updated: number;
  duration: number;
  width: number;
  height: number;
  scenes: number;
  thumbnail?: string;
};
export type ModelInfo = { name: string; label?: string; vision: boolean };
export type ChatGPTStatus = {
  connected: boolean;
  pending: boolean;
  remembered?: boolean;
  email?: string;
  subject?: string;
  planEnabled?: boolean;
  error?: string;
};
export interface RpcResults {
  exportStorage: { files: number; bytes: number; retentionDays: number };
  clearExportFiles: { files: number; bytes: number; retentionDays: number };
  session: boolean;
  newSession: boolean;
  hasKey: boolean;
  mediaStatus: { gemini: boolean; eleven: boolean };
  servicesStatus: ServiceStatus[];
  serviceCheck: ServiceCheck;
  serviceRemove: boolean;
  credentials: boolean;
  mediaCredentials: boolean;
  chatgptStatus: ChatGPTStatus;
  chatgptConnect: { url: string };
  chatgptDisconnect: { warning?: string };
  settingsGet: Record<string, any>;
  settingsSet: boolean;
  workspaceGet: Project | null;
  workspaceEditorGet: WorkspaceEditor;
  autosave: boolean;
  recover: Project | null;
  recents: string[];
  projectList: ProjectSummary[];
  projectSave: string;
  projectRename: boolean;
  projectDuplicate: string;
  projectTrash: boolean;
  projectRestore: boolean;
  recoveryList: RecoveryVersion[];
  checkpoint: string | undefined;
  recoveryRestore: { project: Project; editor: WorkspaceEditor };
  open: Project | null;
  openRecent: Project;
  deleteProject: boolean;
  save: string;
  saveAs: string;
  source: string;
  export: string;
  models: ModelInfo[];
  generate: z.infer<typeof aiSchema>;
  plan: z.infer<typeof storyboardSchema>;
  cancelAI: boolean;
  cancelMedia: boolean;
  cancelExport: boolean;
  imageModels: { id: string; name: string }[];
  elevenCatalog: {
    voices: { id: string; name: string }[];
    models: { id: string; name: string }[];
  };
  generateImage: { data: string };
  generateAudio: { data: string };
  transcribeAudio: { text: string; words: TranscriptWord[] };
}
