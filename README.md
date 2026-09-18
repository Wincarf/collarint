# JCI Collarint — Plataforma de Mentoria por Skill Matching

MVP da plataforma da **JCI (Junior Chamber International)** que conecta membros experientes (mentores) a quem busca desenvolvimento profissional (mentorados), com **matching semântico por skills** e um **IA Coach** que acompanha o mentorado entre as sessões.

## Destaques do MVP

| Módulo | O que faz |
|---|---|
| Onboarding | Cadastro/login por email + wizard de 3 passos (ensinar / aprender / objetivo + disponibilidade) |
| Matching semântico | Top 5 mentores por similaridade de cosseno entre embeddings, score %, skills em comum e frase explicativa por IA |
| Fluxo de mentoria | Proposta → notificação → aceite/recusa → plano de 4 sessões gerado por IA → agendamento → registro de sessão |
| IA Coach | Chat persistente com contexto total da mentoria, criação de tarefas com prazo e botão "Preparar próxima sessão" (pauta + 5 perguntas, com copiar) |
| Painel do mentor | Convites, mentorias ativas, próximos agendamentos e visualização da preparação do mentorado |
| Dashboard admin | Mapa de calor de skills (abunda/rara) + métricas do programa |

## Stack

- **Next.js 16 (App Router) + TypeScript**
- **Tailwind CSS 4 + shadcn/ui** (identidade: navy `#0A1F44`, dourado `#D4A843`)
- **Prisma + SQLite** (demo local) — schema Postgres/Supabase pronto em `supabase/schema.sql`
- **OpenAI** (`gpt-4o-mini` + `text-embedding-3-small`) **com fallback automático**: sem chave de API, o chat usa o SDK de IA do ambiente e o matching usa análise léxica local — a demo **nunca quebra**

## Setup em 5 passos

```bash
# 1. Instalar dependências
bun install

# 2. Configurar variáveis de ambiente (opcional abrir chaves)
cp .env.example .env
#   → OPENAI_API_KEY (opcional): ativa gpt-4o-mini + text-embedding-3-small
#   → sem chave, o modo fallback é usado automaticamente

# 3. Criar o schema no banco local
bun run db:push

# 4. Popular os dados de demonstração (12 membros + 2 mentorias ativas)
bun scripts/seed.ts

# 5. Rodar
bun run dev
#    → abra http://localhost:3000
```

### Contas de demonstração (senha: `demo1234`)

| Conta | Papel na demo |
|---|---|
| `lucas@demo.jci` | Mentorado com mentoria ativa (Marcos), plano, tarefas e histórico de coach |
| `marcos@demo.jci` | Mentor da mentoria ativa com Lucas |
| `carlos@demo.jci` | Mentor com **convite pendente** de Rafael (teste aceitar/recusar) |
| `patricia@demo.jci` | Mentorado da 2ª mentoria ativa (Marina) |
| `admin@jci.org.br` | Acesso ao dashboard administrativo |

A tela de login tem botões de **acesso rápido** para todas elas.

## Fluxo completo de demonstração (critério de aceite)

1. **Login** com `lucas@demo.jci` (acesso rápido)
2. **Onboarding** (novo usuário): wizard de 3 passos gera embeddings do perfil
3. **Matches**: `/Matches` mostra top 5 com score % e explicação por IA
4. **Propor mentoria**: botão no card → mensagem de convite
5. **Aceite**: entre com `carlos@demo.jci` → sino de notificação → Painel do mentor → **Aceitar** (o plano de 4 sessões é gerado automaticamente)
6. **IA Coach**: volte para o mentorado → chat com contexto real (objetivo, plano, sessões, tarefas) → o Coach cria tarefas com prazo
7. **Preparar próxima sessão**: gera pauta + 5 perguntas → botão de copiar → o mentor enxerga a preparação no painel dele
8. **Sessão**: mentor agenda, registra "o que foi discutido" + "compromissos" e conclui
9. **Admin**: login com `admin@jci.org.br` → heatmap de skills + métricas

## Migração para Supabase (produção)

O schema completo (tabelas, triggers, **RLS** e dica de `pgvector`) está em [`supabase/schema.sql`](supabase/schema.sql). Resumo:

1. Crie o projeto em [supabase.com](https://supabase.com)
2. SQL Editor → cole `supabase/schema.sql` → Run
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env`
4. Ative o Auth por email em Authentication → Providers
5. Sincronize os perfis (cadastro pela UI ou seed)

A camada de dados é isolada em `src/lib/db.ts` (Prisma) e os serializadores em `src/lib/serialize.ts`, então a troca de store não toca nas telas.

## Estrutura do projeto

```
src/
├─ app/
│  ├─ page.tsx                 # SPA principal (rota única)
│  └─ api/                     # Backend: auth, profile, matches,
│     │                        # mentorships (respond/sessions/coach/
│     │                        # prepare/tasks), notifications, admin/stats
├─ components/app/             # UI: shell, login, wizard, dashboard,
│                              # matches, mentoria+coach, painel mentor, admin
└─ lib/
   ├─ ai.ts                    # IA dual-mode (OpenAI ⇄ fallback)
   ├─ matching.ts              # cosseno + overlap ponderado de skills
   ├─ plan.ts                  # plano de 4 sessões (IA ⇄ template)
   ├─ coach-context.ts         # contexto do Coach (nunca genérico)
   ├─ auth.ts                  # scrypt + cookie httpOnly assinado
   └─ db.ts                    # Prisma client
prisma/schema.prisma           # modelo de dados (SQLite demo)
supabase/schema.sql            # schema Postgres + RLS para produção
scripts/seed.ts                # dados de demonstração
```

## Modelo de dados

`profiles` (skills + embeddings) · `mentorships` (status + plano) · `sessions` (notas + compromissos) · `tasks` (prazo + origem) · `coach_messages` · `session_preps` · `notifications`

## Notas técnicas

- **Matching**: score = `0.55 × overlap_ponderado_de_skills + 0.45 × cosseno_semântico`, exibido em percentual. Com OpenAI, os embeddings são de `text-embedding-3-small`; sem chave, um embedding léxico determinístico (stemming PT-BR + sinônimos) roda localmente.
- **Coach sem resposta genérica**: cada mensagem injeta objetivo, plano, histórico de sessões, compromissos, tarefas pendentes e últimas conversas no prompt do modelo, e exige que a resposta termine com uma ação concreta.
- **Segurança**: senhas com scrypt+salt; sessão em cookie httpOnly assinado com HMAC-SHA256 (`AUTH_SECRET`); autorização por participação nas rotas de API.
- **Responsivo**: mobile-first, navegação inferior compacta no mobile, rodapé sticky.
