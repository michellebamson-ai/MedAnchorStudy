/**
 * Bridge to the Python statistics engine.
 *
 * The biostatistics workbench used to compute means and standard deviations in
 * TypeScript and then ask a language model to describe them. That produced
 * confident prose about numbers nobody had tested. This runs the actual tests.
 *
 * The engine degrades rather than fails. If Python is missing, misconfigured or
 * slow, callers get a reason and can fall back to the TypeScript descriptives,
 * so the workbench still opens on a machine without Python.
 *
 * Server-only: it spawns a process.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface BiostatRequest {
  columns: string[];
  rows: string[][];
  confusion?: { tp: number; fn: number; tn: number; fp: number };
  epidemiology?: { positive: string; total: string };
}

export interface BiostatTest {
  test: string;
  p?: number;
  significant?: boolean;
  [key: string]: unknown;
}

export interface BiostatResult {
  ok: boolean;
  /** False when the engine could not be reached, as opposed to running and finding nothing. */
  ran: boolean;
  error?: string;
  rows?: number;
  columns?: string[];
  numericColumns?: string[];
  categoricalColumns?: string[];
  descriptives?: Record<string, Record<string, number | boolean | null | number[]>>;
  frequencies?: Record<string, unknown>;
  tests?: BiostatTest[];
  warnings?: string[];
  summary?: string;
}

const SCRIPT = "biostat_run.py";
const TIMEOUT_MS = 20_000;
const MAX_INPUT_BYTES = 4 * 1024 * 1024;

/** Windows candidates first, because that is where a default install lands. */
function pythonCandidates(): string[] {
  const fromEnv = process.env.PYTHON_PATH?.trim();
  const localAppData = process.env.LOCALAPPDATA;
  const candidates: string[] = [];
  if (fromEnv) candidates.push(fromEnv);
  if (localAppData) {
    for (const minor of ["313", "312", "311", "310"]) {
      candidates.push(path.join(localAppData, "Programs", "Python", `Python${minor}`, "python.exe"));
    }
  }
  candidates.push("python", "python3", "py");
  return candidates;
}

let cachedPython: string | null | undefined;

function findPython(): Promise<string | null> {
  if (cachedPython !== undefined) return Promise.resolve(cachedPython);

  const scriptPath = path.join(process.cwd(), "scripts", SCRIPT);
  if (!existsSync(scriptPath)) {
    // Running from a packaged build where the script was not shipped.
    cachedPython = null;
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const candidates = pythonCandidates().filter((c) => path.isAbsolute(c) ? existsSync(c) : true);
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        cachedPython = null;
        resolve(null);
        return;
      }
      const candidate = candidates[index++];
      execFile(
        candidate,
        ["-c", "import numpy, scipy, pandas, statsmodels"],
        { timeout: 15_000, windowsHide: true },
        (error) => {
          if (!error) {
            cachedPython = candidate;
            resolve(candidate);
          } else {
            tryNext();
          }
        }
      );
    };

    tryNext();
  });
}

/**
 * Run the statistics engine over a table.
 *
 * Never throws. A failure comes back as `ran: false` plus a reason, because a
 * student pasting a messy table should see a missing test explained, not an
 * error page.
 */
export async function runBiostatistics(request: BiostatRequest): Promise<BiostatResult> {
  if (!request.columns?.length || !request.rows?.length) {
    return { ok: false, ran: false, error: "No columns or rows to analyse." };
  }

  const payload = JSON.stringify(request);
  if (Buffer.byteLength(payload, "utf8") > MAX_INPUT_BYTES) {
    return { ok: false, ran: false, error: "That table is too large to analyse. Try a sample of it." };
  }

  const python = await findPython();
  if (!python) {
    return {
      ok: false,
      ran: false,
      error:
        "The Python statistics engine is not available on this machine. Set PYTHON_PATH, or install Python with numpy, scipy, pandas and statsmodels.",
    };
  }

  return new Promise((resolve) => {
    const child = execFile(
      python,
      [path.join(process.cwd(), "scripts", SCRIPT)],
      {
        timeout: TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PYTHONWARNINGS: "ignore" },
      },
      (error, stdout, stderr) => {
        const text = String(stdout ?? "").trim();
        if (!text) {
          resolve({
            ok: false,
            ran: false,
            error: stderr
              ? `The statistics engine failed: ${String(stderr).trim().slice(0, 300)}`
              : "The statistics engine produced no output.",
          });
          return;
        }
        try {
          const parsed = JSON.parse(text) as BiostatResult;
          resolve({ ...parsed, ran: true });
        } catch {
          resolve({
            ok: false,
            ran: false,
            error: "The statistics engine returned output that could not be read.",
          });
        }
        // `error` is deliberately ignored when there is usable output: the
        // script exits non-zero for an unreadable table but still explains why
        // in the JSON body, which is more useful than the exit code.
        void error;
      }
    );

    child.stdin?.write(payload);
    child.stdin?.end();
  });
}

/** Clear the cached interpreter, so a freshly installed Python is picked up. */
export function resetPythonCache(): void {
  cachedPython = undefined;
}
