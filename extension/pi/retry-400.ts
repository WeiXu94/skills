/**
 * retry-400 — a minimal pi extension that retries ONLY HTTP 400 errors.
 *
 * Scope is deliberately narrow: the ONLY thing this extension retries is an
 * assistant message with `stopReason === "error"` whose errorMessage matches a
 * 400 pattern (HTTP 400 status code, or "bad request"). Nothing else is
 * retried — not 413, not connection errors, not credit errors, not max_tokens,
 * not context overflow, not any catch-all. Those are left entirely to pi-core.
 *
 * Mechanism (ported from monotykamary/pi-retry, trimmed to 400-only):
 *  - agent_end detects a 400 error and kicks off triggerInvisibleContinue().
 *  - triggerInvisibleContinue() owns the retry loop: waits for idle, strips the
 *    error assistant message from agent state, sleeps with exponential backoff,
 *    then resumes the agent loop via agent.prompt([]) — no new message is
 *    injected, so the LLM sees the exact same context (invisible retry).
 *  - Monkey-patches on Agent.subscribe (capture the live Agent), Agent.continue
 *    (cooperate with pi-core's continue loop / "Cannot continue from assistant"),
 *    and AgentSession._prepareRetry (suppress pi-core's built-in retry while our
 *    loop is driving, so the two don't race) keep the loop correct.
 *  - Backoff: 2s → 4s → 8s → ... capped at 60s. Indefinite until success or abort.
 *  - Abort-aware: ESC (turn_end stopReason "aborted") and /new (session_start)
 *    interrupt the loop within 100ms.
 *
 * Config (edit the constants below):
 *   BASE_DELAY_MS        start delay        (default 2000)
 *   MAX_DELAY_MS         backoff cap        (default 60000)
 *   BACKOFF_MULTIPLIER   delay growth       (default 2)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Agent } from "@earendil-works/pi-agent-core";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

// ── Config ────────────────────────────────────────────────────────────── ──
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60000;
const BACKOFF_MULTIPLIER = 2;

// ── 400 detection ──────────────────────────────────────────────────────────
// HTTP 400 Bad Request. "bad request" is the standard 400 reason phrase.
// NOTE: deliberately excludes 413 / "payload too large" — this is 400-only.
const ERROR_400_PATTERNS: RegExp[] = [
  /\b400\b.*status code/i,
  /bad request/i,
];

function isAssistantMessage(m: AgentMessage): m is Extract<AgentMessage, { role: "assistant" }> {
  return m.role === "assistant";
}

/** True only for an error assistant message whose errorMessage looks like a 400. */
function has400Error(message: AgentMessage): boolean {
  if (!isAssistantMessage(message)) return false;
  if (message.stopReason !== "error" || !message.errorMessage) return false;
  return ERROR_400_PATTERNS.some(p => p.test(message.errorMessage!));
}

// ── Small helpers ───────────────────────────────────────────────────────────
function calculateDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

function getLastAssistantMessage(entries: unknown[]): AgentMessage | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i] as { type?: string; message?: AgentMessage };
    if (entry.type === "message" && entry.message?.role === "assistant") {
      return entry.message;
    }
  }
  return undefined;
}

class RetryState {
  private attempt = 0;
  private isRetrying = false;
  private lastErrorMessage = "";
  getAttempt() { return this.attempt; }
  getIsRetrying() { return this.isRetrying; }
  getLastErrorMessage() { return this.lastErrorMessage; }
  startRetry(msg: string) { this.isRetrying = true; this.attempt++; this.lastErrorMessage = msg; }
  endRetry() { this.isRetrying = false; }
  reset() { this.attempt = 0; this.isRetrying = false; this.lastErrorMessage = ""; }
  succeed() { this.attempt = 0; this.isRetrying = false; this.lastErrorMessage = ""; }
}

// ── Capture the live Agent instance (fires on session start + resume) ───────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _agent: Agent | null = null;
const _origSubscribe = Agent.prototype.subscribe as (...args: any[]) => any;
Agent.prototype.subscribe = function (this: Agent, ...args: any[]) {
  _agent = this;
  return _origSubscribe.apply(this, args);
};

// ── State ───────────────────────────────────────────────────────────────────
const state400 = new RetryState();

// Abort flag: set on turn_end "aborted", cleared on session_start / success.
let _userAborted = false;
// Mutex: only one triggerInvisibleContinue in-flight at a time.
let _continueInProgress = false;
// Session generation: bumped on session_start so an in-flight loop exits on /new.
let _sessionGeneration = 0;

