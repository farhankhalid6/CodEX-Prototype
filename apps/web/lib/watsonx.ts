import { flattenMessages, type ChatMessage } from "@/lib/ai-prompt";
import { watsonxSettings } from "@/lib/env";

export interface StreamChunk {
  delta?: string;
  tokens?: number;
}

interface IamResponse {
  access_token: string;
  expires_in: number;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCacheEntry | null = null;

async function getIamToken(apiKey: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`IAM token request failed (${response.status})`);
  }

  const data = (await response.json()) as IamResponse;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

function extractText(event: unknown): string {
  const value = event as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    results?: Array<{ generated_text?: string }>;
  };

  const choice = value.choices?.[0];
  if (choice?.delta?.content) return choice.delta.content;
  if (choice?.message?.content) return choice.message.content;

  const generated = value.results?.[0]?.generated_text;
  return typeof generated === "string" ? generated : "";
}

function extractTokens(event: unknown): number {
  const value = event as {
    usage?: { completion_tokens?: number; generated_token_count?: number };
    results?: Array<{ generated_token_count?: number }>;
  };

  return (
    value.usage?.completion_tokens ??
    value.usage?.generated_token_count ??
    value.results?.[0]?.generated_token_count ??
    0
  );
}

export async function* streamWatsonx(
  messages: ChatMessage[],
  signal: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const settings = watsonxSettings();
  const token = await getIamToken(settings.apiKey);
  const isChat = settings.style === "chat";

  const endpoint = `${settings.baseUrl}/ml/v1/text/${
    isChat ? "chat_stream" : "generation_stream"
  }?version=${encodeURIComponent(settings.apiVersion)}`;

  const body = isChat
    ? {
        model_id: settings.modelId,
        ...settings.scope,
        messages,
        parameters: {
          max_new_tokens: settings.maxNewTokens,
          temperature: 0.2,
          top_p: 0.9,
          repetition_penalty: 1.05,
        },
      }
    : {
        model_id: settings.modelId,
        ...settings.scope,
        input: flattenMessages(messages),
        parameters: {
          max_new_tokens: settings.maxNewTokens,
          temperature: 0.2,
          top_p: 0.9,
          repetition_penalty: 1.05,
        },
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `watsonx request failed (${response.status})${detail ? `: ${detail.slice(0, 400)}` : ""}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = "";
  let maxTokens = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const data = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("");

        if (data && data !== "[DONE]") {
          let event: unknown;
          try {
            event = JSON.parse(data);
          } catch {
            event = null;
          }

          if (event) {
            const text = extractText(event);
            if (text) {
              let delta = text;
              if (emitted && text.startsWith(emitted) && text.length > emitted.length) {
                delta = text.slice(emitted.length);
              }
              emitted += delta;
              if (delta) yield { delta };
            }

            const tokens = extractTokens(event);
            if (tokens > maxTokens) {
              maxTokens = tokens;
              yield { tokens };
            }
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
