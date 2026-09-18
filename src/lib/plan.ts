// Geração do plano de mentoria de 4 sessões (IA com fallback determinístico)

import type { MentorshipPlan, PlanSession } from "./types";
import type { Profile } from "@prisma/client";
import { chatJSON, aiMode } from "./ai";
import type { SkillEntry } from "./types";
import { parsePlan } from "./serialize";

function planSystemPrompt(): string {
  return `Você é o Coach Collarint, IA da plataforma de mentoria da JCI Brasil.
Sua tarefa é criar um PLANO DE MENTORIA de exatamente 4 sessões para um par mentor/mentorado.
O plano deve ser específico para o objetivo do mentorado e alavancar as skills do mentor — nada genérico.

Responda APENAS com JSON válido no formato:
{"sessions":[{"number":1,"title":"título curto da sessão","objective":"objetivo claro de 1 frase","topics":["tópico 1","tópico 2","tópico 3"]}]}
Regras: exatamente 4 sessões numeradas de 1 a 4; a Sessão 1 é sempre diagnóstico/alinhamento; a Sessão 4 consolida e deixa um plano de continuidade; os títulos devem ser específicos do contexto (nada como "Sessão 2").`;
}

function planUserPrompt(menteeName: string, menteeGoal: string | null, menteeLearn: SkillEntry[], mentorName: string, mentorTeach: SkillEntry[]): string {
  const fmt = (s: SkillEntry) => `${s.name} (${s.level})`;
  return `Mentorado: ${menteeName}
Objetivo principal do mentorado: ${menteeGoal ?? "(não informado)"}
Habilidades que o mentorado quer desenvolver: ${menteeLearn.map(fmt).join(", ") || "(não informado)"}

Mentor: ${mentorName}
Habilidades que o mentor ensina: ${mentorTeach.map(fmt).join(", ") || "(não informado)"}

Crie o plano de 4 sessões.`;
}

/** Plano determinístico de qualidade — usado como fallback quando IA não está disponível. */
export function buildTemplatePlan(mentee: Profile, mentor: Profile, menteeLearn: SkillEntry[], mentorTeach: SkillEntry[]): MentorshipPlan {
  const first = mentor.name.split(" ")[0];
  const goal = mentee.mainGoal ?? "desenvolver as habilidades buscadas";
  const skillA = menteeLearn[0]?.name ?? mentorTeach[0]?.name ?? "o tema central";
  const skillB = menteeLearn[1]?.name ?? skillA;
  const sessions: PlanSession[] = [
    {
      number: 1,
      title: "Diagnóstico e alinhamento de expectativas",
      objective: `Mapear o ponto de partida do desenvolvimento e conectar o objetivo ao contexto real.`,
      topics: ["Situação atual e desafios", "Prioridades do objetivo", "Expectativas da mentoria"],
    },
    {
      number: 2,
      title: `Fundamentos práticos de ${skillA}`,
      objective: `Transferir a experiência de ${first} em ${skillA} com casos reais e frameworks aplicáveis.`,
      topics: [`${skillA} na prática`, "Casos reais do mentor", "Framework aplicado ao contexto"],
    },
    {
      number: 3,
      title: `Aprofundamento em ${skillB === skillA ? "situações difíceis do dia a dia" : skillB}`,
      objective: "Trabalhar situações reais trazidas pelo mentorado com feedback direto do mentor.",
      topics: ["Situações reais do mentorado", "Feedback do mentor", "Ajustes de rota"],
    },
    {
      number: 4,
      title: "Consolidação e plano de continuidade",
      objective: "Consolidar aprendizados e definir o plano de desenvolvimento pós-mentoria.",
      topics: ["Revisão do progresso", "Próximos 90 dias", "Compromissos finais"],
    },
  ];
  return { generatedBy: "template", createdAt: new Date().toISOString(), sessions };
}

/**
 * Gera o plano com IA; se falhar (sem chave ou erro), usa o template.
 * Nunca lança.
 */
export async function generatePlan(
  mentee: Profile,
  mentor: Profile,
  menteeLearn: SkillEntry[],
  mentorTeach: SkillEntry[]
): Promise<MentorshipPlan> {
  if (aiMode() === "openai") {
    try {
      const raw = await chatJSON<{ sessions: PlanSession[] }>([
        { role: "system", content: planSystemPrompt() },
        {
          role: "user",
          content: planUserPrompt(mentee.name, mentee.mainGoal, menteeLearn, mentor.name, mentorTeach),
        },
      ]);
      if (Array.isArray(raw.sessions) && raw.sessions.length === 4) {
        const sessions = raw.sessions.map((s, i) => ({
          number: i + 1,
          title: String(s.title ?? `Sessão ${i + 1}`).slice(0, 80),
          objective: String(s.objective ?? "").slice(0, 300),
          topics: Array.isArray(s.topics) ? s.topics.slice(0, 4).map((t) => String(t).slice(0, 80)) : [],
        }));
        return { generatedBy: "ai", createdAt: new Date().toISOString(), sessions };
      }
    } catch (e) {
      console.error("[plan] IA falhou, usando template:", e);
    }
  }
  return buildTemplatePlan(mentee, mentor, menteeLearn, mentorTeach);
}

export { parsePlan };
