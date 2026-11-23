import { afterEach, describe, expect, it, vi } from "vitest";
import { aiConfigured, watsonxSettings } from "./env";

const WATSONX_KEYS = ["WATSONX_API_KEY", "WATSONX_SPACE_ID", "WATSONX_PROJECT_ID"] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiConfigured", () => {
  it("is false without an API key", () => {
    for (const key of WATSONX_KEYS) vi.stubEnv(key, "");
    vi.stubEnv("WATSONX_SPACE_ID", "space-id");
    expect(aiConfigured()).toBe(false);
  });

  it("is true with an API key and a space id", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "space-id");
    vi.stubEnv("WATSONX_PROJECT_ID", "");
    expect(aiConfigured()).toBe(true);
  });

  it("is true with an API key and a project id fallback", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "");
    vi.stubEnv("WATSONX_PROJECT_ID", "project-id");
    expect(aiConfigured()).toBe(true);
  });
});

describe("watsonxSettings", () => {
  it("prefers a deployment space over a project", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "space-id");
    vi.stubEnv("WATSONX_PROJECT_ID", "project-id");
    expect(watsonxSettings().scope).toEqual({ space_id: "space-id" });
  });

  it("falls back to a project when no space is configured", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "");
    vi.stubEnv("WATSONX_PROJECT_ID", "project-id");
    expect(watsonxSettings().scope).toEqual({ project_id: "project-id" });
  });

  it("throws when neither scope is configured", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "");
    vi.stubEnv("WATSONX_PROJECT_ID", "");
    expect(() => watsonxSettings()).toThrow(/WATSONX_SPACE_ID or WATSONX_PROJECT_ID/);
  });

  it("uses the current chat-capable model by default", () => {
    vi.stubEnv("WATSONX_API_KEY", "test-key");
    vi.stubEnv("WATSONX_SPACE_ID", "space-id");
    vi.stubEnv("WATSONX_MODEL_ID", "");
    expect(watsonxSettings().modelId).toBe("ibm/granite-4-h-small");
  });
});
