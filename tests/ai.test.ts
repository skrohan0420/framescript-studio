// Mock transport exercises the real provider adapters without a local model or API bill.
import { it, expect, vi, afterEach } from "vitest";
import { generate, models } from "../server/ai";
import { newProject } from "../shared/project";
import {initialWorkflow, plannerInstruction, storyboardSchema, verifyPlan} from "../shared/workflow";
afterEach(() => vi.unstubAllGlobals());
it("plans scenes with a separate schema and omits audio bytes and other scene sources from context", async () => {
  const p = newProject(); p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({...p.workflow.scenes[0], id: "other", html: "PRIVATE-OTHER-SOURCE"});
  p.audio = [{id:"voice",name:"Voice",data:"data:audio/wav;base64,PRIVATE-AUDIO-BYTES",duration:1,lane:"voice",start:0,trimIn:0,length:1,volume:1,fadeIn:0,fadeOut:0,loop:false,muted:false,license:"Test"}];
  const plan = {scenes:[{title:"Hello",narration:"Hello world.",visual:"Opening title",duration:3,template:"headline"}]};
  const mock = vi.fn().mockResolvedValue(Response.json({message:{content:JSON.stringify(plan)}}));vi.stubGlobal("fetch",mock);
  const result = await generate({provider:"ollama",model:"test"},{project:p,prompt:"Hello world.",images:[],history:[]},new AbortController().signal,undefined,{instruction:plannerInstruction,schema:storyboardSchema});
  expect(verifyPlan("Hello world.",result)).toEqual(plan);
  const body = JSON.parse(mock.mock.calls[0][1].body);expect(body.messages[0].content).toBe(plannerInstruction);
  expect(mock.mock.calls[0][1].body).not.toContain("PRIVATE-AUDIO-BYTES");expect(mock.mock.calls[0][1].body).not.toContain("PRIVATE-OTHER-SOURCE");
});
it("does not send model discovery requests without an OpenAI API key", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(models({ provider: "openai", model: "" })).rejects.toThrow(
    "API key is missing",
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("Ollama model discovery reports vision capability", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ name: "local" }] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ capabilities: ["completion", "vision"] }),
        ),
      ),
  );
  expect(await models({ provider: "ollama", model: "" })).toEqual([
    { name: "local", vision: true },
  ]);
});
it("Ollama applies validated partial code and passes context", async () => {
  const mock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        message: {
          content: JSON.stringify({
            action: "update",
            css: "body{color:red}",
            explanation: "Recolor",
          }),
        },
      }),
    ),
  );
  vi.stubGlobal("fetch", mock);
  const result = await generate(
    { provider: "ollama", model: "test" },
    { project: newProject(), prompt: "Recolor", images: [], history: [] },
    new AbortController().signal,
  );
  expect(result.css).toContain("red");
  const body = JSON.parse(mock.mock.calls[0][1].body);
  expect(body.messages.at(-1).content).toContain("Recolor");
  expect(body.stream).toBe(false);
});
it("OpenAI keys stay in request headers and malformed responses are rejected", async () => {
  const mock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"action":"invalid"}' } }],
      }),
    ),
  );
  vi.stubGlobal("fetch", mock);
  await expect(
    generate(
      { provider: "openai", model: "user-chosen", key: "secret-test" },
      { project: newProject(), prompt: "Animate", images: [], history: [] },
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(mock.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer secret-test",
  );
  expect(mock.mock.calls[0][1].body).not.toContain("secret-test");
});
it("cancellation propagates to the provider request", async () => {
  const controller = new AbortController();
  controller.abort();
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => Promise.reject(options.signal.reason)),
  );
  await expect(
    generate(
      { provider: "ollama", model: "test" },
      { project: newProject(), prompt: "Animate", images: [], history: [] },
      controller.signal,
    ),
  ).rejects.toThrow();
});
