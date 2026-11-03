import { createElement } from "react";
// @vitest-environment jsdom
import { test, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AudioPlayback } from "../src/AudioPlayback";
import { newProject } from "../shared/project";
import { useStudio } from "../src/store";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("replacing clip data and undoing refresh playback without retaining stale recordings", () => {
  const nodes: any[] = [];
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      paused = true;
      preload = "";
      constructor(src: string) {
        this.src = src;
        nodes.push(this);
      }
      pause() {}
      play() {
        return Promise.resolve();
      }
    },
  );
  const p = newProject();
  const clip = {
    id: "same-id",
    name: "original",
    data: "data:audio/wav;base64,AAAA",
    duration: 5,
    lane: "voice" as const,
    start: 0,
    trimIn: 0,
    length: 5,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
    license: "",
  };
  p.audio = [clip];
  useStudio.getState().setTime(0);
  const view = render(
    createElement(AudioPlayback, {
      project: p,
      master: false,
      onError: () => {},
    }),
  );
  const changed = {
    ...p,
    audio: [{ ...clip, data: "data:audio/wav;base64,BBBB" }],
  };
  view.rerender(
    createElement(AudioPlayback, {
      project: changed,
      master: false,
      onError: () => {},
    }),
  );
  expect(nodes.at(-1).src).toBe(changed.audio[0].data);
  view.rerender(
    createElement(AudioPlayback, {
      project: p,
      master: false,
      onError: () => {},
    }),
  );
  expect(nodes.at(-1).src).toBe(clip.data);
  expect(nodes).toHaveLength(1);
});

test("150 percent gain uses Web Audio and resets when volume is reduced", () => {
  const nodes: any[] = [];
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      paused = true;
      volume = 1;
      constructor(src: string) {
        this.src = src;
        nodes.push(this);
      }
      pause() {}
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      destination = {};
      createMediaElementSource() {
        return source;
      }
      createGain() {
        return gain;
      }
      close = close;
    },
  );
  const p = newProject();
  p.audio = [
    {
      id: "gain",
      name: "gain",
      data: "data:audio/wav;base64,AAAA",
      duration: 5,
      lane: "voice",
      start: 0,
      trimIn: 0,
      length: 5,
      volume: 1.5,
      fadeIn: 0,
      fadeOut: 0,
      loop: false,
      muted: false,
      license: "",
    },
  ];
  useStudio.getState().setTime(0);
  useStudio.getState().setPlaying(false);
  const view = render(
    createElement(AudioPlayback, {
      project: p,
      master: false,
      onError: () => {},
    }),
  );
  expect(gain.gain.value).toBe(1.5);
  expect(nodes[0].volume).toBe(1);
  view.rerender(
    createElement(AudioPlayback, {
      project: { ...p, audio: [{ ...p.audio[0], volume: 0.4 }] },
      master: false,
      onError: () => {},
    }),
  );
  expect(gain.gain.value).toBe(0.4);
  view.unmount();
  expect(source.disconnect).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