// ── Monkey-patch Agent.continue to cooperate with our loop ──────────────────
// While _continueInProgress is true, the session's continue() spins. After the
// loop finishes it calls _origContinue. Also converts "Cannot continue from
// assistant" into prompt([]) for toolUse/length (compaction mid-task), but NOT
// for stopReason "error" — our loop owns error handling.
const _origContinue = Agent.prototype.continue as (this: Agent) => Promise<void>;
Agent.prototype.continue = function (this: Agent) {
  const self = this;
  return (async () => {
    while (_continueInProgress) {
      await new Promise(r => setTimeout(r, 10));
    }
    try {
      return await _origContinue.call(self);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (
        msg.includes("Cannot continue from message role") ||
        msg.includes("Cannot continue from an assistant message")
      ) {
        const lastMsg = self.state.messages[self.state.messages.length - 1];
        if (lastMsg?.role === "assistant") {
          if (lastMsg.stopReason === "error") {
            // Our loop is the error handler — don't start a second path.
            return;
          }
          if (lastMsg.stopReason === "stop" || lastMsg.stopReason === "aborted") {
            return;
          }
          // toolUse / length: agent was mid-task — fall back to prompt([]).
          if (!_continueInProgress) {
            _continueInProgress = true;
            try {
              await self.prompt([]);
            } catch {
              // Agent already processing or other transient error
            } finally {
              _continueInProgress = false;
            }
          }
        }
        return;
      }
      if (msg.includes("Agent is already processing")) {
        return;
      }
      throw e;
    }
  })();
};

// ── Suppress pi-core's built-in retry while our loop is driving ─────────────
// Without this, pi-core's _prepareRetry and our loop race on the same error.
const _origPrepareRetry = (AgentSession.prototype as any)._prepareRetry;
(AgentSession.prototype as any)._prepareRetry = function (this: any, message: any) {
  if (_continueInProgress) {
    return Promise.resolve(false);
  }
  return _origPrepareRetry.call(this, message);
};

// ── Interruptible sleep (polls abort + session generation every 100ms) ───────
function interruptibleSleep(ms: number, generation: number): Promise<boolean> {
  if (ms <= 0) return Promise.resolve(false);
  return new Promise(resolve => {
    const checkInterval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += checkInterval;
      if (_userAborted || _sessionGeneration !== generation) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= ms) {
        clearInterval(timer);
        resolve(false);
      }
    }, checkInterval);
  });
}

// Strip the trailing error assistant message so prompt([]) sends clean context.
function removeErrorFromAgentState(): void {
  if (!_agent) return;
  const messages = _agent.state.messages;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "assistant" && lastMsg.stopReason === "error") {
    _agent.state.messages = messages.slice(0, -1);
  }
}

function lastMessageIs400Error(): boolean {
  if (!_agent) return false;
  const messages = _agent.state.messages;
  const lastMsg = messages[messages.length - 1];
  return !!lastMsg && has400Error(lastMsg);
}

