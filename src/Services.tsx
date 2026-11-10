import { useStatusActivity } from "./editor-status";
import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, ShieldCheck, Plug } from "lucide-react";
import { Modal } from "./components";
import { bridge } from "./bridge";
import type { ServiceId, ServiceStatus } from "../shared/services";
const info: Record<
  ServiceId,
  {
    name: string;
    description: string;
    url: string;
    usage: string;
    quota: string;
  }
> = {
  chatgpt: {
    name: "ChatGPT",
    description: "Animation code & scene planning · preferred account sign-in",
    url: "https://chatgpt.com",
    usage: "https://chatgpt.com/#settings/Usage",
    quota:
      "Remaining plan usage is not exposed by this integration. Check ChatGPT for current limits and resets.",
  },
  eleven: {
    name: "ElevenLabs",
    description: "Narration, voices & sound effects",
    url: "https://elevenlabs.io/app",
    usage: "https://elevenlabs.io/app/subscription",
    quota:
      "Connect a key and refresh to read the subscription balance. Model costs vary; remaining credits are not a guaranteed number of generations.",
  },
  flow: {
    name: "Google Flow",
    description: "Generate images with your mascot references",
    url: "https://labs.google/fx/tools/flow",
    usage: "https://labs.google/fx/tools/flow",
    quota:
      "Flow credits and sign-in status cannot be read here. Open Flow to check them, then import downloaded variants.",
  },
  gemini: {
    name: "Gemini API",
    description: "Scene animation, storyboard planning & image generation",
    url: "https://aistudio.google.com",
    usage: "https://aistudio.google.com/usage",
    quota:
      "Remaining project/model quota is not exposed by this connection. Check AI Studio. Flow membership does not configure Gemini API access.",
  },
  openai: {
    name: "OpenAI API",
    description: "Secondary option · separately billed API access",
    url: "https://platform.openai.com/api-keys",
    usage: "https://platform.openai.com/usage",
    quota:
      "Account balance is unavailable through this connection. Check the API dashboard. This does not share ChatGPT plan usage.",
  },
  ollama: {
    name: "Ollama",
    description: "Local models · no account or API key",
    url: "https://ollama.com",
    usage: "https://ollama.com",
    quota:
      "Local inference has no provider credit balance. Available capacity depends on your machine and installed models.",
  },
};
type Props = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  chatgpt: {
    connected: boolean;
    pending: boolean;
    email?: string;
    error?: string;
  };
  connecting: boolean;
  onConnect: (fresh?: boolean, remember?: boolean) => Promise<void>;
  onChanged: () => Promise<void>;
  authError: string;
};
export function Services({
  open,
  onClose,
  busy,
  chatgpt,
  connecting,
  onConnect,
  onChanged,
  authError,
}: Props) {
  const [services, setServices] = useState<ServiceStatus[]>([]),
    [keys, setKeys] = useState<Partial<Record<ServiceId, string>>>({}),
    [working, setWorking] = useState(""),
    [error, setError] = useState("");
  const [remember, setRemember] = useState(
    () => localStorage.getItem("framescript.remember-connections") !== "false",
  );
  useStatusActivity(
    open && working
      ? working === "refresh"
        ? "Refreshing service connections…"
        : `Updating ${info[working as ServiceId]?.name ?? "connection"}…`
      : "",
  );
  const refresh = async () => setServices(await bridge.call("servicesStatus"));
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const poll = () =>
      void bridge
        .call("servicesStatus")
        .then((value) => {
          if (alive) setServices(value);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
      setKeys({});
    };
  }, [open]);
  const action = async (id: string, fn: () => Promise<void>) => {
    if (working || busy) return;
    setWorking(id);
    setError("");
    try {
      await fn();
      await refresh();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking("");
    }
  };
  const check = async (id: ServiceId) => {
    await bridge.call("serviceCheck", id);
  };
  return (
    <Modal title="Services & connections" wide open={open} onClose={onClose}>
      <div className="services-intro">
        <div>
          <h3>One place for every connection</h3>
          <p>
            Use account sign-in where supported. API keys are a secondary setup
            option. FrameScript keeps using the service you select; it never
            switches to a paid provider automatically.
          </p>
        </div>
        <button
          disabled={!!working || busy}
          onClick={() =>
            void action("refresh", async () => {
              await Promise.allSettled(
                services
                  .filter((s) => s.configured && s.id !== "flow")
                  .map((s) => check(s.id)),
              );
            })
          }
        >
          <RefreshCw size={14} />
          Refresh usage & status
        </button>
      </div>
      <label className="services-security">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            localStorage.setItem(
              "framescript.remember-connections",
              String(e.target.checked),
            );
          }}
        />
        Remember new connections on this Windows account
      </label>
      <p className="services-security">
        <ShieldCheck size={15} />
        Remembered credentials use Windows-protected encryption and restore
        after restart. Session-only connections clear when Node stops.
        Credentials are excluded from projects and Git.
      </p>
      {(error || authError) && (
        <p role="alert" className="workflow-error">
          {error || authError}
        </p>
      )}
      <div className="services-grid">
        {services.map((service) => {
          const meta = info[service.id],
            id = service.id,
            isGPT = id === "chatgpt",
            configured = isGPT ? chatgpt.connected : service.configured;
          const state =
            id === "flow"
              ? "External handoff"
              : isGPT && chatgpt.pending
                ? "Signing in…"
                : service.check?.state === "error"
                  ? "Needs attention"
                  : service.check?.state === "ready" && configured
                    ? "Connected"
                    : isGPT && configured
                      ? "Signed in"
                      : configured
                        ? id === "ollama"
                          ? "Not checked"
                          : "Configured · not checked"
                        : "Not connected";
          return (
            <article
              className="service-card"
              key={id}
              aria-label={`${meta.name} service`}
            >
              <div className="service-heading">
                <div>
                  <h3>{meta.name}</h3>
                  <p>{meta.description}</p>
                </div>
                <span
                  className={
                    "service-badge " +
                    (service.check?.state === "error"
                      ? "error"
                      : configured
                        ? "ready"
                        : "")
                  }
                >
                  {state}
                </span>
              </div>
              {isGPT && chatgpt.connected && (
                <strong>
                  Connected{chatgpt.email ? " · " + chatgpt.email : ""}
                </strong>
              )}
              <div className="service-usage">
                <span className="service-label">Available usage</span>
                {service.check?.quota && configured ? (
                  <>
                    <strong>
                      {service.check.quota.remaining.toLocaleString()} credits
                      remaining
                    </strong>
                    <progress
                      aria-label="ElevenLabs credits remaining"
                      max={Math.max(1, service.check.quota.limit)}
                      value={service.check.quota.remaining}
                    />
                    <small>
                      {service.check.quota.used.toLocaleString()} used /{" "}
                      {service.check.quota.limit.toLocaleString()} included ·{" "}
                      {service.check.quota.tier ?? "Subscription"}
                    </small>
                    {service.check.quota.resetAt && (
                      <small>
                        Resets{" "}
                        {new Date(
                          service.check.quota.resetAt * 1000,
                        ).toLocaleString()}
                      </small>
                    )}
                    <small>
                      Usage-based overages may be available in your provider
                      account.
                    </small>
                  </>
                ) : (
                  <>
                    <strong>
                      {id === "ollama" ? "Local capacity" : "Unavailable"}
                    </strong>
                    <small>{service.check?.quotaError ?? meta.quota}</small>
                  </>
                )}
              </div>
              {service.storageError && (
                <p role="alert">{service.storageError}</p>
              )}
              {service.remembered && (
                <small>Remembered on this Windows account</small>
              )}
              {service.check && (
                <p className="service-check-result">
                  {service.check.message}
                  <small>
                    Last checked{" "}
                    {new Date(service.check.checkedAt).toLocaleString()}
                  </small>
                </p>
              )}
              {isGPT && chatgpt.error && <p role="alert">{chatgpt.error}</p>}
              <div className="service-actions">
                {isGPT ? (
                  <>
                    {!chatgpt.connected && !chatgpt.pending && (
                      <button
                        className="primary"
                        disabled={connecting || !!working || busy}
                        onClick={() => void onConnect(false, remember)}
                      >
                        Continue with ChatGPT
                      </button>
                    )}
                    {(chatgpt.connected || chatgpt.pending) && (
                      <button
                        disabled={!!working || busy}
                        onClick={() =>
                          void action(id, async () => {
                            const result =
                              await bridge.call("chatgptDisconnect");
                            if (result.warning) setError(result.warning);
                          })
                        }
                      >
                        {chatgpt.pending ? "Cancel sign-in" : "Sign out"}
                      </button>
                    )}
                    {!chatgpt.pending && (
                      <button
                        disabled={connecting || !!working || busy}
                        onClick={() => void onConnect(true, remember)}
                      >
                        {chatgpt.connected
                          ? "Use another account"
                          : "Use a different account"}
                      </button>
                    )}
                  </>
                ) : (
                  <a
                    className="external-button"
                    href={meta.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} />
                    {id === "flow"
                      ? "Continue in Google Flow"
                      : id === "ollama"
                        ? "Install / manage Ollama"
                        : id === "openai"
                          ? "Get an API key"
                          : `Open ${id === "gemini" ? "Google AI Studio" : "ElevenLabs account"}`}
                  </a>
                )}
                {id !== "flow" && (
                  <button
                    disabled={!configured || !!working || busy}
                    onClick={() => void action(id, () => check(id))}
                  >
                    <Plug size={13} />
                    Check connection
                  </button>
                )}
                {id !== "ollama" && (
                  <a href={meta.usage} target="_blank" rel="noreferrer">
                    {isGPT ? "Manage usage" : "Usage dashboard"} ↗
                  </a>
                )}
              </div>
              {(["eleven", "gemini", "openai"] as string[]).includes(id) && (
                <details className="service-key">
                  <summary>API key setup · secondary</summary>
                  <p>
                    {id === "eleven"
                      ? "Website sign-in does not authorize the voice API. Add a restricted ElevenLabs key for in-app generation."
                      : id === "gemini"
                        ? "Google/Flow website sign-in does not authorize the Gemini API. Use a key from Google AI Studio."
                        : "Prefer Continue with ChatGPT above for plan usage. Choose OpenAI API explicitly to use separately billed API credits."}
                  </p>
                  <p>
                    Credential status:{" "}
                    <strong>
                      {configured
                        ? service.source === "environment"
                          ? "Server environment key configured"
                          : service.remembered
                            ? "Windows-protected key saved"
                            : "Session key configured"
                        : "No key configured"}
                    </strong>
                  </p>
                  <label className="field">
                    <span>{meta.name} API key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={keys[id] ?? ""}
                      onChange={(e) =>
                        setKeys({ ...keys, [id]: e.target.value })
                      }
                      placeholder="Paste a key"
                    />
                  </label>
                  <div className="service-actions">
                    <button
                      disabled={!keys[id]?.trim() || !!working || busy}
                      onClick={() =>
                        void action(id, async () => {
                          if (id === "openai")
                            await bridge.call(
                              "credentials",
                              keys[id]!.trim(),
                              remember,
                            );
                          else if (id === "gemini" || id === "eleven")
                            await bridge.call(
                              "mediaCredentials",
                              id,
                              keys[id]!.trim(),
                              remember,
                            );
                          setKeys((k) => ({ ...k, [id]: "" }));
                          await check(id);
                        })
                      }
                    >
                      Save & check key
                    </button>
                    {service.source === "session" && (
                      <button
                        disabled={!!working || busy}
                        onClick={() =>
                          void action(id, async () => {
                            await bridge.call("serviceRemove", id);
                          })
                        }
                      >
                        Forget connection
                      </button>
                    )}
                  </div>
                  {service.source === "environment" && (
                    <small>
                      Remove environment credentials in the server configuration
                      and restart Node.
                    </small>
                  )}
                </details>
              )}
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
