// Camada de IA dual-mode — JCI Collarint
//
// • Com OPENAI_API_KEY: gpt-4o-mini (chat) + text-embedding-3-small (embeddings)
//   via REST API oficial.
// • Sem chave (modo fallback da demo): chat via z-ai-web-dev-sdk (backend only) e
//   embeddings locais determinísticos (hashing lexical com stemming PT-BR).
//
// Nenhuma chamada falha por ausência de credencial: a demo nunca quebra.

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
  if (!content) throw new Error("OpenAI chat: resposta vazia");
  return content as string;
}

async function zaiChat(messages: ChatMessage[]): Promise<string> {
  // O SDK usa 'assistant' no papel de system (convenção da plataforma).
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
  if (!content) throw new Error("z-ai chat: resposta vazia");
  return content;
}

export async function chatComplete(messages: ChatMessage[], jsonMode = false): Promise<string> {
  if (OPENAI_KEY) {
    return openaiChat(messages, jsonMode);
  }
  return zaiChat(messages);
}

/** Chat pedindo JSON; faz parse tolerante (remove cercas de código). */
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

const PT_STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "para", "com", "um",
  "uma", "que", "no", "na", "nos", "nas", "por", "ao", "aos", "seu", "sua", "meu",
  "minha", "mais", "como", "ser", "estar", "quero", "aprender", "ensinar", "sobre",
  "poder", "quero", "voce", "eu", "me", "muito", "onde", "quais", "qual", "tambem",
]);

// Expansão de sinônimos/acrônimos comuns no contexto JCI
const SYNONYMS: Record<string, string[]> = {
  ia: ["inteligencia", "artificial", "tecnologia"],
  "inteligencia artificial": ["tecnologia", "ia"],
  tech: ["tecnologia"],
  rh: ["recursos", "humanos"],
  "marketing digital": ["marketing", "digital", "instagram", "social"],
  social: ["marketing", "digital"],
  pitch: ["apresentacao", "comunicacao", "publico"],
  oratoria: ["comunicacao", "publico", "falar"],
  fala: ["comunicacao", "publico"],
  "gestao de projetos": ["projetos", "gestao", "pmo"],
  projetos: ["gestao", "projetos"],
  startup: ["empreendedorismo", "negocio"],
  negocio: ["empreendedorismo", "vendas"],
  vendas: ["comercial", "negociacao", "clientes"],
  comercial: ["vendas", "negociacao"],
  lideranca: ["gestao", "equipe", "lider"],
  lider: ["lideranca", "equipe"],
  feedback: ["comunicacao", "lideranca"],
  dinheiro: ["financas"],
  financeiro: ["financas"],
  investir: ["financas"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Stemmer leve para português — reduz flexões comuns. */
function lightStem(token: string): string {
  let t = token;
  if (t.length > 4) {
    if (t.endsWith("coes") || t.endsWith("scoes")) t = t.slice(0, -4) + "ao";
    else if (t.endsWith("coes") === false && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
    if (t.endsWith("mente")) t = t.slice(0, -5);
  }
  if (t.length > 5) {
    if (t.endsWith("amento") || t.endsWith("imento")) t = t.slice(0, -6);
    else if (t.endsWith("dade") || t.endsWith("ncia")) t = t.slice(0, -4);
  }
  return t;
}

function tokenize(text: string): string[] {
  const normalized = stripAccents(text.toLowerCase());
  const raw = normalized.split(/[^a-z0-9/]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const tok of raw) {
    if (tok.includes("/") && tok.length > 1) {
      // ex: tecnologia/ia → tecnologia + ia
      for (const part of tok.split("/")) if (part) tokens.push(part);
      continue;
    }
    if (PT_STOPWORDS.has(tok) || tok.length < 2) continue;
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
 * Embedding local determinístico (fallback): TF ponderado sobre unigramas
 * stemizados + bigramas + expansão de sinônimos, normalizado (L2).
 * Suficiente para similaridade de cosseno entre "quero aprender" e "posso ensinar".
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
 * Gera embedding no modo disponível. Nunca lança: se o OpenAI falhar,
 * cai para o embedding local.
 */
export async function embedText(text: string): Promise<{ mode: "local" | "openai"; vector: number[] }> {
  if (OPENAI_KEY) {
    try {
      const vector = await openaiEmbedding(text);
      if (vector.length > 0) return { mode: "openai", vector };
    } catch {
      // cai para o modo local
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

// ------------------------------------------------------------------ prompts do domínio

export const COACH_SYSTEM_BASE = `Você é o Coach Collarint, o coach de IA da plataforma de mentoria da JCI (Junior Chamber International) Brasil.
Seu papel é apoiar o MENTORADO entre as sessões com o mentor. Regras:
- Tom: encorajador, prático e objetivo. Português do Brasil. Trate o mentorado por nome ou "você".
- SEMPRE use o contexto da mentoria (objetivo, plano, sessões anteriores, tarefas) — nunca responda de forma genérica.
- Referencie progresso real: cite o que foi discutido nas sessões, os compromissos assumidos e as tarefas pendentes pelo nome.
- SEMPRE encerre a resposta sugerindo UMA ação concreta e específica para os próximos dias.
- Seja conciso: 2 a 4 parágrafos curtos no máximo. Use markdown leve (negrito, listas curtas) quando ajudar.`;

export const COACH_JSON_INSTRUCTION = `Formato OBRIGATÓRIO da resposta: um único objeto JSON válido, sem texto fora do JSON:
{"reply": "sua resposta em markdown leve", "tasks": [{"title": "tarefa concreta", "dueInDays": 7}]}
Regras para "tasks": crie no máximo 1 tarefa por resposta; crie APENAS quando o mentorado assumir um compromisso novo ou pedir ajuda para organizar algo; "dueInDays" é um número inteiro de 1 a 30. Se não houver tarefa nova, use "tasks": [].`;
