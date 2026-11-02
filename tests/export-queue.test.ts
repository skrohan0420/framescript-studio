// @vitest-environment node
import { it, expect } from "vitest";
import { ExportQueue } from "../server/export-queue";

it("runs two exports and starts waiting jobs in order as slots are released", async () => {
  const queue = new ExportQueue(2),
    signal = new AbortController().signal;
  const first = await queue.acquire(signal),
    second = await queue.acquire(signal);
  const order: string[] = [];
  const third = queue.acquire(signal).then((release) => {
    order.push("third");
    return release;
  });
  const fourth = queue.acquire(signal).then((release) => {
    order.push("fourth");
    return release;
  });
  await Promise.resolve();
  expect(order).toEqual([]);
  first();
  const releaseThird = await third;
  expect(order).toEqual(["third"]);
  first();
  await Promise.resolve();
  expect(order).toEqual(["third"]);
  second();
  const releaseFourth = await fourth;
  expect(order).toEqual(["third", "fourth"]);
  releaseThird();
  releaseFourth();
});
it("cancelling a queued job preserves active jobs and does not block the next job", async () => {
  const queue = new ExportQueue(1),
    signal = new AbortController().signal;
  const first = await queue.acquire(signal),
    cancel = new AbortController();
  const cancelled = queue.acquire(cancel.signal);
  const rejected = expect(cancelled).rejects.toThrow("cancelled");
  let started = false;
  const next = queue.acquire(signal).then((release) => {
    started = true;
    return release;
  });
  cancel.abort();
  await rejected;
  expect(started).toBe(false);
  first();
  (await next)();
  await expect(queue.acquire(cancel.signal)).rejects.toThrow("cancelled");
  (await queue.acquire(signal))();
});
