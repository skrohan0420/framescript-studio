import type { Project } from "../shared/project";
const key = "framescript:acknowledged-recovery";
async function signature(project: Project) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function recoveryAcknowledged(project: Project) {
  const hash = await signature(project);
  if (localStorage.getItem(key) === hash) return "dismissed";
  if (localStorage.getItem(key) === hash + ":restored") return "restored";
  return null;
}
export async function acknowledgeRecovery(project: Project, restored = false) {
  localStorage.setItem(
    key,
    (await signature(project)) + (restored ? ":restored" : ""),
  );
}
