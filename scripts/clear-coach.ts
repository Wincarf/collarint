// Clears coach messages of the active mentorship — used to test the empty state (chips).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const mentorship = await db.mentorship.findFirst({ where: { status: "active" } });
  if (!mentorship) throw new Error("no active mentorship");
  const deleted = await db.coachMessage.deleteMany({ where: { mentorshipId: mentorship.id } });
  console.log(`cleared ${deleted.count} coach messages from mentorship ${mentorship.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
