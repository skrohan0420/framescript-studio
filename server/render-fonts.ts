import type { Page } from "playwright";

/** Nested continuation frames have independent font sets, even when sandboxed. */
export async function waitForSceneFonts(page: Page) {
  await Promise.all(page.frames().map((frame) => frame.evaluate(async () => {
    const error = await (window as any).__fsFontsReady;
    if (error) throw Error(error);
    await document.fonts.ready;
  })));
}
