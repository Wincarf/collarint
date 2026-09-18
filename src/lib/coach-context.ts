// Construtor de contexto do IA Coach — garante que o coach NUNCA responda
// de forma genérica: injeta objetivo, plano, histórico de sessões e tarefas.

import type { CoachMessage, Mentorship, Profile, Session, Task } from "@prisma/client";
import { parsePlan, parseSkills } from "./serialize";

function fmtDate(d: Date | null): string {
  if (!d) return "a definir";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export interface MentorshipBundle {
  mentorship: Mentorship;
  mentee: Profile;
  mentor: Profile;
  sessions: Session[];
  tasks: Task[];
  messages: CoachMessage[];
}

export function buildCoachContext(b: MentorshipBundle): string {
  const plan = parsePlan(b.mentorship.plan);
  const pendingTasks = b.tasks.filter((t) => !t.completed);
  const doneTasks = b.tasks.filter((t) => t.completed);
  const completedSessions = b.sessions.filter((s) => s.completed);
  const nextSession = b.sessions.find((s) => !s.completed && s.scheduledAt && s.scheduledAt > new Date());
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];

  const lines: string[] = [];
  lines.push(`## CONTEXTO DA MENTORIA`);
  lines.push(`- Mentorado: ${b.mentee.name} (${b.mentee.roleTitle ?? "membro JCI"})`);
  lines.push(`- Mentor: ${b.mentor.name} (${b.mentor.roleTitle ?? "membro JCI"})`);
  lines.push(
    `- Skills que o mentor ensina: ${parseSkills(b.mentor.teachSkills).map((s) => `${s.name} (${s.level})`).join(", ") || "não informado"}`
  );
  lines.push(`- Objetivo principal do mentorado: ${b.mentee.mainGoal ?? "não informado"}`);
  lines.push(
    `- Habilidades que o mentorado quer desenvolver: ${parseSkills(b.mentee.learnSkills).map((s) => s.name).join(", ") || "não informado"}`
  );
  lines.push(`- Disponibilidade semanal do mentorado: ${b.mentee.weeklyAvailability ?? "não informada"}`);

  if (plan) {
    lines.push(`\n## PLANO DE MENTORIA (${plan.sessions.length} sessões)`);
    for (const s of plan.sessions) {
      lines.push(`- Sessão ${s.number} — ${s.title}: ${s.objective} (tópicos: ${s.topics.join("; ")})`);
    }
  }

  lines.push(`\n## SESSÕES (${completedSessions.length} realizadas)`);
  if (completedSessions.length === 0) {
    lines.push("- Nenhuma sessão realizada ainda.");
  }
  for (const s of completedSessions) {
    lines.push(`- Sessão de ${fmtDate(s.scheduledAt)}:`);
    if (s.notes) lines.push(`  · O que foi discutido: ${s.notes}`);
    if (s.commitments) lines.push(`  · Compromissos assumidos: ${s.commitments}`);
  }
  if (nextSession) {
    lines.push(`- PRÓXIMA SESSÃO agendada: ${fmtDate(nextSession.scheduledAt)}`);
  }

  lines.push(`\n## TAREFAS`);
  lines.push(`- Pendentes (${pendingTasks.length}):`);
  for (const t of pendingTasks) lines.push(`  · ${t.title}${t.dueDate ? ` (prazo: ${fmtDate(t.dueDate)})` : ""}`);
  if (pendingTasks.length === 0) lines.push("  · nenhuma");
  if (doneTasks.length > 0) {
    lines.push(`- Concluídas (${doneTasks.length}): ${doneTasks.map((t) => t.title).join("; ")}`);
  }

  const recent = [...b.messages]
    .sort((a, c) => a.createdAt.getTime() - c.createdAt.getTime())
    .slice(-8);
  if (recent.length > 0) {
    lines.push(`\n## ÚLTIMAS MENSAGENS DO COACH (${menteeFirst} ↔ você)`);
    for (const m of recent) {
      const who = m.role === "user" ? menteeFirst : "Coach";
      lines.push(`- ${who}: ${m.content.slice(0, 400)}`);
    }
  }

  lines.push(
    `\nDiretriz de abertura: cumprimente ${menteeFirst} pelo nome, mostre que você conhece o estado atual da mentoria dele com ${mentorFirst} (cite plano, sessões e tarefas reais) e vá direto ao ponto.`
  );
  return lines.join("\n");
}

/** Prompt de preparação de sessão (pauta + 5 perguntas). */
export function buildPrepPrompt(b: MentorshipBundle, nextPlanSession: string | null): string {
  const context = buildCoachContext(b);
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];
  return `${context}

## TAREFA
Gere a PREPARAÇÃO DE SESSÃO para ${menteeFirst} levar à próxima sessão com ${mentorFirst}.
${nextPlanSession ? `A próxima sessão do plano é: "${nextPlanSession}".` : "Baseie-se no estado atual da mentoria."}

Formato exato da resposta (markdown, em português):

## Pauta da próxima sessão
1. [item de abertura — 2 a 3 min]
2. [item central conectado ao plano e às tarefas pendentes]
3. [item central 2]
4. [item de fechamento — alinhar compromissos e próximo passo]

## 5 perguntas para levar ao mentor
1. [pergunta específica e aberta]
2. ...
5. [pergunta final sobre próximos passos]

## Lembrete
[1 frase curta de compromisso pendente relevante, se houver]

Regras: as perguntas devem ser específicas do contexto (objetivo, plano, últimas sessões, tarefas pendentes) — proibido pergunta genérica tipo "como posso melhorar?". Máximo de 250 palavras no total.`;
}

export function buildTemplatePrep(b: MentorshipBundle, nextPlanSession: string | null): string {
  const menteeFirst = b.mentee.name.split(" ")[0];
  const mentorFirst = b.mentor.name.split(" ")[0];
  const plan = parsePlan(b.mentorship.plan);
  const pending = b.tasks.filter((t) => !t.completed);
  const goal = b.mentee.mainGoal ?? "seu objetivo de desenvolvimento";
  const nextTitle = nextPlanSession ?? "o próximo passo do plano";

  const questions = [
    `Como essa etapa (${nextTitle}) apareceu na sua própria trajetória, ${mentorFirst}?`,
    `Quais erros mais comuns você vê quem começa a trabalhar isso cometer — e como evitar?`,
    `Considerando meu objetivo ("${goal.slice(0, 90)}"), por onde devo começar esta semana?`,
    pending.length > 0
      ? `Sobre a tarefa "${pending[0].title}": o que você faria diferente no meu lugar?`
      : `Como eu sei que estou progredindo de verdade nessa habilidade?`,
    `O que precisaria ser verdade daqui a 2 sessões para considerarmos essa etapa vencida?`,
  ];

  return `## Pauta da próxima sessão
1. Check-in rápido — como foi a semana e o status das tarefas (5 min)
2. ${nextTitle} — contexto e expectativas (15 min)
3. Dúvidas trazidas por ${menteeFirst} com base no objetivo de mentoria (20 min)
4. Fechamento — compromissos da semana e data da próxima (10 min)

## 5 perguntas para levar ao mentor
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

## Lembrete
${pending.length > 0 ? `Você tem ${pending.length} tarefa(s) pendente(s): "${pending[0].title}".` : `Todas as tarefas estão em dia — ótimo, ${menteeFirst}!`}`;
}
