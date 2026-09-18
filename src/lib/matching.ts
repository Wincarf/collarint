// Semantic matching engine — JCI Collarint
//
// Final score = blend of two pieces of evidence:
//   1. Cosine similarity between the "want to learn" embedding (mentee)
//      and the "can teach" embedding (mentor)
//   2. Weighted skill overlap by name (mentor's level weighs more)
// The explanatory sentence uses AI when available; otherwise a data-driven template.

import type { EmbeddingPayload, SkillEntry } from "./types";
import { LEVEL_LABELS } from "./types";
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
    "Skills I can teach: " +
    p.teachSkills.map((s) => `${s.name} (${LEVEL_LABELS[s.level] ?? s.level} level)`).join(", ") +
    (p.mainGoal ? `. Context: ${p.mainGoal}` : "")
  );
}

export function learnTextOf(p: EmbeddableProfile): string {
  return (
    "Skills I want to learn: " +
    p.learnSkills.map((s) => `${s.name} (${LEVEL_LABELS[s.level] ?? s.level} level)`).join(", ") +
    (p.mainGoal ? `. My goal: ${p.mainGoal}` : "")
  );
}

function normName(s: string): string {
  return stripAccentsSafe(s.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter((t) => t.length > 1));
}

/** Checks whether two skills are "the same" (normalized equality or token containment). */
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

/** Weighted overlap: fraction of the sought skills the mentor masters, weighted by level. */
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

/** Cosine tolerant to different embedding modes (recomputes lexically if needed). */
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

/** Explanatory sentence without AI — data-driven, with the match's real numbers. */
export function fallbackReason(m: ScoredMatch): string {
  const first = m.mentor.name.split(" ")[0];
  const { matched, top, learnCount } = m.overlap;
  if (matched.length > 0) {
    const skills =
      matched.length === 1
        ? matched[0]
        : matched.slice(0, -1).join(", ") + " and " + matched[matched.length - 1];
    return `${first} masters ${matched.length} of the ${learnCount} skills you are looking for — ${skills}. Standout: ${top ?? matched[0]}, where the mentor's experience runs deepest.`;
  }
  const strongest = [...m.mentor.teachSkills].sort(
    (a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]
  )[0];
  return `${first}'s experience in ${strongest?.name ?? "the skills you need"} speaks to your goal — the connection came from the semantic analysis of what you are looking for and what they teach.`;
}
