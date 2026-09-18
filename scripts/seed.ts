// Seed de demonstração — JCI Collarint
// 12 usuários brasileiros realistas + 2 mentorias ativas com plano, histórico de
// sessões, tarefas e conversas do Coach — para a demo nascer instantaneamente rica.
//
// Uso: bun /home/z/my-project/scripts/seed.ts

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

function emb(mode: "local", text: string): string {
  return JSON.stringify({ mode, vector: localEmbedding(text) });
}

function teachText(skills: SkillEntry[], goal: string | null): string {
  return (
    "Posso ensinar: " +
    skills.map((s) => `${s.name} (nível ${s.level})`).join(", ") +
    (goal ? `. Contexto: ${goal}` : "")
  );
}
function learnText(skills: SkillEntry[], goal: string | null): string {
  return (
    "Quero aprender: " +
    skills.map((s) => `${s.name} (nível ${s.level})`).join(", ") +
    (goal ? `. Meu objetivo: ${goal}` : "")
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
    roleTitle: "Administração JCI",
    city: "São Paulo, SP",
    avatarColor: "#D4A843",
    teach: [{ name: "Liderança", level: "avancado" }],
    learn: [],
    goal: "Acompanhar o programa de mentoria da organização.",
    availability: "1h",
    isAdmin: true,
  },
  {
    email: "marcos@demo.jci",
    name: "Marcos Ribeiro",
    roleTitle: "Diretor Comercial",
    city: "São Paulo, SP",
    avatarColor: "#0A1F44",
    teach: [
      { name: "Negociação", level: "avancado" },
      { name: "Vendas", level: "avancado" },
      { name: "Networking", level: "intermediario" },
    ],
    learn: [
      { name: "Marketing Digital", level: "iniciante" },
      { name: "Tecnologia/IA", level: "iniciante" },
    ],
    goal: "Expandir a operação comercial para canais digitais e entender como a IA pode potencializar vendas B2B.",
    availability: "2h",
  },
  {
    email: "lucas@demo.jci",
    name: "Lucas Martins",
    roleTitle: "Analista de Vendas",
    city: "Campinas, SP",
    avatarColor: "#1F4A7A",
    teach: [{ name: "Marketing Digital", level: "iniciante" }],
    learn: [
      { name: "Negociação", level: "iniciante" },
      { name: "Vendas", level: "intermediario" },
      { name: "Comunicação em Público", level: "iniciante" },
    ],
    goal: "Fechar minhas primeiras vendas enterprise e ganhar segurança em reuniões com decisores.",
    availability: "2h",
  },
  {
    email: "marina@demo.jci",
    name: "Marina Duarte",
    roleTitle: "Head de Produto",
    city: "Rio de Janeiro, RJ",
    avatarColor: "#D4A843",
    teach: [
      { name: "Liderança", level: "avancado" },
      { name: "Gestão de Projetos", level: "avancado" },
      { name: "Comunicação em Público", level: "intermediario" },
    ],
    learn: [
      { name: "Tecnologia/IA", level: "iniciante" },
      { name: "Finanças", level: "iniciante" },
    ],
    goal: "Aprender a usar IA no dia a dia da gestão de produto e entender melhor o lado financeiro do negócio.",
    availability: "2h",
  },
  {
    email: "patricia@demo.jci",
    name: "Patrícia Gomes",
    roleTitle: "Gerente de Projetos",
    city: "Belo Horizonte, MG",
    avatarColor: "#2E6E5C",
    teach: [{ name: "Gestão de Projetos", level: "intermediario" }],
    learn: [
      { name: "Liderança", level: "intermediario" },
      { name: "Gestão de Projetos", level: "avancado" },
      { name: "Storytelling", level: "iniciante" },
    ],
    goal: "Ser promovida a gerente sênior liderando times multidisciplinares com autonomia.",
    availability: "2h",
  },
  {
    email: "carlos@demo.jci",
    name: "Carlos Eduardo Lima",
    roleTitle: "CFO",
    city: "Curitiba, PR",
    avatarColor: "#7A5C1F",
    teach: [
      { name: "Finanças", level: "avancado" },
      { name: "Empreendedorismo", level: "intermediario" },
      { name: "Negociação", level: "intermediario" },
    ],
    learn: [{ name: "Marketing Digital", level: "iniciante" }],
    goal: "Aprender a divulgar consultoria financeira para pequenas empresas nas redes sociais.",
    availability: "1h",
  },
  {
    email: "fernanda@demo.jci",
    name: "Fernanda Alves",
    roleTitle: "Especialista de Marketing",
    city: "Recife, PE",
    avatarColor: "#6E2E50",
    teach: [
      { name: "Marketing Digital", level: "avancado" },
      { name: "Storytelling", level: "avancado" },
      { name: "Comunicação em Público", level: "intermediario" },
    ],
    learn: [
      { name: "Negociação", level: "iniciante" },
      { name: "Finanças", level: "iniciante" },
    ],
    goal: "Aprender a negociar salários e contratos de freelance com mais segurança.",
    availability: "2h",
  },
  {
    email: "rafael@demo.jci",
    name: "Rafael Souza",
    roleTitle: "Desenvolvedor Full-Stack",
    city: "Florianópolis, SC",
    avatarColor: "#4A2E6E",
    teach: [
      { name: "Tecnologia/IA", level: "avancado" },
      { name: "Gestão de Projetos", level: "iniciante" },
    ],
    learn: [
      { name: "Comunicação em Público", level: "iniciante" },
      { name: "Networking", level: "iniciante" },
      { name: "Empreendedorismo", level: "iniciante" },
    ],
    goal: "Transitar para liderança técnica e, no futuro, fundar meu próprio SaaS.",
    availability: "4h+",
  },
  {
    email: "juliana@demo.jci",
    name: "Juliana Castro",
    roleTitle: "Diretora de RH",
    city: "Brasília, DF",
    avatarColor: "#2E5A6E",
    teach: [
      { name: "Recursos Humanos", level: "avancado" },
      { name: "Liderança", level: "intermediario" },
      { name: "Networking", level: "avancado" },
    ],
    learn: [
      { name: "Tecnologia/IA", level: "iniciante" },
      { name: "Marketing Digital", level: "iniciante" },
    ],
    goal: "Entender como a IA está mudando recrutamento e employer branding.",
    availability: "2h",
  },
  {
    email: "bruno@demo.jci",
    name: "Bruno Henrique",
    roleTitle: "Empreendedor",
    city: "Salvador, BA",
    avatarColor: "#8A5A2E",
    teach: [{ name: "Vendas", level: "iniciante" }],
    learn: [
      { name: "Empreendedorismo", level: "intermediario" },
      { name: "Finanças", level: "iniciante" },
      { name: "Marketing Digital", level: "iniciante" },
    ],
    goal: "Estruturar minha cafeteria para crescer de 1 para 3 unidades nos próximos 2 anos.",
    availability: "4h+",
  },
  {
    email: "camila@demo.jci",
    name: "Camila Rocha",
    roleTitle: "Fundadora de Startup",
    city: "Porto Alegre, RS",
    avatarColor: "#2E6E42",
    teach: [
      { name: "Empreendedorismo", level: "avancado" },
      { name: "Storytelling", level: "intermediario" },
      { name: "Marketing Digital", level: "intermediario" },
    ],
    learn: [
      { name: "Gestão de Projetos", level: "iniciante" },
      { name: "Recursos Humanos", level: "iniciante" },
    ],
    goal: "Organizar meus processos internos e aprender a contratar as primeiras pessoas do time.",
    availability: "2h",
  },
  {
    email: "eduardo@demo.jci",
    name: "Eduardo Nunes",
    roleTitle: "Consultor Sênior",
    city: "Fortaleza, CE",
    avatarColor: "#6E4A2E",
    teach: [
      { name: "Negociação", level: "avancado" },
      { name: "Storytelling", level: "avancado" },
      { name: "Vendas", level: "avancado" },
      { name: "Networking", level: "avancado" },
    ],
    learn: [{ name: "Tecnologia/IA", level: "iniciante" }],
    goal: "Usar IA para escalar minha consultoria sem perder personalização.",
    availability: "1h",
  },
];

