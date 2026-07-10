/**
 * fake-provider — a minimal custom provider for pi that POSTs to a local
 * fake server (fake400-server.mjs) which always returns HTTP 400. Used to test
 * that retry.ts fires on a real 400.
 *
 * The streamSimple fetches the server; on a non-200 response it throws an
 * Error whose message contains "400 status code" + "Bad Request", which
 * retry.ts detects (its "400" error-type patterns) and retries.
 *
 * Usage:
 *   bun /Users/weixu/skills/extension/pi/fake400-server.ts &  # start fake server
 *   pi -ne \
 *     -e /Users/weixu/skills/extension/pi/retry.ts \
 *     -e /Users/weixu/skills/extension/pi/fake-provider.ts \
 *     --provider fake400 --model fake400/test \
 *     -p "say hi"
 */
import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = process.env.FAKE400_BASE_URL ?? "http://127.0.0.1:9876";

function streamFake400(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    try {
      stream.push({ type: "start", partial: output });

      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options?.apiKey ?? "test"}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        }),
        signal: options?.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Message includes "400" + "status code" + "Bad Request" so retry.ts
        // matches it via its "400" error-type patterns.
        throw new Error(
          `Request failed with ${res.status} status code (Bad Request): ${text.slice(0, 200)}`,
        );
      }

      // (Server always returns 400, so we never get here.)
      output.stopReason = "stop";
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("fake400", {
    baseUrl: BASE_URL,
    apiKey: "test",
    api: "fake400-api",
    models: [
      {
        id: "test",
        name: "Fake 400 (always returns 400)",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 8192,
        maxTokens: 1024,
      },
    ],
    streamSimple: streamFake400,
  });
}
