# Worklog — JCI Collarint

---
Task ID: 1
Agent: Super Z (main)
Task: Setup do projeto JCI Collarint — plataforma de mentoria por skill matching (MVP hackathon)

Work Log:
- Ambiente fullstack inicializado (Next.js 16 App Router + TS + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Decisões confirmadas com o usuário: banco híbrido (SQLite local p/ demo + supabase/schema.sql entregue), IA com fallback (OpenAI se OPENAI_API_KEY, senão z-ai-web-dev-sdk + matching léxico), auth email+senha com cookie httpOnly, escopo MVP completo
- prisma/schema.prisma criado: Profile, Mentorship, Session, Task, CoachMessage, SessionPrep, Notification
- db push executado com sucesso

Stage Summary:
- Arquitetura: SPA single-route (`/`) + API routes em `/api/*` (constraint do sandbox: usuário só acessa a rota raiz)
- Design: navy #0A1F44, dourado #D4A843, fundo claro, pt-BR
- Auth: scrypt + HMAC cookie (lib/auth.ts), migrável para Supabase Auth

---
Task ID: 2
Agent: Super Z (main)
Task: Construção completa do MVP JCI Collarint (stack, dados, APIs, UI, entregáveis, QA)

Work Log:
- Libs core: types.ts, skills.ts (12 skills + avatares), auth.ts (scrypt + cookie HMAC httpOnly), ai.ts (dual-mode: OpenAI gpt-4o-mini/text-embedding-3-small ⇄ fallback z-ai SDK + embedding léxico local com stemming PT-BR), matching.ts (cosseno + overlap ponderado de skills), plan.ts (plano 4 sessões IA⇄template), coach-context.ts (contexto completo do coach), serialize.ts
- API routes (16): auth (register/login/logout/me), profile (PUT com embeddings), matches (top 5 + razões IA em 1 chamada), mentorships (listar/propor), [id] (detalhe), respond (aceite gera plano + welcome message + notificação), sessions (schedule/record/complete), coach (histórico + chat JSON com criação de tarefas), prepare (pauta + 5 perguntas persistida), tasks (CRUD), notifications, admin/stats (heatmap + métricas)
- UI SPA (rota única): login com 4 acessos rápidos demo, wizard onboarding 3 passos, home com mentorias/sessão/tarefas, matches com score rings e razões, mentorship-view (trilha do plano, sessões, tarefas, IA Coach chat com markdown, preparar sessão + copiar), painel do mentor (aceitar/recusar, agendar via calendar, ver preparação do mentorado), dashboard admin (6 métricas + heatmap abunda/rara)
- Entregáveis: supabase/schema.sql (tabelas + triggers + RLS + dica pgvector), .env.example documentado, README com setup em 5 passos + contas demo + fluxo de demonstração
- QA: bun run lint limpo, tsc limpo (exceto examples/ pré-existentes), correção de cache corrompido do Turbopack (rm -rf .next + restart), verificação end-to-end com agent-browser: login Lucas → mentoria ativa → coach respondeu COM CONTEXTO (citou Sessão 2, tarefas BANT/pitch) → preparar sessão gerou pauta contextual → matches (Marcos 69% topo) → logout → Carlos aceitou convite → plano gerado → agendou sessão → admin dashboard correto → novo usuário Teste Silva: cadastro → wizard 3 passos → matches (Camila 85%) → proposta enviada → Marcos registrou sessão (2/4) → responsivo mobile (iPhone 14) verificado
- Reset do seed para estado de demo pristine ao final

Stage Summary:
- MVP 100% funcional e verificado no browser contra os 5 critérios de aceite
- IA nunca genérica: contexto injetado (objetivo, plano, sessões, compromissos, tarefas) + fallback template data-driven se IA falhar
- Demo nunca quebra: sem OPENAI_API_KEY usa SDK local + matching léxico; banco local SQLite com SQL Supabase pronto para migração
- Seed: 12 perfis brasileiros realistas + 2 mentorias ativas + 1 convite pendente + notificações