const PLAN_LUCAS: MentorshipPlan = {
  generatedBy: "template",
  createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  sessions: [
    {
      number: 1,
      title: "Diagnóstico do processo comercial",
      objective: "Mapear o funil de vendas atual do Lucas e identificar onde os deals travam.",
      topics: ["Funil de vendas atual", "Principais perdas e motivos", "Perfil dos clientes enterprise"],
    },
    {
      number: 2,
      title: "Preparação e abertura de reuniões",
      objective: "Estruturar uma rotina de pre-call research e uma abertura que gere credibilidade.",
      topics: ["Research do decisor", "Estrutura de abertura", "Perguntas de diagnóstico"],
    },
    {
      number: 3,
      title: "Tratamento de objeções",
      objective: "Dominar as 5 objeções mais comuns em vendas enterprise e praticar respostas.",
      topics: ["Objeções de preço", "Objeções de timing", "Técnica de reenquadramento"],
    },
    {
      number: 4,
      title: "Simulação de fechamento",
      objective: "Role-play completo de uma negociação real com feedback estruturado do Marcos.",
      topics: ["Role-play do deal real", "Concessões e contrapartidas", "Próximos passos pós-mentoria"],
    },
  ],
};

const PLAN_PATRICIA: MentorshipPlan = {
  generatedBy: "template",
  createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  sessions: [
    {
      number: 1,
      title: "Autoconhecimento de liderança",
      objective: "Identificar o estilo de liderança atual da Patrícia e os gaps para o próximo nível.",
      topics: ["Estilo de liderança", "Feedbacks anteriores", "Momentos de maior impacto"],
    },
    {
      number: 2,
      title: "Delegação com segurança",
      objective: "Criar um framework de delegação que libere tempo da Patrícia sem perder qualidade.",
      topics: ["Matriz de delegação", "Níveis de autonomia", "Rituais de acompanhamento"],
    },
    {
      number: 3,
      title: "Comunicação executiva",
      objective: "Preparar a Patrícia para apresentar resultados para a diretoria com storytelling.",
      topics: ["Estrutura executiva", "Storytelling com dados", "Como pedir a promoção"],
    },
    {
      number: 4,
      title: "Plano de desenvolvimento",
      objective: "Consolidar um plano de 90 dias para a promoção a gerente sênior.",
      topics: ["Metas de 90 dias", "Padrinhos e visibilidade", "Rituais de revisão"],
    },
  ],
};

