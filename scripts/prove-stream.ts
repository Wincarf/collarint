// Proves progressive SSE delivery: prints arrival time of each coach event.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "lucas@demo.jci", password: "demo1234" }),
  }).then((r) => r.json());
  const token = login.token;

  const m = await db.mentorship.findFirst({ where: { status: "active" } });
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/mentorships/${m!.id}/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify({ message: "Give me a quick status of my mentorship." }),
  });
  if (!res.body) throw new Error("no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let deltas = 0;
  let firstDeltaAt = 0;
  let lastDeltaAt = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === "delta") {
        deltas++;
        if (!firstDeltaAt) firstDeltaAt = Date.now() - t0;
        lastDeltaAt = Date.now() - t0;
      } else if (evt.type === "done") {
        console.log(`DONE at ${Date.now() - t0}ms · createdTasks=${evt.createdTasks.length} · completedTasks=${evt.completedTasks.length}`);
      }
    }
  }
  console.log(`STREAMING PROOF: ${deltas} delta chunks · first at ${firstDeltaAt}ms · last at ${lastDeltaAt}ms (spread ${(lastDeltaAt - firstDeltaAt)}ms)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
