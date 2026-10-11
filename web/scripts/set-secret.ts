/**
 * Put a secret into .env without it ever appearing on screen.
 *
 * Why this exists: typing a key into a chat window, or into a terminal that
 * keeps scrollback, leaves a copy of the secret lying around. This asks for the
 * value with the keystrokes hidden, so nothing is displayed, recorded in
 * scrollback, or pasted anywhere.
 *
 * It replaces an existing variable in place rather than rewriting the file, so
 * every other key is preserved, and it writes UTF-8 without a BOM, because a
 * BOM corrupts the first variable in a .env file.
 *
 *   npm run secret                       # asks for name, then hidden value
 *   npm run secret -- RESEND_API_KEY      # skips the name prompt
 *   npm run secret -- --generate BETTER_AUTH_SECRET
 *
 * The value is never printed. Only the name and the length are.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Overridable so this can be tested against a throwaway copy instead of the
// real .env.
const ENV_FILE =
  process.env.SET_SECRET_ENV_FILE ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".env");

const NAME_RE = /^[A-Z][A-Z0-9_]*$/;

/** Read a line with nothing echoed back, so the value stays invisible. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;

    // Raw mode is what lets us swallow the characters instead of printing them.
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.removeListener("data", onData);
          stdin.setEncoding("utf8");
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl+C
          process.stdout.write("\nCancelled. Nothing changed.\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function askVisible(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function setSecret(name: string, value: string): "added" | "replaced" {
  let lines: string[];
  try {
    lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  } catch {
    console.error(`Cannot read ${ENV_FILE}`);
    process.exit(1);
  }

  const pattern = new RegExp(`^(\\s*)(${name})(\\s*)=(.*)$`);
  let replaced = false;

  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(pattern);
    if (m && !replaced) {
      out.push(`${m[1]}${name}${m[3]}="${value}"`);
      replaced = true;
    } else if (!m || replaced) {
      out.push(line);
    }
  }

  if (!replaced) {
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    out.push("", `${name}="${value}"`);
  }

  // UTF-8, no BOM. A BOM here silently corrupts the first variable in the file.
  writeFileSync(ENV_FILE, out.join("\n"), "utf8");
  return replaced ? "replaced" : "added";
}

async function main() {
  const args = process.argv.slice(2);
  const generateIndex = args.indexOf("--generate");

  let name: string;
  let value: string;

  if (generateIndex >= 0) {
    name = (args[generateIndex + 1] ?? "").toUpperCase();
    value = randomBytes(32).toString("base64");
    if (!NAME_RE.test(name)) {
      console.error(`'${name}' is not a valid environment variable name.`);
      process.exit(1);
    }
    console.log(`\n  Generating a random value for ${name}\n`);
  } else {
    console.log("\n  Saving a secret to web/.env");
    console.log("  The value you type is hidden. Nothing is printed.\n");

    name = args[0] ? args[0].toUpperCase() : await askVisible("  Variable name (e.g. RESEND_API_KEY): ");
    if (!NAME_RE.test(name)) {
      console.error(`  '${name}' is not a valid environment variable name.`);
      process.exit(1);
    }

    value = await askHidden(`  Value for ${name} (hidden): `);
    if (!value) {
      console.log("  Empty value. Nothing changed.");
      process.exit(0);
    }
  }

  const how = setSecret(name, value);

  const all = readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l));
  const filled = all.filter((l) => l.split("=", 2)[1].trim().replace(/^"|"$/g, "").length > 0);

  console.log(`  ${how} ${name} in .env`);
  console.log(`  length: ${value.length} characters (value not shown)\n`);
  console.log(`  .env now has ${filled.length} of ${all.length} variables with values.`);
  console.log("  Restart the dev server for changes to take effect.\n");
}

main();