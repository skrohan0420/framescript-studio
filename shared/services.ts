export const serviceIds = [
  "chatgpt",
  "eleven",
  "flow",
  "gemini",
  "openai",
  "ollama",
] as const;
export type ServiceId = (typeof serviceIds)[number];
export type ServiceCheck = {
  state: "ready" | "error";
  checkedAt: string;
  message: string;
  quota?: {
    used: number;
    limit: number;
    remaining: number;
    resetAt?: number;
    tier?: string;
  };
  quotaError?: string;
};
export type ServiceStatus = {
  id: ServiceId;
  configured: boolean;
  remembered?: boolean;
  rememberSupported?: boolean;
  storageError?: string;
  source: "account" | "session" | "environment" | "none" | "local" | "external";
  check?: ServiceCheck;
};
