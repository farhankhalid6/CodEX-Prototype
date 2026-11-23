import { aiRequestSchema } from "@codex/shared";
import { authenticateRoomRequest } from "@/lib/api-auth";
import { buildPromptMessages } from "@/lib/ai-prompt";
import { aiConfigured, aiLimits, envOr } from "@/lib/env";
import { clientIp, fail, hashIp, parseJson } from "@/lib/http";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getRoomBySlug } from "@/lib/room-queries";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { streamWatsonx } from "@/lib/watsonx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = await parseJson(request, aiRequestSchema);
  if (!parsed.ok) return parsed.response;

  const input = parsed.data;
  const limits = aiLimits();

  if (input.code.length > limits.maxInputChars) {
    return fail(`Selection is too long (max ${limits.maxInputChars} characters)`, 413);
  }

  if (!aiConfigured()) {
    return fail("The AI explainer is not configured on this deployment", 503);
  }

  const room = await getRoomBySlug(input.roomId);
  if (!room) return fail("Room not found", 404);

  const actor = await authenticateRoomRequest(request, room);
  if (!actor) return fail("Not allowed", 403);

  const ipHash = hashIp(clientIp(request));
  const rate = await checkAiRateLimit({ actorId: actor.sub, ipHash });

  if (!rate.allowed) {
    await supabaseAdmin().from("ai_requests").insert({
      user_id: actor.userId,
      room_id: room.id,
      actor_id: actor.sub,
      ip_hash: ipHash,
      action: input.action,
      input_chars: input.code.length,
      status: "rate_limited",
    });

    return fail("Rate limit reached. Try again in a few minutes.", 429, {
      reason: rate.reason,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const modelId = envOr("WATSONX_MODEL_ID", "ibm/granite-4-h-small");

  const { data: requestRow } = await supabaseAdmin()
    .from("ai_requests")
    .insert({
      user_id: actor.userId,
      room_id: room.id,
      actor_id: actor.sub,
      ip_hash: ipHash,
      action: input.action,
      model_id: modelId,
      input_chars: input.code.length,
      status: "pending",
    })
    .select("id")
    .single();

  const requestId: string | null = requestRow?.id ?? null;

  const finish = async (status: "ok" | "error", tokensUsed: number) => {
    if (!requestId) return;
    await supabaseAdmin()
      .from("ai_requests")
      .update({ status, tokens_used: tokensUsed })
      .eq("id", requestId);
  };

  const messages = buildPromptMessages(input.action, input.language, input.code);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let tokens = 0;

      try {
        for await (const chunk of streamWatsonx(messages, request.signal)) {
          if (chunk.delta) send({ type: "delta", text: chunk.delta });
          if (chunk.tokens && chunk.tokens > tokens) tokens = chunk.tokens;
        }

        send({ type: "done", tokensUsed: tokens });
        await finish("ok", tokens);
      } catch (error) {
        const aborted = request.signal.aborted;
        console.error("[ai] generation failed", error);

        if (!aborted) {
          send({ type: "error", message: "The model call failed. Please try again." });
        }
        await finish("error", tokens);
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
