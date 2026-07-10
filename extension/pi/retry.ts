/**
 * retry — a minimal pi extension that retries assistant errors by type.
 *
 * An extensible error-type registry (`ERROR_TYPES` below) defines which errors
 * are retryable. Each entry is a named category with a set of regex patterns
 * matched against the assistant message's `errorMessage`. Today the only
 * registered type is "400" (HTTP 400 Bad Request); to handle another error
 * case, append an entry to `ERROR_TYPES`.
 *
 * Mechanism (ported from monotykamary/pi-retry):
 *  - agent_end detects a retryable error and kicks off triggerInvisibleContinue().
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

// ── Retryable error types ───────────────────────────────────────────────────
// To add a new retryable error case, append an entry here. An assistant
// message with stopReason === "error" is retried iff its errorMessage matches
// at least one pattern of any registered type.
interface ErrorTypeDef {
  /** Short label shown in status/logs, e.g. "400". */
  name: string;
  /** Human-readable description for the status panel. */
  description: string;
  /** Regex patterns tested against errorMessage (case-insensitive where flagged). */
  patterns: RegExp[];
}

const ERROR_TYPES: ErrorTypeDef[] = [
  {
    name: "400",
    description: "HTTP 400 Bad Request (status code 400 / \"bad request\")",
    patterns: [
      /\b400\b.*status code/i,
      /bad request/i,
    ],
  },
  // ── Add more error types below, e.g. ────────────────────────────────────
  // {
  //   name: "429",
  //   description: "HTTP 429 Too Many Requests (rate limit)",
  //   patterns: [/\b429\b.*status code/i, /rate limit/i, /too many requests/i],
  // },
];

function isAssistantMessage(m: AgentMessage): m is Extract<AgentMessage, { role: "assistant" }> {
  return m.role === "assistant";
}

/** Returns the matching error type, or undefined if the message isn't a retryable error. */
function matchErrorType(message: AgentMessage): ErrorTypeDef | undefined {
  if (!isAssistantMessage(message)) return undefined;
  if (message.stopReason !== "error" || !message.errorMessage) return undefined;
  return ERROR_TYPES.find(t => t.patterns.some(p => p.test(message.errorMessage!)));
}

