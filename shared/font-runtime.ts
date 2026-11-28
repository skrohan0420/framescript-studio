// Serialized into the sandbox, including standalone HTML and export documents.
export function fontRuntime(configuredFamily: string, outfitSource: string) {
  const w = window as any;
  document.documentElement.setAttribute("data-fs-font-pending", "");
  const outfit = new FontFace("Outfit", "url(" + JSON.stringify(outfitSource) + ")", {
    weight: "100 900", style: "normal", display: "block",
  });
  document.fonts.add(outfit);
  // Start decoding immediately, but handle failures through the shared promise.
  const bundled = outfit.load().then(() => null, () => "The bundled Outfit font could not be loaded.");
  const domReady = document.readyState === "loading"
    ? new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }))
    : Promise.resolve();
  const normalize = (family: string) => family.replace(/^["']|["']$/g, "").trim().toLowerCase();
  const generics = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong"]);

  w.__fsFontsReady = (async () => {
    await domReady;
    try {
      const bundledError = await bundled;
      if (bundledError) throw Error(bundledError);
      const family = normalize(configuredFamily);
      if (family !== "outfit" && !generics.has(family)) {
        const authored = Array.from(document.fonts).filter((face) => normalize(face.family) === family);
        if (authored.length) {
          await Promise.all(authored.map((face) => face.load()));
        } else {
          // fonts.check() alone reports true for absent families: probe local()
          // explicitly so a browser fallback cannot masquerade as availability.
          await new FontFace("FrameScriptFontProbe", "local(" + JSON.stringify(configuredFamily) + ")").load();
        }
      }
      await document.fonts.ready;
      w.__fsFontsLoaded = true;
      document.documentElement.removeAttribute("data-fs-font-pending");
      return null;
    } catch (error) {
      const message = "Configured font “" + configuredFamily + "” is unavailable. " +
        (normalize(configuredFamily) === "outfit" ? String(error) : "Provide this font locally or embed it in the scene, or choose an available font in Config.") +
        " FrameScript stopped rendering to prevent font substitution.";
      w.__fsFontError = message;
      document.documentElement.removeAttribute("data-fs-font-pending");
      document.documentElement.setAttribute("data-fs-font-error", "");
      const alert = document.createElement("div");
      alert.setAttribute("data-fs-font-alert", "");
      alert.setAttribute("role", "alert");
      alert.textContent = message;
      document.body.appendChild(alert);
      return message;
    }
  })();
}
