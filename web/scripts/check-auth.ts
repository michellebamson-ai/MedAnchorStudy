import { auth } from "../src/lib/auth";

async function main() {
  try {
    await auth.$context;
    console.log("OK");
  } catch (error) {
    const e = error as { cause?: { message?: string }; message?: string; stack?: string };
    console.log("MESSAGE:", e.message);
    console.log("CAUSE:", e.cause?.message ?? "(none)");
    console.log("STACK:\n" + (e.stack ?? "").split("\n").slice(0, 10).join("\n"));
  }
}

main();