/** True only for an error assistant message whose errorMessage matches a registered type. */
function isRetryableError(message: AgentMessage): boolean {
  return matchErrorType(message) !== undefined;
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
  private lastErrorType = "";
  getAttempt() { return this.attempt; }
  getIsRetrying() { return this.isRetrying; }
  getLastErrorMessage() { return this.lastErrorMessage; }
  getLastErrorType() { return this.lastErrorType; }
  startRetry(type: string, msg: string) { this.isRetrying = true; this.attempt++; this.lastErrorType = type; this.lastErrorMessage = msg; }
  endRetry() { this.isRetrying = false; }
  reset() { this.attempt = 0; this.isRetrying = false; this.lastErrorMessage = ""; this.lastErrorType = ""; }
  succeed() { this.attempt = 0; this.isRetrying = false; this.lastErrorMessage = ""; this.lastErrorType = ""; }
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
const state = new RetryState();

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

function lastMessageIsRetryableError(): boolean {
  if (!_agent) return false;
  const messages = _agent.state.messages;
  const lastMsg = messages[messages.length - 1];
  return !!lastMsg && isRetryableError(lastMsg);
}

// ── Extension entry ─────────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
  // Reset on successful completion (non-error, non-length). Handle abort.
  pi.on("turn_end", async (event) => {
    const msg = event.message as AgentMessage;
    if (!isAssistantMessage(msg)) return;
    if (msg.stopReason === "aborted") {
      state.reset();
      _userAborted = true;
      return;
    }
    if (msg.stopReason !== "error" && msg.stopReason !== "length") {
      state.succeed();
      _userAborted = false;
    }
  });

  // Detect retryable errors on agent_end. Must NOT await sleep here — this runs
  // inside processEvents(); a sleep would freeze the agent. Kick off the loop.
  pi.on("agent_end", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const lastAssistant = getLastAssistantMessage(entries);
    if (!lastAssistant || !isAssistantMessage(lastAssistant)) return;
    if (_userAborted) return;
    if (_continueInProgress) return;

    // Only registered error types. Everything else is left to pi-core.
    const matched = matchErrorType(lastAssistant);
    if (!matched) return;

    if (state.getIsRetrying()) return;
    const errorMsg = lastAssistant.errorMessage || matched.description;
    state.startRetry(matched.name, errorMsg);
    state.endRetry();
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
  function _notifyRetryAttempt(typeName: string, attempt: number, delayMs: number) {
    _safeNotify(`${typeName} error — retry attempt ${attempt} (backoff ${formatDuration(delayMs)})...`, "info");
  }

  // Minimal manual command: /retry [status|reset]
  pi.registerCommand("retry", {
    description: "Retry controls: /retry (manual trigger), /retry status, /retry reset",
    handler: async (args, ctx) => {
      const sub = args[0]?.toLowerCase();

      if (sub === "reset") {
        state.reset();
        _userAborted = false;
        ctx.ui.notify("Retry counters reset", "info");
        return;
      }

      if (sub === "status") {
        const entries = ctx.sessionManager.getEntries();
        const last = getLastAssistantMessage(entries);
        let status = "=== Retry Status ===\n\n";
        status += "Errors:\n";
        status += `  Current attempt: ${state.getAttempt()}\n`;
        status += `  Is retrying: ${state.getIsRetrying()}\n`;
        status += `  Last error type: ${state.getLastErrorType() || "None"}\n`;
        status += `  Last error: ${state.getLastErrorMessage().substring(0, 100) || "None"}\n\n`;
        status += "Configuration:\n";
        status += `  Base delay: ${BASE_DELAY_MS}ms\n  Max delay: ${MAX_DELAY_MS}ms\n  Multiplier: ${BACKOFF_MULTIPLIER}\n`;
        status += `  Registered error types: ${ERROR_TYPES.map(t => t.name).join(", ") || "none"}\n\n`;
        if (last && isAssistantMessage(last)) {
          const matched = matchErrorType(last);
          status += "Last Assistant Message:\n";
          status += `  Stop reason: ${last.stopReason}\n`;
          status += `  Error message: ${last.errorMessage?.substring(0, 100) || "None"}\n`;
          status += `  Matched error type: ${matched?.name ?? "none"}`;
        }
        ctx.ui.notify(status, "info");
        return;
      }

      // /retry (no args) — manual trigger
      const entries = ctx.sessionManager.getEntries();
      const last = getLastAssistantMessage(entries);
      if (!last || !isAssistantMessage(last)) {
        ctx.ui.notify("No assistant message found to retry", "warning");
        return;
      }
      _userAborted = false;
      const matched = matchErrorType(last);
      if (matched) {
        ctx.ui.notify(`Manually retrying ${matched.name} error...`, "info");
        state.reset();
        void triggerInvisibleContinue();
        return;
      }
      ctx.ui.notify("No retryable error detected (no registered error type matched).", "warning");
    },
  });

  // Reset on session switch.
  pi.on("session_start", async () => {
    _sessionGeneration++;
    state.reset();
    _userAborted = false;
  });

  // ── Retry loop driver ─────────────────────────────────────────────────────
  // Loops: prompt([]) → check result → on retryable error again, sleep+backoff, retry.
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
        const typeName = state.getLastErrorType() || "error";
        _notifyRetryAttempt(typeName, attempt, delay);

        const interrupted = await interruptibleSleep(delay, myGeneration);
        if (interrupted) return;

        try {
          await _agent.prompt([]);
        } catch {
          // Agent already processing or transient — let the session handle it.
          return;
        }

        if (_userAborted || _sessionGeneration !== myGeneration) return;
        if (!lastMessageIsRetryableError()) {
          // Success or non-retryable terminal state — exit.
          return;
        }
        // Still a retryable error — loop back for another attempt.
      }
    } finally {
      if (_sessionGeneration === myGeneration) {
        _continueInProgress = false;
      }
    }
  }
}
