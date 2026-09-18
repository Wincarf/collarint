// Dual-mode AI layer — JCI Collarint
//
// • With OPENAI_API_KEY: gpt-4o-mini (chat) + text-embedding-3-small (embeddings)
//   via the official REST API.
// • Without a key (demo fallback mode): chat via z-ai-web-dev-sdk (backend only) and
//   deterministic local embeddings (lexical hashing with light English stemming).
//
// No call fails due to a missing credential: the demo never breaks.

import type { CoachChatResult } from "./types";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

export function aiMode(): "openai" | "fallback" {
  return OPENAI_KEY ? "openai" : "fallback";
}

// ------------------------------------------------------------------ chat

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function openaiChat(messages: ChatMessage[], jsonMode = false): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: jsonMode ? 0.4 : 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI chat ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI chat: empty response");
  return content as string;
}

async function zaiChat(messages: ChatMessage[]): Promise<string> {
  // The SDK expects 'assistant' for system-level prompts (platform convention).
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const converted = messages.map((m) => ({
    role: m.role === "system" ? ("assistant" as const) : (m.role as "user" | "assistant"),
    content: m.content,
  }));
  const completion = await zai.chat.completions.create({
    messages: converted,
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("z-ai chat: empty response");
  return content;
}

export async function chatComplete(messages: ChatMessage[], jsonMode = false): Promise<string> {
  if (OPENAI_KEY) {
    return openaiChat(messages, jsonMode);
  }
  return zaiChat(messages);
}

/** Chat asking for JSON; tolerant parse (strips code fences). */
export async function chatJSON<T>(messages: ChatMessage[]): Promise<T> {
  const raw = await chatComplete(messages, true);
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const candidate = start >= 0 ? cleaned.slice(start) : cleaned;
  return JSON.parse(candidate) as T;
}

// ------------------------------------------------------------------ embeddings

const EMBED_DIM = 256;

const EN_STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "for", "with", "and", "or", "at", "by",
  "my", "your", "our", "their", "i", "me", "you", "we", "is", "are", "am", "be",
  "being", "been", "was", "were", "want", "wants", "learn", "learning", "teach",
  "teaching", "about", "more", "how", "what", "which", "also", "very", "where",
  "can", "could", "will", "would", "skill", "skills", "some", "any", "do", "does",
]);

// Synonym/acronym expansion common in the JCI context
const SYNONYMS: Record<string, string[]> = {
  ai: ["artificial", "intelligence", "technology"],
  "artificial intelligence": ["technology", "ai"],
  tech: ["technology"],
  hr: ["human", "resources"],
  "digital marketing": ["marketing", "social", "instagram"],
  social: ["marketing", "digital"],
  pitch: ["presentation", "communication", "public"],
  "public speaking": ["communication", "presentation", "speaking"],
  speaking: ["communication", "public"],
  "project management": ["projects", "management", "pmo"],
  projects: ["management", "project"],
  startup: ["entrepreneurship", "business"],
  business: ["entrepreneurship", "sales"],
  sales: ["commercial", "negotiation", "clients"],
  commercial: ["sales", "negotiation"],
  leadership: ["management", "team", "leader"],
  leader: ["leadership", "team"],
  feedback: ["communication", "leadership"],
  money: ["finance"],
  financial: ["finance"],
  investing: ["finance", "investment"],
  recruiting: ["human", "resources"],
  hiring: ["human", "resources"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Light English stemmer — reduces common inflections. */
function lightStem(token: string): string {
  let t = token;
  if (t.length > 4) {
    if (t.endsWith("ies")) t = t.slice(0, -3) + "y";
    else if (t.endsWith("sses") || t.endsWith("shes") || t.endsWith("ches")) t = t.slice(0, -2);
    else if (t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) t = t.slice(0, -1);
  }
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  if (t.length > 5 && t.endsWith("ly")) t = t.slice(0, -2);
  return t;
}

function tokenize(text: string): string[] {
  const normalized = stripAccents(text.toLowerCase());
  const raw = normalized.split(/[^a-z0-9/]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const tok of raw) {
    if (tok.includes("/") && tok.length > 1) {
      // e.g. technology/ai → technology + ai
      for (const part of tok.split("/")) if (part) tokens.push(part);
      continue;
    }
    if (EN_STOPWORDS.has(tok) || tok.length < 2) continue;
    tokens.push(tok);
  }
  return tokens;
}

function hashToken(token: string, bucketSeed = 0): number {
  let h = 2166136261 ^ bucketSeed;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBED_DIM;
}

/**
 * Deterministic local embedding (fallback): weighted TF over stemmed unigrams
 * + bigrams + synonym expansion, L2-normalized.
 * Good enough for cosine similarity between "skills I want to learn" and
 * "skills I can teach".
 */
export function localEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text);

  const add = (token: string, weight: number) => {
    vec[hashToken(token)] += weight;
  };

  for (let i = 0; i < tokens.length; i++) {
    const stemmed = lightStem(tokens[i]);
    add(stemmed, 1.0);
    if (i > 0) add(`${lightStem(tokens[i - 1])}_${stemmed}`, 1.5); // bigrama
    for (const syn of SYNONYMS[tokens[i]] ?? []) add(lightStem(syn), 0.6);
  }
  for (const phrase of Object.keys(SYNONYMS)) {
    if (phrase.includes(" ") && stripAccents(text.toLowerCase()).includes(phrase)) {
      for (const syn of SYNONYMS[phrase]) add(lightStem(syn), 1.2);
    }
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function openaiEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? [];
}

/**
 * Generates the embedding in the available mode. Never throws: if OpenAI fails,
 * it falls back to the local embedding.
 */
export async function embedText(text: string): Promise<{ mode: "local" | "openai"; vector: number[] }> {
  if (OPENAI_KEY) {
    try {
      const vector = await openaiEmbedding(text);
      if (vector.length > 0) return { mode: "openai", vector };
    } catch {
      // falls back to local mode
    }
  }
  return { mode: "local", vector: localEmbedding(text) };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ------------------------------------------------------------------ domain prompts

export const COACH_SYSTEM_BASE = `You are the Collarint Coach, the AI coach of the JCI (Junior Chamber International) mentoring platform.
Your role is to support the MENTEE between sessions with their mentor. Rules:
- Tone: encouraging, practical and direct. Always reply in English. Address the mentee by name or as "you".
- ALWAYS use the mentorship context (goal, plan, past sessions, tasks) — never answer in a generic way.
- Reference real progress: cite what was discussed in sessions, the commitments made and pending tasks by name.
- ALWAYS end your reply by suggesting ONE concrete, specific action for the next few days.
- Be concise: 2 to 4 short paragraphs at most. Use light markdown (bold, short lists) when it helps.`;

export const COACH_JSON_INSTRUCTION = `MANDATORY reply format: a single valid JSON object, no text outside the JSON:
{"reply": "your reply in light markdown", "tasks": [{"title": "concrete task", "dueInDays": 7}]}
Rules for "tasks": create at most 1 task per reply; create one ONLY when the mentee commits to something new or asks for help organizing something; "dueInDays" is an integer from 1 to 30. If there is no new task, use "tasks": [].`;
