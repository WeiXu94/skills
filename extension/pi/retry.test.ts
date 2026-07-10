/**
 * retry.test.ts — integration test for the retry pi extension.
 *
 * OUT-OF-PROCESS for the agent, IN-PROCESS for the server:
 *   - The fake 400 HTTP server runs IN-PROCESS via Bun.serve (no subprocess).
 *   - `pi` runs as a separate process (it must: retry.ts only runs inside
 *     pi). It loads fake-provider.ts, which hits the in-process server over
 *     HTTP at the URL passed via FAKE400_BASE_URL.
 *
 * Flow:
 *   1. start an in-process Bun.serve that always returns 400 (port 0 = OS picks)
 *   2. spawn `pi` with retry.ts + fake-provider.ts, FAKE400_BASE_URL set
 *   3. let pi retry for RUN_SECS, then assert:
 *        - pi did not crash (no stack trace referencing retry.ts)
 *        - the server received >= MIN_REQUESTS requests (1 initial + retries)
 *
 * Run:  bun test retry.test.ts
 *       RUN_SECS=20 MIN_REQUESTS=4 bun test retry.test.ts
 */
import { test, expect, beforeEach, afterEach } from "bun:test";

const HERE = import.meta.dir;
const RETRY = `${HERE}/retry.ts`;
const PROVIDER = `${HERE}/fake-provider.ts`;

const RUN_SECS = Number(process.env.RUN_SECS ?? 12);        // how long to let pi retry
const MIN_REQUESTS = Number(process.env.MIN_REQUESTS ?? 3); // 1 initial + 2 retries

type Proc = ReturnType<typeof Bun.spawn>;

let server: ReturnType<typeof Bun.serve> | null = null;
let piProc: Proc | null = null;
let piOut: string[] = [];
let requestCount = 0;

/** In-process fake 400 server: responds 400 to every request, counts hits. */
function startFake400Server(): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: 0, // OS picks a free port
    hostname: "127.0.0.1",
    fetch(req) {
      requestCount++;
      console.error(`[fake400] <- ${req.method} ${req.url}  (returning 400 Bad Request)`);
      return new Response(
        JSON.stringify({
          error: {
            message: "Bad Request: invalid request payload",
            type: "invalid_request_error",
            code: "bad_request",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    },
  });
}

/** Read a Bun subprocess stream incrementally into a string sink. */
function drain(stream: ReadableStream<Uint8Array> | null, sink: string[]) {
  if (!stream) return;
  const reader = stream.getReader();
  const dec = new TextDecoder();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sink.push(dec.decode(value, { stream: true }));
      }
    } catch {
      // stream closed / process killed
    }
  })();
}

/** Spawn a process with Bun, piping stdout+stderr into a sink. */
function spawnBun(cmd: string[], env: Record<string, string>, sink: string[]): Proc {
  const proc = Bun.spawn({ cmd, stdout: "pipe", stderr: "pipe", env });
  drain(proc.stdout, sink);
  drain(proc.stderr, sink);
  return proc;
}

async function killAndWait(p: Proc | null) {
  if (!p || p.exitCode !== null) return;
  try { p.kill("SIGTERM"); } catch {}
  await Promise.race([p.exited, new Promise((r) => setTimeout(r, 3000))]);
}

beforeEach(() => {
  piOut = [];
  requestCount = 0;
});

afterEach(async () => {
  await killAndWait(piProc);
  piProc = null;
  if (server) {
    server.stop(true); // stop immediately, don't wait for in-flight
    server = null;
  }
});

test("fake 400 server (in-process) returns 400", async () => {
  server = startFake400Server();
  const url = `http://127.0.0.1:${server.port}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  expect(res.status).toBe(400);
  expect(requestCount).toBe(1);
});

test("retry fires repeated retries on a 400 (no crash)", async () => {
  // 1. Start the in-process fake 400 server.
  server = startFake400Server();
  const baseUrl = `http://127.0.0.1:${server.port}`;

  // 2. Spawn pi with retry + fake400 provider, pointing it at our server.
  //    -ne disables extension discovery (avoids installed @monotykamary/pi-retry
  //    retrying everything and muddying the 400-only test).
  //    FAKE400_BASE_URL tells the provider where to send requests.
  piProc = spawnBun(
    [
      "pi",
      "-ne",
      "-e", RETRY,
      "-e", PROVIDER,
      "--provider", "fake400",
      "--model", "fake400/test",
      "--no-tools",
      "-p", "say hi",
    ],
    { ...process.env, FAKE400_BASE_URL: baseUrl },
    piOut,
  );

  // 3. Let it retry for RUN_SECS.
  await new Promise((r) => setTimeout(r, RUN_SECS * 1000));
  await killAndWait(piProc);

  // 4. Assertions.
  const piText = piOut.join("");

  // (a) Extension must not have crashed — no stack frame from retry.ts.
  expect(/at .*retry\.ts/.test(piText)).toBe(false);

  // (b) Server saw at least MIN_REQUESTS requests => the retry loop drove the agent.
  expect(requestCount).toBeGreaterThanOrEqual(MIN_REQUESTS);

  console.log(
    `  requests_seen: ${requestCount} (>= ${MIN_REQUESTS} within ${RUN_SECS}s)\n` +
    `  backoff: 2s -> 4s -> 8s -> ... cap 60s`,
  );
}, (RUN_SECS + 10) * 1000); // test timeout = run window + grace