async function main() {
  console.log("Limpando banco...");
  await prisma.notification.deleteMany();
  await prisma.sessionPrep.deleteMany();
  await prisma.coachMessage.deleteMany();
  await prisma.task.deleteMany();
  await prisma.session.deleteMany();
  await prisma.mentorship.deleteMany();
  await prisma.profile.deleteMany();

  console.log("Criando 12 perfis...");
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

  console.log("Criando mentoria ativa #1: Marcos → Lucas");
  const m1 = await prisma.mentorship.create({
    data: {
      mentorId: ids["marcos@demo.jci"],
      menteeId: ids["lucas@demo.jci"],
      status: "active",
      inviteMessage:
        "Marcos, acompanho sua trajetória comercial na JCI e sei que você fechou contratos enterprise que eu só vejo nos meus sonhos. Quero muito aprender negociação com você!",
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
          "Mapeamos o funil de vendas do Lucas: 12 contas ativas, mas ele trata 'proposta enviada' como etapa final. Marcos trouxe o framework BANT e identificamos que o diagnóstico do decisor está fraco.",
        commitments:
          "Lucas: mapear os 3 principais decisores das contas estratégicas e gravar um pitch de 90s. Marcos: compartilhar template de pre-call research.",
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
        title: "Mapear os 3 decisores das contas estratégicas (framework BANT)",
        dueDate: daysFromNow(3, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m1.id,
        title: "Gravar pitch de 90 segundos e reouvir anotando 2 melhorias",
        dueDate: daysFromNow(2, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m1.id,
        title: "Ler template de pre-call research do Marcos",
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
          "Oi, **Lucas**! Que bom ter você por aqui.\n\nSua mentoria com **Marcos Ribeiro** já está rolando: na Sessão 1 vocês mapearam seu funil e descobriram que o ponto fraco é o **diagnóstico do decisor**. Você tem 2 tarefas pendentes nesta semana: mapear os 3 decisores com o framework BANT e gravar seu pitch de 90 segundos.\n\n**Ação concreta:** reserve 20 minutos hoje para listar os 3 decisores — amanhã a gente revisa junto antes da sessão de quinta com o Marcos.",
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      },
      {
        mentorshipId: m1.id,
        role: "user",
        content:
          "Coach, travei no mapeamento dos decisores. Não sei como descobrir quem decide sem parecer invasivo.",
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      },
      {
        mentorshipId: m1.id,
        role: "assistant",
        content:
          "Pergunta excelente — e totalmente legítima: ninguém gosta de parecer investigador.\n\nA dica conecta com o que vocês discutiram na Sessão 1: no framework **BANT** (Budget, Authority, Need, Timeline), autoridade se **descobre com perguntas de processo**, não de poder. Experimente: *\"Como funcionam normalmente as decisões de compra na área de vocês?\"* — essa pergunta revela quem assina sem apontar dedo.\n\nOutro caminho leve: o **LinkedIn** te dá o cargo, e o sinal de autoridade vem quando você pergunta *\"quem mais costuma opinar numa decisão desse tamanho?\"*.\n\n**Ação concreta:** escreva essa pergunta de processo no seu caderno de calls e teste na próxima conversa com uma das suas 3 contas estratégicas. Depois me conta o que descobriu!",
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 120000),
      },
    ],
  });

  console.log("Criando mentoria ativa #2: Marina → Patrícia");
  const m2 = await prisma.mentorship.create({
    data: {
      mentorId: ids["marina@demo.jci"],
      menteeId: ids["patricia@demo.jci"],
      status: "active",
      inviteMessage:
        "Marina, quero me preparar para liderar times maiores e você é a referência que mais admiro aqui na JCI quando o assunto é gestão. Topa me mentorar?",
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
          "Marina usou o modelo Situational Leadership para mapear o time da Patrícia. Ficou claro que a Patrícia microgerencia os juniores e sobrecarrega os seniores.",
        commitments:
          "Patrícia: escolher 2 entregas para delegar com nível de autonomia 'decido e aviso'. Marina: enviar o artigo da HBR sobre delegação.",
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
        title: "Delegar 2 entregas usando a matriz de autonomia da Sessão 1",
        dueDate: daysFromNow(4, 23, 59),
        completed: false,
        source: "coach",
      },
      {
        mentorshipId: m2.id,
        title: "Ler o artigo da HBR sobre delegação enviado pela Marina",
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
          "Oi, **Patrícia**!\n\nNa última sessão com a **Marina** vocês definiram um objetivo bem claro: delegar 2 entregas usando a matriz de autonomia (\"decido e aviso\"). Essa é a ponte entre a Sessão 1 e a Sessão 2, que vai falar sobre **delegação com segurança**.\n\n**Ação concreta:** antes de quinta-feira, escolha as 2 entregas que vão sair da sua mão — comece pelas que mais te consomem tempo e menos exigem sua assinatura técnica.",
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
    ],
  });

  console.log("Criando convite pendente: Rafael → Carlos (para demo do painel do mentor)");
  const m3 = await prisma.mentorship.create({
    data: {
      mentorId: ids["carlos@demo.jci"],
      menteeId: ids["rafael@demo.jci"],
      status: "pending",
      inviteMessage:
        "Carlos, estou construindo meu primeiro SaaS e preciso aprender a estruturar finanças de um negócio próprio. Sua visão de CFO + espírito JCI seria perfeita pra me guiar nessa jornada.",
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: ids["carlos@demo.jci"],
        type: "mentorship_invite",
        title: "Rafael Souza quer ser mentorado por você",
        body: "\"Carlos, estou construindo meu primeiro SaaS e preciso aprender a estruturar finanças...\"",
        payload: JSON.stringify({ mentorshipId: m3.id }),
        read: false,
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      },
      {
        userId: ids["lucas@demo.jci"],
        type: "session_scheduled",
        title: "Próxima sessão com Marcos agendada",
        body: "Sessão 2 · Preparação e abertura de reuniões",
        payload: JSON.stringify({ mentorshipId: m1.id }),
        read: false,
      },
      {
        userId: ids["patricia@demo.jci"],
        type: "session_scheduled",
        title: "Próxima sessão com Marina agendada",
        body: "Sessão 2 · Delegação com segurança",
        payload: JSON.stringify({ mentorshipId: m2.id }),
        read: false,
      },
    ],
  });

  console.log("\n✅ Seed concluído!");
  console.log(`   ${USERS.length} usuários · senha de todos: ${DEMO_PASSWORD}`);
  console.log("   Contas-chave: marcos@demo.jci (mentor), lucas@demo.jci (mentorado),");
  console.log("   carlos@demo.jci (mentor com convite pendente), admin@jci.org.br (admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
