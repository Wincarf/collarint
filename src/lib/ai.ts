// Dual-mode AI layer — JCI Collarint
//
// • With OPENAI_API_KEY: gpt-4o-mini (chat) + text-embedding-3-small (embeddings)
//   via the official REST API.
// • Without a key (demo fallback mode): chat via z-ai-web-dev-sdk (backend only) and
//   deterministic local embeddings (lexical hashing with light English stemming).
//
// No call fails due to a missing credential: the demo never breaks.

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

/** Tolerant JSON parse: strips code fences and grabs the first {...} block. */
export function parseLooseJSON<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/```(?:json)?/gi, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Chat asking for JSON; tolerant parse (strips code fences). */
export async function chatJSON<T>(messages: ChatMessage[]): Promise<T> {
  const raw = await chatComplete(messages, true);
  const parsed = parseLooseJSON<T>(raw);
  if (parsed === null) throw new Error("Invalid JSON reply");
  return parsed;
}

// ------------------------------------------------------------------ streaming chat

/** Replays an already-complete text as smooth word-by-word chunks (fallback mode). */
export async function simulateStream(text: string, onDelta: (chunk: string) => void): Promise<void> {
  const tokens = text.match(/\S+\s*/g) ?? [text];
  // Keep the whole replay under ~4s regardless of reply length.
  const group = Math.max(1, Math.ceil(tokens.length / 200));
  for (let i = 0; i < tokens.length; i += group) {
    onDelta(tokens.slice(i, i + group).join(""));
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

/**
 * Streams a plain-text reply (no JSON wrapper), calling onDelta for each chunk
 * and returning the full text.
 * • OpenAI mode: real SSE token streaming from the API.
 * • Fallback mode: full SDK reply replayed as smooth simulated chunks.
 */
export async function streamChatComplete(
  messages: ChatMessage[],
  onDelta: (chunk: string) => void
): Promise<string> {
  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const chunk: string | undefined = json?.choices?.[0]?.delta?.content;
          if (chunk) {
            full += chunk;
            onDelta(chunk);
          }
        } catch {
          // partial SSE line — ignored
        }
      }
    }
    if (!full.trim()) throw new Error("OpenAI stream: empty response");
    return full;
  }

  // Fallback: one full SDK call, replayed as a smooth stream for the user.
  const text = await zaiChat(messages);
  await simulateStream(text, onDelta);
  return text;
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

/** Post-reply action extraction: which tasks to create and which pending tasks to mark as done. */
export const COACH_EXTRACT_SYSTEM = `You extract mentoring actions from a coaching conversation.
Return ONLY a single valid JSON object, with no text outside the JSON:
{"tasks": [{"title": "concrete task", "dueInDays": 7}], "completeTasks": ["title copied from the pending task list"]}
Rules:
- "tasks": at most 1; create one ONLY when the mentee explicitly commits to a NEW future action ("I will...", "I commit to...", "can you set that up?") or asks for help organizing something. If the mentee is only reporting back that they already finished something, do NOT create a task — use "completeTasks" for that. "dueInDays" is an integer from 1 to 30. Otherwise use [].
- "completeTasks": copy the title from the PENDING TASK LIST that the mentee explicitly said they finished, did or completed. Never guess. Otherwise use [].
- Titles in "tasks" must describe the ACTION, not quote the mentee (max. 12 words). Never use the mentee's whole message as a title.`;
