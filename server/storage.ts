import { promises as fs } from "node:fs";
import path from "node:path";
import { projectSchema, type Project } from "../shared/project";
export async function atomicWrite(file: string, data: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, data, "utf8");
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
export async function saveProject(file: string, p: Project) {
  await atomicWrite(file, JSON.stringify(projectSchema.parse(p), null, 2));
}
export async function loadProject(file: string) {
  const stat = await fs.stat(file);
  if (stat.size > 100_000_000) throw Error("Project exceeds 100 MB");
  return projectSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
}
