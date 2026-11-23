export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function siteUrl(): string {
  return envOr("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/+$/, "");
}

export function aiConfigured(): boolean {
  return Boolean(
    process.env.WATSONX_API_KEY && (process.env.WATSONX_SPACE_ID || process.env.WATSONX_PROJECT_ID),
  );
}

export function watsonxSettings() {
  const spaceId = envOr("WATSONX_SPACE_ID", "");
  const projectId = envOr("WATSONX_PROJECT_ID", "");

  if (!spaceId && !projectId) {
    throw new Error("Missing environment variable: WATSONX_SPACE_ID or WATSONX_PROJECT_ID");
  }

  return {
    apiKey: env("WATSONX_API_KEY"),
    scope: spaceId ? { space_id: spaceId } : { project_id: projectId },
    baseUrl: envOr("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").replace(/\/+$/, ""),
    modelId: envOr("WATSONX_MODEL_ID", "ibm/granite-4-h-small"),
    apiVersion: envOr("WATSONX_API_VERSION", "2025-02-11"),
    style: envOr("WATSONX_API_STYLE", "chat") === "generation" ? "generation" : "chat",
    maxNewTokens: numberEnv("WATSONX_MAX_NEW_TOKENS", 900),
  } as const;
}

export function aiLimits() {
  return {
    perUser: numberEnv("AI_RATE_LIMIT_USER", 12),
    perIp: numberEnv("AI_RATE_LIMIT_IP", 20),
    windowMinutes: numberEnv("AI_RATE_WINDOW_MINUTES", 10),
    maxInputChars: numberEnv("AI_MAX_INPUT_CHARS", 8000),
    dailyTokenBudget: numberEnv("AI_DAILY_TOKEN_BUDGET", 250_000),
  };
}
