#!/usr/bin/env node

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const queryIndex = args.indexOf("--query");
const query = queryIndex >= 0 ? (args[queryIndex + 1] ?? "").toLowerCase() : "";

const apiKey = process.env.WATSONX_API_KEY;
const baseUrl = (process.env.WATSONX_URL ?? "https://us-south.ml.cloud.ibm.com").replace(
  /\/+$/,
  "",
);
const version = process.env.WATSONX_API_VERSION ?? "2025-02-11";

if (!apiKey) {
  console.error("Missing WATSONX_API_KEY in the root .env");
  process.exit(1);
}

async function iamToken() {
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
    throw new Error(`IAM token request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

function lifecycleOf(resource) {
  const value = resource.lifecycle?.[0]?.id ?? resource.lifecycle?.[0] ?? "available";
  return typeof value === "string" ? value : "available";
}

async function main() {
  const token = await iamToken();

  const url = new URL(`${baseUrl}/ml/v1/foundation_model_specs`);
  url.searchParams.set("version", version);
  url.searchParams.set("limit", "200");

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `foundation_model_specs failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const resources = Array.isArray(data.resources) ? data.resources : [];

  const models = resources
    .map((resource) => ({
      id: resource.model_id ?? resource.modelId ?? "",
      label: resource.label ?? "",
      provider: resource.provider ?? "",
      lifecycle: lifecycleOf(resource),
      functions: Array.isArray(resource.functions)
        ? resource.functions.map((fn) => fn.id ?? fn).join(", ")
        : "",
    }))
    .filter((model) => model.id)
    .filter(
      (model) =>
        !query ||
        model.id.toLowerCase().includes(query) ||
        model.label.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query),
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  if (asJson) {
    console.log(JSON.stringify(models, null, 2));
    return;
  }

  if (models.length === 0) {
    console.log(`No models matched${query ? ` "${query}"` : ""}.`);
    return;
  }

  const current = process.env.WATSONX_MODEL_ID ?? "ibm/granite-4-h-small";
  const width = Math.max(24, ...models.map((model) => model.id.length));

  console.log(`${models.length} model(s) available at ${baseUrl}\n`);
  for (const model of models) {
    const marker = model.id === current ? "  <- WATSONX_MODEL_ID" : "";
    console.log(
      `${model.id.padEnd(width)}  ${model.lifecycle.padEnd(12)}  ${model.provider}${marker}`,
    );
  }

  console.log("\nSet WATSONX_MODEL_ID to one of these ids. Prefer chat-capable Granite models.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
