import { build } from "esbuild";
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist-server/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  sourcemap: true,
});
await build({
  entryPoints: ["server/export-worker.ts"],
  outfile: "dist-server/export-worker.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
});
