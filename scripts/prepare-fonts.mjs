import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../assets/fonts/outfit/", import.meta.url);
const metadata = JSON.parse(await readFile(new URL("source.json", root), "utf8"));
const font = await readFile(new URL("Outfit-Variable.ttf", root));
const license = await readFile(new URL("OFL.txt", root), "utf8");
const expected = metadata.files.find((file) => file.file === "Outfit-Variable.ttf");
if (createHash("sha256").update(font).digest("hex") !== expected.sha256)
  throw Error("Bundled Outfit font does not match its recorded checksum.");
await writeFile(new URL("../shared/font-source.generated.ts", import.meta.url),
  "// Generated from assets/fonts/outfit. See OFL.txt and source.json there.\n" +
  "export const outfitFontSource = " + JSON.stringify("data:font/ttf;base64," + font.toString("base64")) + ";\n" +
  "export const outfitFontLicense = " + JSON.stringify(license) + ";\n");
