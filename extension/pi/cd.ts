/**
 * cd — move the current pi session into another repo/directory.
 *
 * Registers `/cd [path]`.
 *
 * Why this exists:
 *   Pi binds tools, project settings, skills, AGENTS.md, and session storage
 *   to the session cwd. There is no built-in `/cd`. Quitting and relaunching
 *   loses the live conversation. This extension "moves" the session by:
 *     1. resolving the target directory (supports ~, relative paths)
 *     2. forking the current session file into a new session whose header
 *        cwd is the target (via SessionManager.forkFrom)
 *     3. switching the live runtime onto that new session
 *        (AgentSessionRuntime rebuilds all cwd-bound services)
 *
 * Usage:
 *   /cd                 print current session cwd
 *   /cd <path>          move session to <path>, keep full history
 *   /cd --new <path>    start a fresh session at <path> (no history copy)
 *
 * Notes:
 *   - Creates a NEW session file under ~/.pi/agent/sessions/<encoded-target>/
 *     (or the custom session dir). The old session file is left intact.
 *   - Ephemeral (--no-session) sessions have no source file to fork; those
 *     fall back to a fresh session at the target cwd.
 *   - Does not call process.chdir(); pi tools use the session cwd, not the
 *     process cwd.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
  SessionManager,
  type ExtensionAPI,
  type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

// ── Path helpers ────────────────────────────────────────────────────────────

/**
 * Expand ~ / ~/... and resolve relative to `baseCwd`.
 * Empty / "." → baseCwd itself.
 */
function resolveTargetDir(raw: string, baseCwd: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ".") return resolve(baseCwd);

  // Bare ~ or ~/...
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith(`~${sep}`)) {
    return resolve(join(homedir(), trimmed.slice(2)));
  }

  if (isAbsolute(trimmed)) return resolve(trimmed);
  return resolve(baseCwd, trimmed);
}

/** True when path exists and is a directory. */
function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Directory-path argument completions for `/cd ...`.
 * Completes the last path segment against the parent directory listing.
 */
function completeDirectoryPath(prefix: string, baseCwd: string): AutocompleteItem[] | null {
  // Strip optional leading flag so completions still work after `/cd --new `
  const cleaned = prefix.replace(/^--new\s+/, "").trimStart();
  if (cleaned !== prefix.trimStart() && cleaned.length === 0) {
    // User typed `/cd --new ` with no path yet — complete from cwd
    return listDirCompletions(baseCwd, "");
  }

  const pathPrefix = cleaned;
  if (!pathPrefix) {
    return listDirCompletions(baseCwd, "");
  }

  // Split into parent dir + partial basename, resolving ~ along the way.
  const hasTrailingSep = pathPrefix.endsWith("/") || pathPrefix.endsWith(sep);
  let parentRaw: string;
  let partial: string;
  if (hasTrailingSep) {
    parentRaw = pathPrefix.slice(0, -1) || pathPrefix; // keep "/" absolute
    partial = "";
  } else {
    parentRaw = dirname(pathPrefix);
    partial = basename(pathPrefix);
    // dirname("~") is "." — treat bare "~foo" as partial under home? skip; only ~/ handled.
    if (pathPrefix === "~" || pathPrefix.startsWith("~/") || pathPrefix.startsWith(`~${sep}`)) {
      // dirname("~/foo") is "~"; dirname("~/foo/bar") is "~/foo"
      if (!pathPrefix.includes("/", 1) && !pathPrefix.includes(sep, 1)) {
        // just "~" or "~something" — complete under home for "~/" case only
        if (pathPrefix === "~") {
          return [{ value: "~/", label: "~/", description: "home" }];
        }
      }
    }
  }

  const parentResolved =
    parentRaw === "." && !pathPrefix.startsWith(".")
      ? baseCwd
      : resolveTargetDir(parentRaw === "." ? "." : parentRaw, baseCwd);

  if (!isDirectory(parentResolved)) return null;

  const items = listDirCompletions(parentResolved, partial, pathPrefix, hasTrailingSep);
  return items.length > 0 ? items : null;
}

/**
 * List subdirectories of `dir` matching `partial`, rebuilding the display
 * value so the user's typed prefix shape (~, relative, absolute) is preserved.
 */