// ── Extension entry ─────────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
  // Reset on successful completion (non-error, non-length). Handle abort.
  pi.on("turn_end", async (event) => {
    const msg = event.message as AgentMessage;
    if (!isAssistantMessage(msg)) return;
    if (msg.stopReason === "aborted") {
      state400.reset();
      _userAborted = true;
      return;
    }
    if (msg.stopReason !== "error" && msg.stopReason !== "length") {
      state400.succeed();
      _userAborted = false;
    }
  });

  // Detect 400 errors on agent_end. Must NOT await sleep here — this runs
  // inside processEvents(); a sleep would freeze the agent. Kick off the loop.
  pi.on("agent_end", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const lastAssistant = getLastAssistantMessage(entries);
    if (!lastAssistant || !isAssistantMessage(lastAssistant)) return;
    if (_userAborted) return;
    if (_continueInProgress) return;

    // ONLY 400. Everything else is left to pi-core.
    if (!has400Error(lastAssistant)) return;

    if (state400.getIsRetrying()) return;
    const errorMsg = lastAssistant.errorMessage || "400 Bad Request";
    state400.startRetry(errorMsg);
    state400.endRetry();
    void triggerInvisibleContinue();
  });

  // Refresh the notify reference for use inside the retry loop.
  // The captured ctx can become stale after session replacement/reload
  // (ctx.newSession / fork / switchSession / reload), and accessing ctx.ui on
  // a stale ctx throws. Notify is non-essential, so guard every call — a
  // stale ctx must never crash the retry loop.
  let _notifyFn: ((message: string, level: "info" | "warning" | "error") => void) | null = null;
  const _safeNotify = (message: string, level: "info" | "warning" | "error") => {
    try {
      _notifyFn?.(message, level);
    } catch {
      // Stale ctx — drop the notification, keep retrying.
    }
  };
  pi.on("agent_end", async (_e, ctx) => {
    _notifyFn = (message, level) => ctx.ui.notify(message, level);
  });
  pi.on("turn_end", async (_e, ctx) => {
    if (!_notifyFn) _notifyFn = (message, level) => ctx.ui.notify(message, level);
  });
  function _notifyRetryAttempt(attempt: number, delayMs: number) {
    _safeNotify(`400 error — retry attempt ${attempt} (backoff ${formatDuration(delayMs)})...`, "info");
  }

  // Minimal manual command: /retry400 [status|reset]
  pi.registerCommand("retry400", {
    description: "Retry 400-only controls: /retry400 (manual trigger), /retry400 status, /retry400 reset",
    handler: async (args, ctx) => {
      const sub = args[0]?.toLowerCase();

      if (sub === "reset") {
        state400.reset();
        _userAborted = false;
        ctx.ui.notify("400 retry counters reset", "info");
        return;
      }

      if (sub === "status") {
        const entries = ctx.sessionManager.getEntries();
        const last = getLastAssistantMessage(entries);
        let status = "=== Retry-400 Status ===\n\n";
        status += "400 Errors:\n";
        status += `  Current attempt: ${state400.getAttempt()}\n`;
        status += `  Is retrying: ${state400.getIsRetrying()}\n`;
        status += `  Last error: ${state400.getLastErrorMessage().substring(0, 100) || "None"}\n\n`;
        status += "Configuration:\n";
        status += `  Base delay: ${BASE_DELAY_MS}ms\n  Max delay: ${MAX_DELAY_MS}ms\n  Multiplier: ${BACKOFF_MULTIPLIER}\n`;
        status += `  Scope: HTTP 400 only (status code 400 / "bad request")\n\n`;
        if (last && isAssistantMessage(last)) {
          status += "Last Assistant Message:\n";
          status += `  Stop reason: ${last.stopReason}\n`;
          status += `  Error message: ${last.errorMessage?.substring(0, 100) || "None"}\n`;
          status += `  Is 400: ${has400Error(last)}`;
        }
        ctx.ui.notify(status, "info");
        return;
      }

      // /retry400 (no args) — manual trigger
      const entries = ctx.sessionManager.getEntries();
      const last = getLastAssistantMessage(entries);
      if (!last || !isAssistantMessage(last)) {
        ctx.ui.notify("No assistant message found to retry", "warning");
        return;
      }
      _userAborted = false;
      if (has400Error(last)) {
        ctx.ui.notify("Manually retrying 400 error...", "info");
        state400.reset();
        void triggerInvisibleContinue();
        return;
      }
      ctx.ui.notify("No 400 error detected (this extension only retries 400s).", "warning");
    },
  });

  // Reset on session switch.
  pi.on("session_start", async () => {
    _sessionGeneration++;
    state400.reset();
    _userAborted = false;
  });

  // ── Retry loop driver ─────────────────────────────────────────────────────
  // Loops: prompt([]) → check result → on 400 again, sleep+backoff, retry.
  // Exits on success, user abort, or session change.
  async function triggerInvisibleContinue() {
    if (!_agent) return;
    if (_userAborted) return;
    if (_continueInProgress) return;
    _continueInProgress = true;
    const myGeneration = _sessionGeneration;

    try {
      await _agent.waitForIdle();
      if (_userAborted || _sessionGeneration !== myGeneration) return;

      let attempt = 0;
      while (true) {
        if (_userAborted || _sessionGeneration !== myGeneration) return;

        removeErrorFromAgentState();
        attempt++;
        const delay = calculateDelay(attempt);
        _notifyRetryAttempt(attempt, delay);

        const interrupted = await interruptibleSleep(delay, myGeneration);
        if (interrupted) return;

        try {
          await _agent.prompt([]);
        } catch {
          // Agent already processing or transient — let the session handle it.
          return;
        }

        if (_userAborted || _sessionGeneration !== myGeneration) return;
        if (!lastMessageIs400Error()) {
          // Success or non-400 terminal state — exit.
          return;
        }
        // Still a 400 — loop back for another attempt.
      }
    } finally {
      if (_sessionGeneration === myGeneration) {
        _continueInProgress = false;
      }
    }
  }
}
