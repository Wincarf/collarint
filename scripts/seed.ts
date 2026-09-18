// Demo seed — JCI Collarint
// 12 realistic Brazilian members + 2 active mentorships with plan, session
// history, tasks and Coach conversations — so the demo starts instantly rich.
//
// Usage: bun /home/z/my-project/scripts/seed.ts

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { localEmbedding } from "../src/lib/ai";
import type { SkillEntry, MentorshipPlan } from "../src/lib/types";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DEMO_PASSWORD = "demo1234";

const LEVEL_EN: Record<SkillEntry["level"], string> = {
  iniciante: "Beginner",
  intermediario: "Intermediate",
  avancado: "Advanced",
};

function emb(mode: "local", text: string): string {
  return JSON.stringify({ mode, vector: localEmbedding(text) });
}

function teachText(skills: SkillEntry[], goal: string | null): string {
  return (
    "Skills I can teach: " +
    skills.map((s) => `${s.name} (${LEVEL_EN[s.level]} level)`).join(", ") +
    (goal ? `. Context: ${goal}` : "")
  );
}
function learnText(skills: SkillEntry[], goal: string | null): string {
  return (
    "Skills I want to learn: " +
    skills.map((s) => `${s.name} (${LEVEL_EN[s.level]} level)`).join(", ") +
    (goal ? `. My goal: ${goal}` : "")
  );
}