function listDirCompletions(
  dir: string,
  partial: string,
  originalPrefix?: string,
  hadTrailingSep?: boolean,
): AutocompleteItem[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const lowerPartial = partial.toLowerCase();
  const dirs = entries
    .filter((name) => {
      if (name.startsWith(".") && !partial.startsWith(".")) return false;
      if (lowerPartial && !name.toLowerCase().startsWith(lowerPartial)) return false;
      try {
        return statSync(join(dir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 50);

  return dirs.map((name) => {
    // Rebuild the path value the user would want inserted.
    let value: string;
    if (!originalPrefix) {
      value = name + "/";
    } else if (hadTrailingSep) {
      value = originalPrefix + name + "/";
    } else {
      const parentPart = dirname(originalPrefix);
      if (parentPart === ".") {
        value = name + "/";
      } else {
        value = parentPart + "/" + name + "/";
      }
    }
    return {
      value,
      label: name + "/",
      description: "directory",
    };
  });
}

// ── Arg parsing ─────────────────────────────────────────────────────────────

interface CdArgs {
  /** When true, do not copy conversation history. */
  fresh: boolean;
  /** Raw path argument (may be empty → print cwd). */
  path: string;
}

function parseCdArgs(args: string): CdArgs {
  const trimmed = args.trim();
  if (!trimmed) return { fresh: false, path: "" };

  // Support `/cd --new <path>` and `/cd -n <path>`
  const newMatch = trimmed.match(/^(?:--new|-n)(?:\s+(.*))?$/s);
  if (newMatch) {
    return { fresh: true, path: (newMatch[1] ?? "").trim() };
  }

  // Also allow `/cd <path> --new` at the end
  const trailingNew = trimmed.match(/^(.*?)\s+(?:--new|-n)$/s);
  if (trailingNew) {
    return { fresh: true, path: trailingNew[1].trim() };
  }

  return { fresh: false, path: trimmed };
}

// ── Core move logic ─────────────────────────────────────────────────────────

/**
 * Build a session file living under `targetCwd`, then switch the live runtime
 * onto it. History is preserved unless `fresh` is set or the current session
 * is ephemeral (no source file).
 */
async function moveSessionTo(
  ctx: ExtensionCommandContext,
  targetCwd: string,
  fresh: boolean,
): Promise<void> {
  const fromCwd = ctx.cwd;
  const sourceFile = ctx.sessionManager.getSessionFile();
  const canFork = !fresh && !!sourceFile && ctx.sessionManager.isPersisted();

  let targetSessionFile: string | undefined;

  if (canFork) {
    // forkFrom copies the full entry tree into a new session whose header.cwd
    // is targetCwd, and stores it under the default sessions dir for that cwd.
    // It writes the file immediately (unlike SessionManager.create).
    const forked = SessionManager.forkFrom(sourceFile!, targetCwd);
    targetSessionFile = forked.getSessionFile();
  } else {
    // Fresh session at the target (also the ephemeral / --new path).
    //
    // Important: SessionManager.create() only assigns a sessionFile path and
    // keeps the header in memory. It does NOT write to disk until the first
    // assistant message is persisted (lazy flush). switchSession() then opens
    // that path, finds no header, and falls back to process.cwd() — so the
    // session appears not to move. Flush the header ourselves before switch.
    const created = SessionManager.create(targetCwd, undefined, {
      parentSession: sourceFile,
    });
    targetSessionFile = created.getSessionFile();
    const header = created.getHeader();
    if (targetSessionFile && header) {
      mkdirSync(dirname(targetSessionFile), { recursive: true });
      writeFileSync(targetSessionFile, `${JSON.stringify(header)}\n`, {
        flag: "wx",
      });
    }
  }

  if (!targetSessionFile || !existsSync(targetSessionFile)) {
    ctx.ui.notify("Failed to create session at target cwd", "error");
    return;
  }

  const modeLabel = canFork ? "moved (history kept)" : "fresh session";
  const result = await ctx.switchSession(targetSessionFile, {
    withSession: async (newCtx) => {
      // Use only the replacement ctx — old ctx/sessionManager are stale.
      newCtx.ui.notify(
        `cwd ${fromCwd} → ${newCtx.cwd}  [${modeLabel}]`,
        "info",
      );
    },
  });

  if (result.cancelled) {
    ctx.ui.notify("cd cancelled by extension", "warning");
  }
}

// ── Extension entry ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("cd", {
    description:
      "Move this session into another directory/repo. Usage: /cd [path] | /cd --new <path>",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      // Completions run without a command ctx; use process.cwd() as a fallback
      // base. Session cwd usually matches the launcher cwd, so this is fine
      // for relative-path completion in practice.
      return completeDirectoryPath(prefix, process.cwd());
    },
    handler: async (args, ctx) => {
      const { fresh, path } = parseCdArgs(args);

      // No path → print current cwd (and a short hint).
      if (!path) {
        if (fresh) {
          ctx.ui.notify("Usage: /cd --new <path>", "error");
          return;
        }
        ctx.ui.notify(`cwd: ${ctx.cwd}`, "info");
        return;
      }

      const targetCwd = resolveTargetDir(path, ctx.cwd);

      if (!existsSync(targetCwd)) {
        ctx.ui.notify(`No such directory: ${targetCwd}`, "error");
        return;
      }
      if (!isDirectory(targetCwd)) {
        ctx.ui.notify(`Not a directory: ${targetCwd}`, "error");
        return;
      }

      // Same directory — nothing to do (still useful as a no-op check).
      if (resolve(targetCwd) === resolve(ctx.cwd) && !fresh) {
        ctx.ui.notify(`Already in ${ctx.cwd}`, "info");
        return;
      }

      // Wait for the agent to settle so we don't tear down mid-turn.
      await ctx.waitForIdle();
      await moveSessionTo(ctx, targetCwd, fresh);
    },
  });
}
