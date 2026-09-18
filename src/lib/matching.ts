// Motor de matching semântico — JCI Collarint
//
// Score final = blend de duas evidências:
//   1. Similaridade de cosseno entre o embedding de "quero aprender" (mentee)
//      e o embedding de "posso ensinar" (mentor)
//   2. Overlap ponderado de skills por nome (nível do mentor pesa mais)
// A frase explicativa usa IA quando disponível; senão, template data-driven.

import type { EmbeddingPayload, SkillEntry } from "./types";
import { cosineSimilarity, localEmbedding } from "./ai";
import { stripAccentsSafe } from "./text";

export interface EmbeddableProfile {
  id: string;
  name: string;
  teachSkills: SkillEntry[];
  learnSkills: SkillEntry[];
  mainGoal: string | null;
  teachEmbedding: EmbeddingPayload | null;
  learnEmbedding: EmbeddingPayload | null;
}

export function teachTextOf(p: EmbeddableProfile): string {
  return (
    "Posso ensinar: " +
    p.teachSkills.map((s) => `${s.name} (nível ${s.level})`).join(", ") +
    (p.mainGoal ? `. Contexto: ${p.mainGoal}` : "")
  );
}

export function learnTextOf(p: EmbeddableProfile): string {
  return (
    "Quero aprender: " +
    p.learnSkills.map((s) => `${s.name} (nível ${s.level})`).join(", ") +
    (p.mainGoal ? `. Meu objetivo: ${p.mainGoal}` : "")
  );
}

function normName(s: string): string {
  return stripAccentsSafe(s.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter((t) => t.length > 1));
}

/** Verifica se duas skills são "a mesma" (igualdade normalizada ou contenção de tokens). */
export function skillsMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

export const LEVEL_WEIGHT: Record<SkillEntry["level"], number> = {
  iniciante: 0.55,
  intermediario: 0.8,
  avancado: 1.0,
};

export interface SkillOverlapResult {
  ratio: number;
  matched: string[];
  top: string | null;
  learnCount: number;
}

/** Overlap ponderado: fração das skills buscadas que o mentor domina, ponderada pelo nível. */
export function skillOverlap(learn: SkillEntry[], teach: SkillEntry[]): SkillOverlapResult {
  if (learn.length === 0) return { ratio: 0, matched: [], top: null, learnCount: 0 };
  let weightSum = 0;
  const matched: string[] = [];
  let top: string | null = null;
  let topWeight = -1;
  for (const l of learn) {
    let best = 0;
    for (const t of teach) {
      if (skillsMatch(l.name, t.name)) best = Math.max(best, LEVEL_WEIGHT[t.level]);
    }
    if (best > 0) {
      matched.push(l.name);
      weightSum += best;
      if (best > topWeight) {
        topWeight = best;
        top = l.name;
      }
    }
  }
  return { ratio: weightSum / learn.length, matched, top, learnCount: learn.length };
}

function getVector(p: EmbeddableProfile, kind: "teach" | "learn"): EmbeddingPayload | null {
  return kind === "teach" ? p.teachEmbedding : p.learnEmbedding;
}

/** Cosseno tolerante a modos diferentes de embedding (recalcula lexical se necessário). */
export function semanticScore(mentee: EmbeddableProfile, mentor: EmbeddableProfile): number {
  const a = getVector(mentee, "learn");
  const b = getVector(mentor, "teach");
  if (a && b && a.vector.length === b.vector.length && a.vector.length > 0) {
    const cos = cosineSimilarity(a.vector, b.vector);
    return Math.max(0, Math.min(1, (cos + 1) / 2));
  }
  const cos = cosineSimilarity(localEmbedding(learnTextOf(mentee)), localEmbedding(teachTextOf(mentor)));
  return Math.max(0, Math.min(1, (cos + 1) / 2));
}

export interface ScoredMatch {
  mentor: EmbeddableProfile;
  score: number; // 0..1
  overlap: SkillOverlapResult;
  semantic: number;
  learnCount: number;
}

export function scoreMatch(mentee: EmbeddableProfile, mentor: EmbeddableProfile): ScoredMatch {
  const semantic = semanticScore(mentee, mentor);
  const overlap = skillOverlap(mentee.learnSkills, mentor.teachSkills);
  const score = 0.55 * overlap.ratio + 0.45 * semantic;
  return { mentor, score, overlap, semantic, learnCount: mentee.learnSkills.length };
}

/** Frase explicativa sem IA — data-driven, com os números reais do match. */
export function fallbackReason(m: ScoredMatch): string {
  const first = m.mentor.name.split(" ")[0];
  const { matched, top, learnCount } = m.overlap;
  if (matched.length > 0) {
    const skills =
      matched.length === 1
        ? matched[0]
        : matched.slice(0, -1).join(", ") + " e " + matched[matched.length - 1];
    return `${first} domina ${matched.length} de ${learnCount} habilidades que você busca — ${skills}. Destaque para ${top ?? matched[0]}, onde a experiência do mentor é mais profunda.`;
  }
  const strongest = [...m.mentor.teachSkills].sort(
    (a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]
  )[0];
  return `A experiência de ${first} em ${strongest?.name ?? "suas habilidades"} conversa com o seu objetivo — a conexão veio da análise semântica do que você busca e do que ele ensina.`;
}