function daysFromNow(days: number, hour = 19, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface SeedUser {
  email: string;
  name: string;
  roleTitle: string;
  city: string;
  avatarColor: string;
  teach: SkillEntry[];
  learn: SkillEntry[];
  goal: string;
  availability: "1h" | "2h" | "4h+";
  isAdmin?: boolean;
}

const USERS: SeedUser[] = [
  {
    email: "admin@jci.org.br",
    name: "Comissão de Desenvolvimento",
    roleTitle: "JCI Administration",
    city: "São Paulo, SP",
    avatarColor: "#D4A843",
    teach: [{ name: "Leadership", level: "avancado" }],
    learn: [],
    goal: "Oversee the organization's mentoring program.",
    availability: "1h",
    isAdmin: true,
  },
  {
    email: "marcos@demo.jci",
    name: "Marcos Ribeiro",
    roleTitle: "Commercial Director",
    city: "São Paulo, SP",
    avatarColor: "#0A1F44",
    teach: [
      { name: "Negotiation", level: "avancado" },
      { name: "Sales", level: "avancado" },
      { name: "Networking", level: "intermediario" },
    ],
    learn: [
      { name: "Digital Marketing", level: "iniciante" },
      { name: "Technology/AI", level: "iniciante" },
    ],
    goal: "Expand the commercial operation to digital channels and understand how AI can boost B2B sales.",
    availability: "2h",
  },
  {
    email: "lucas@demo.jci",
    name: "Lucas Martins",
    roleTitle: "Sales Analyst",
    city: "Campinas, SP",
    avatarColor: "#1F4A7A",
    teach: [{ name: "Digital Marketing", level: "iniciante" }],
    learn: [
      { name: "Negotiation", level: "iniciante" },
      { name: "Sales", level: "intermediario" },
      { name: "Public Speaking", level: "iniciante" },
    ],
    goal: "Close my first enterprise deals and gain confidence in meetings with decision-makers.",
    availability: "2h",
  },
  {
    email: "marina@demo.jci",
    name: "Marina Duarte",
    roleTitle: "Head of Product",
    city: "Rio de Janeiro, RJ",
    avatarColor: "#D4A843",
    teach: [
      { name: "Leadership", level: "avancado" },
      { name: "Project Management", level: "avancado" },
      { name: "Public Speaking", level: "intermediario" },
    ],
    learn: [
      { name: "Technology/AI", level: "iniciante" },
      { name: "Finance", level: "iniciante" },
    ],
    goal: "Learn to use AI in my day-to-day product management and better understand the financial side of the business.",
    availability: "2h",
  },
  {
    email: "patricia@demo.jci",
    name: "Patrícia Gomes",
    roleTitle: "Project Manager",
    city: "Belo Horizonte, MG",
    avatarColor: "#2E6E5C",
    teach: [{ name: "Project Management", level: "intermediario" }],
    learn: [
      { name: "Leadership", level: "intermediario" },
      { name: "Project Management", level: "avancado" },
      { name: "Storytelling", level: "iniciante" },
    ],
    goal: "Get promoted to senior manager by leading multidisciplinary teams with autonomy.",
    availability: "2h",
  },
  {
    email: "carlos@demo.jci",
    name: "Carlos Eduardo Lima",
    roleTitle: "CFO",
    city: "Curitiba, PR",
    avatarColor: "#7A5C1F",
    teach: [
      { name: "Finance", level: "avancado" },
      { name: "Entrepreneurship", level: "intermediario" },
      { name: "Negotiation", level: "intermediario" },
    ],
    learn: [{ name: "Digital Marketing", level: "iniciante" }],
    goal: "Learn to promote my financial consulting services for small businesses on social media.",
    availability: "1h",
  },
  {
    email: "fernanda@demo.jci",
    name: "Fernanda Alves",
    roleTitle: "Marketing Specialist",
    city: "Recife, PE",
    avatarColor: "#6E2E50",
    teach: [
      { name: "Digital Marketing", level: "avancado" },
      { name: "Storytelling", level: "avancado" },
      { name: "Public Speaking", level: "intermediario" },
    ],
    learn: [
      { name: "Negotiation", level: "iniciante" },
      { name: "Finance", level: "iniciante" },
    ],
    goal: "Learn to negotiate salaries and freelance contracts with more confidence.",
    availability: "2h",
  },
  {
    email: "rafael@demo.jci",
    name: "Rafael Souza",
    roleTitle: "Full-Stack Developer",
    city: "Florianópolis, SC",
    avatarColor: "#4A2E6E",
    teach: [
      { name: "Technology/AI", level: "avancado" },
      { name: "Project Management", level: "iniciante" },
    ],
    learn: [
      { name: "Public Speaking", level: "iniciante" },
      { name: "Networking", level: "iniciante" },
      { name: "Entrepreneurship", level: "iniciante" },
    ],
    goal: "Move into technical leadership and, in the future, found my own SaaS.",
    availability: "4h+",
  },
  {
    email: "juliana@demo.jci",
    name: "Juliana Castro",
    roleTitle: "HR Director",
    city: "Brasília, DF",
    avatarColor: "#2E5A6E",
    teach: [
      { name: "Human Resources", level: "avancado" },
      { name: "Leadership", level: "intermediario" },
      { name: "Networking", level: "avancado" },
    ],
    learn: [
      { name: "Technology/AI", level: "iniciante" },
      { name: "Digital Marketing", level: "iniciante" },
    ],
    goal: "Understand how AI is changing recruiting and employer branding.",
    availability: "2h",
  },
  {
    email: "bruno@demo.jci",
    name: "Bruno Henrique",
    roleTitle: "Entrepreneur",
    city: "Salvador, BA",
    avatarColor: "#8A5A2E",
    teach: [{ name: "Sales", level: "iniciante" }],
    learn: [
      { name: "Entrepreneurship", level: "intermediario" },
      { name: "Finance", level: "iniciante" },
      { name: "Digital Marketing", level: "iniciante" },
    ],
    goal: "Structure my coffee shop to grow from 1 to 3 locations over the next 2 years.",
    availability: "4h+",
  },
  {
    email: "camila@demo.jci",
    name: "Camila Rocha",
    roleTitle: "Startup Founder",
    city: "Porto Alegre, RS",
    avatarColor: "#2E6E42",
    teach: [
      { name: "Entrepreneurship", level: "avancado" },
      { name: "Storytelling", level: "intermediario" },
      { name: "Digital Marketing", level: "intermediario" },
    ],
    learn: [
      { name: "Project Management", level: "iniciante" },
      { name: "Human Resources", level: "iniciante" },
    ],
    goal: "Organize my internal processes and learn to hire the first members of my team.",
    availability: "2h",
  },
  {
    email: "eduardo@demo.jci",
    name: "Eduardo Nunes",
    roleTitle: "Senior Consultant",
    city: "Fortaleza, CE",
    avatarColor: "#6E4A2E",
    teach: [
      { name: "Negotiation", level: "avancado" },
      { name: "Storytelling", level: "avancado" },
      { name: "Sales", level: "avancado" },
      { name: "Networking", level: "avancado" },
    ],
    learn: [{ name: "Technology/AI", level: "iniciante" }],
    goal: "Use AI to scale my consulting practice without losing personalization.",
    availability: "1h",
  },
];

const PLAN_LUCAS: MentorshipPlan = {
  generatedBy: "template",
  createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  sessions: [
    {
      number: 1,
      title: "Sales process diagnosis",
      objective: "Map Lucas's current sales funnel and identify where deals get stuck.",
      topics: ["Current sales funnel", "Main losses and reasons", "Enterprise client profile"],
    },
    {
      number: 2,
      title: "Meeting preparation and opening",
      objective: "Build a pre-call research routine and an opening that generates credibility.",
      topics: ["Decision-maker research", "Opening structure", "Discovery questions"],
    },
    {
      number: 3,
      title: "Handling objections",
      objective: "Master the 5 most common enterprise sales objections and practice responses.",
      topics: ["Price objections", "Timing objections", "Reframing technique"],
    },
    {
      number: 4,
      title: "Closing simulation",
      objective: "Full role-play of a real negotiation with structured feedback from Marcos.",
      topics: ["Real deal role-play", "Concessions and trade-offs", "Post-mentorship next steps"],
    },
  ],
};

const PLAN_PATRICIA: MentorshipPlan = {
  generatedBy: "template",
  createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  sessions: [
    {
      number: 1,
      title: "Leadership self-awareness",
      objective: "Identify Patrícia's current leadership style and the gaps to the next level.",
      topics: ["Leadership style", "Past feedback", "Moments of highest impact"],
    },
    {
      number: 2,
      title: "Delegating with confidence",
      objective: "Create a delegation framework that frees up Patrícia's time without losing quality.",
      topics: ["Delegation matrix", "Autonomy levels", "Follow-up rituals"],
    },
    {
      number: 3,
      title: "Executive communication",
      objective: "Prepare Patrícia to present results to the board with storytelling.",
      topics: ["Executive structure", "Storytelling with data", "How to ask for the promotion"],
    },
    {
      number: 4,
      title: "Development plan",
      objective: "Consolidate a 90-day plan for the senior manager promotion.",
      topics: ["90-day goals", "Sponsors and visibility", "Review rituals"],
    },
  ],
};

async function main() {
  console.log("Clearing database...");
  await prisma.notification.deleteMany();
  await prisma.sessionPrep.deleteMany();
  await prisma.coachMessage.deleteMany();
  await prisma.task.deleteMany();
  await prisma.session.deleteMany();
  await prisma.mentorship.deleteMany();
  await prisma.profile.deleteMany();

  console.log("Creating 12 profiles...");
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const created = await prisma.profile.create({
      data: {
        email: u.email,
        passwordHash: hashPassword(DEMO_PASSWORD),
        name: u.name,
        roleTitle: u.roleTitle,
        city: u.city,
        avatarColor: u.avatarColor,
        teachSkills: JSON.stringify(u.teach),
        learnSkills: JSON.stringify(u.learn),
        mainGoal: u.goal,
        weeklyAvailability: u.availability,
        teachEmbedding: emb("local", teachText(u.teach, u.goal)),
        learnEmbedding: emb("local", learnText(u.learn, u.goal)),
        onboarded: true,
        isAdmin: u.isAdmin ?? false,
      },
    });
    ids[u.email] = created.id;
  }

  console.log("Creating active mentorship #1: Marcos → Lucas");
  const m1 = await prisma.mentorship.create({
    data: {
      mentorId: ids["marcos@demo.jci"],
      menteeId: ids["lucas@demo.jci"],
      status: "active",
      inviteMessage:
        "Marcos, I have followed your commercial career at JCI and I know you have closed enterprise deals I only see in my dreams. I would love to learn negotiation with you!",
      plan: JSON.stringify(PLAN_LUCAS),
      createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
    },
  });

  await prisma.session.createMany({
    data: [
      {
        mentorshipId: m1.id,
        scheduledAt: daysFromNow(-9, 18, 30),
        notes:
          "We mapped Lucas's sales funnel: 12 active accounts, but he treats 'proposal sent' as the final stage. Marcos brought the BANT framework and we identified that decision-maker discovery is the weak point.",
        commitments:
          "Lucas: map the 3 main decision-makers of the strategic accounts and record a 90s pitch. Marcos: share his pre-call research template.",
        completed: true,
      },
      {
        mentorshipId: m1.id,
        scheduledAt: daysFromNow(4, 18, 30),
        completed: false,
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        mentorshipId: m1.id,
        title: "Map the 3 decision-makers of the strategic accounts (BANT framework)",
        dueDate: daysFromNow(3, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m1.id,
        title: "Record a 90-second pitch and listen back noting 2 improvements",
        dueDate: daysFromNow(2, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m1.id,
        title: "Read Marcos's pre-call research template",
        dueDate: daysFromNow(-2, 23, 59),
        completed: true,
        source: "user",
      },
    ],
  });

  await prisma.coachMessage.createMany({
    data: [
      {
        mentorshipId: m1.id,
        role: "assistant",
        content:
          "Hi, **Lucas**! Great to have you here.\n\nYour mentorship with **Marcos Ribeiro** is already moving: in Session 1 you mapped your funnel together and found that the weak point is **decision-maker discovery**. You have 2 tasks pending this week: map the 3 decision-makers with the BANT framework and record your 90-second pitch.\n\n**Concrete action:** set aside 20 minutes today to list the 3 decision-makers — tomorrow we review them together before Thursday's session with Marcos.",
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      },
      {
        mentorshipId: m1.id,
        role: "user",
        content:
          "Coach, I'm stuck on mapping the decision-makers. I don't know how to find out who decides without seeming invasive.",
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      },
      {
        mentorshipId: m1.id,
        role: "assistant",
        content:
          "Excellent question — and totally legitimate: nobody likes to come across as an investigator.\n\nHere is the tip that connects with what you discussed in Session 1: in the **BANT** framework (Budget, Authority, Need, Timeline), authority is **discovered with process questions**, not power questions. Try: *\"How do purchasing decisions usually work in your area?\"* — that question reveals who signs off without pointing fingers.\n\nAnother light-touch route: **LinkedIn** gives you the title, and the authority signal comes when you ask *\"who else usually weighs in on a decision of this size?\"*.\n\n**Concrete action:** write that process question into your call notebook and test it in the next conversation with one of your 3 strategic accounts. Then tell me what you found!",
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 120000),
      },
    ],
  });

  console.log("Creating active mentorship #2: Marina → Patrícia");
  const m2 = await prisma.mentorship.create({
    data: {
      mentorId: ids["marina@demo.jci"],
      menteeId: ids["patricia@demo.jci"],
      status: "active",
      inviteMessage:
        "Marina, I want to get ready to lead bigger teams and you are the reference I admire most here at JCI when it comes to management. Would you mentor me?",
      plan: JSON.stringify(PLAN_PATRICIA),
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    },
  });

  await prisma.session.createMany({
    data: [
      {
        mentorshipId: m2.id,
        scheduledAt: daysFromNow(-6, 12, 0),
        notes:
          "Marina used the Situational Leadership model to map Patrícia's team. It became clear that Patrícia micro-manages the juniors and overloads the seniors.",
        commitments:
          "Patrícia: pick 2 deliverables to delegate with the 'I decide and inform' autonomy level. Marina: send the HBR article on delegation.",
        completed: true,
      },
      {
        mentorshipId: m2.id,
        scheduledAt: daysFromNow(6, 12, 0),
        completed: false,
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        mentorshipId: m2.id,
        title: "Delegate 2 deliverables using the Session 1 autonomy matrix",
        dueDate: daysFromNow(4, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m2.id,
        title: "Read the HBR article on delegation Marina sent",
        dueDate: daysFromNow(-1, 23, 59),
        completed: true,
        source: "user",
      },
    ],
  });

  await prisma.coachMessage.createMany({
    data: [
      {
        mentorshipId: m2.id,
        role: "assistant",
        content:
          "Hi, **Patrícia**!\n\nIn your last session with **Marina** you set a very clear goal: delegate 2 deliverables using the autonomy matrix (\"I decide and inform\"). That is the bridge between Session 1 and Session 2, which will cover **delegating with confidence**.\n\n**Concrete action:** before Thursday, pick the 2 deliverables that will leave your hands — start with the ones that consume the most of your time and require the least of your technical sign-off.",
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
    ],
  });

  console.log("Creating pending invite: Rafael → Carlos (for the mentor panel demo)");
  const m3 = await prisma.mentorship.create({
    data: {
      mentorId: ids["carlos@demo.jci"],
      menteeId: ids["rafael@demo.jci"],
      status: "pending",
      inviteMessage:
        "Carlos, I'm building my first SaaS and need to learn how to structure the finances of my own business. Your CFO vision + JCI spirit would be perfect to guide me on this journey.",
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: ids["carlos@demo.jci"],
        type: "mentorship_invite",
        title: "Rafael Souza wants you as their mentor",
        body: "\"Carlos, I'm building my first SaaS and need to learn how to structure finances...\"",
        payload: JSON.stringify({ mentorshipId: m3.id }),
        read: false,
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      },
      {
        userId: ids["lucas@demo.jci"],
        type: "session_scheduled",
        title: "Next session with Marcos scheduled",
        body: "Session 2 · Meeting preparation and opening",
        payload: JSON.stringify({ mentorshipId: m1.id }),
        read: false,
      },
      {
        userId: ids["patricia@demo.jci"],
        type: "session_scheduled",
        title: "Next session with Marina scheduled",
        body: "Session 2 · Delegating with confidence",
        payload: JSON.stringify({ mentorshipId: m2.id }),
        read: false,
      },
    ],
  });

  console.log("\n✅ Seed complete!");
  console.log(`   ${USERS.length} users · password for all: ${DEMO_PASSWORD}`);
  console.log("   Key accounts: marcos@demo.jci (mentor), lucas@demo.jci (mentee),");
  console.log("   carlos@demo.jci (mentor with pending invite), admin@jci.org.br (admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
