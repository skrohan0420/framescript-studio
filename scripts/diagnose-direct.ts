import { chromium } from "playwright";
import { exportFixture } from "./export-fixtures";
import { documentFor } from "../shared/runtime";
import { rawCanvasTransport, isolateRawCanvas } from "../server/raw-canvas";
const browser = await chromium.launch();
const transport = await rawCanvasTransport(3840, 2160);
try {
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 3840, height: 2160 },
  });
  const session = await page.context().newCDPSession(page);
  await isolateRawCanvas(session, transport.urlPrefix);
  await page.setContent(
    documentFor(exportFixture("canvas", 10), {
      export: true,
      exportTransportOrigin: transport.origin,
    }),
  );
  for (const t of [0, 2, 3, 5, 7, 599 / 60]) {
    await page.evaluate((t) => (window as any).__fsSeek(t), t);
    const state = await page.evaluate(() => {
      const c = document.querySelector("canvas")!,
        x = c.getContext("2d")!,
        data = x.getImageData(0, 0, c.width, c.height).data;
      let min = 255,
        index = 0;
      for (let i = 3; i < data.length; i += 4)
        if (data[i] < min) {
          min = data[i];
          index = i;
        }
      return {
        min,
        index,
        attributes: x.getContextAttributes(),
        eligible:
          (window as any).__fsDirectCanvas(3840, 2160) instanceof
          HTMLCanvasElement,
      };
    });
    try {
      await transport.capture(page);
      console.log(
        JSON.stringify({
          width: 3840,
          height: 2160,
          fps: 60,
          t,
          state,
          direct: true,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          width: 3840,
          height: 2160,
          fps: 60,
          t,
          state,
          error: String(error),
        }),
      );
    }
  }
} finally {
  await browser.close();
  await transport.close();
}
