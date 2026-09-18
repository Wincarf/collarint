"use client";

// Home do membro: mentorias ativas, próxima sessão, tarefas pendentes e atalhos

import { useEffect, useState } from "react";
import { api } from "./api-client";
import { useApp } from "./store";
import type { MentorshipDTO, TaskDTO } from "@/lib/types";
import { InitialsAvatar, SectionTitle, StatusBadge, EmptyState } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Compass, ListTodo, Route, Sparkles, Users } from "lucide-react";

export function MenteeHome() {
  const user = useApp((s) => s.user);
  const setView = useApp((s) => s.setView);
  const [asMentee, setAsMentee] = useState<MentorshipDTO[] | null>(null);
  const [asMentor, setAsMentor] = useState<MentorshipDTO[] | null>(null);

  useEffect(() => {
    api
      .mentorships()
      .then((d) => {
        setAsMentee(d.asMentee);
        setAsMentor(d.asMentor);
      })
      .catch(() => {
        setAsMentee([]);
        setAsMentor([]);
      });
  }, []);

  const active = asMentee?.filter((m) => m.status === "active") ?? [];
  const pending = asMentee?.filter((m) => m.status === "pending") ?? [];
  const mentorActive = asMentor?.filter((m) => m.status === "active") ?? [];
  const mentorPending = asMentor?.filter((m) => m.status === "pending") ?? [];

  const allTasks: Array<{ task: TaskDTO; mentorship: MentorshipDTO }> = active.flatMap((m) =>
    m.tasks.map((task) => ({ task, mentorship: m }))
  );
  const pendingTasks = allTasks.filter(({ task }) => !task.completed);

  const nextSession = active
    .flatMap((m) => m.sessions.filter((s) => !s.completed && s.scheduledAt).map((s) => ({ session: s, mentorship: m })))
    .sort((a, b) => (a.session.scheduledAt! < b.session.scheduledAt! ? -1 : 1))[0];

  const firstName = user?.name.split(" ")[0] ?? "";

  const loading = asMentee === null;

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl"
          style={{ background: "#D4A843" }}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Olá, {firstName}!</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {active.length > 0
            ? `Você tem ${active.length} mentoria${active.length > 1 ? "s" : ""} ativa${active.length > 1 ? "s" : ""} — continue de onde parou.`
            : "Seu próximo passo de desenvolvimento começa aqui: encontre um mentor compatível com seus objetivos."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setView({ name: "matches" })} className="gap-2 bg-gold font-semibold text-navy hover:bg-gold/90">
            <Compass className="h-4 w-4" /> Encontrar mentores
          </Button>
          {mentorPending.length > 0 && (
            <Button onClick={() => setView({ name: "mentor" })} variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Users className="h-4 w-4" /> {mentorPending.length} convite{mentorPending.length > 1 ? "s" : ""} de mentoria
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mentorias ativas */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle title="Suas mentorias" subtitle="Como mentorado" />
            <div className="mt-4 space-y-3">
              {loading && <SkeletonCard />}
              {!loading && active.length === 0 && pending.length === 0 && (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="Nenhuma mentoria ainda"
                  description="Use o matching semântico para encontrar os 5 mentores mais compatíveis com o que você quer aprender."
                  action={
                    <Button onClick={() => setView({ name: "matches" })} className="bg-navy hover:bg-navy-light gap-2">
                      <Compass className="h-4 w-4" /> Ver meus matches
                    </Button>
                  }
                />
              )}
              {!loading &&
                active.map((m) => <MentorshipRow key={m.id} mentorship={m} onClick={() => setView({ name: "mentorship", id: m.id })} />)}
              {!loading &&
                pending.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={m.mentor.name} color={m.mentor.avatarColor} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy">{m.mentor.name}</p>
                        <p className="text-xs text-muted-foreground">Aguardando resposta do mentor ao seu convite.</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {mentorActive.length + mentorPending.length > 0 && (
            <section>
              <SectionTitle title="Você como mentor" subtitle="Membros que você orienta" />
              <div className="mt-4 space-y-3">
                {mentorActive.map((m) => (
                  <MentorshipRow key={m.id} mentorship={m} onClick={() => setView({ name: "mentorship", id: m.id })} />
                ))}
                {mentorPending.length > 0 && (
                  <Card className="border-gold/40 bg-gold-soft/30">
                    <CardContent className="flex items-center justify-between p-4">
                      <p className="text-sm text-[#7a5c1f]">
                        {mentorPending.length} convite{mentorPending.length > 1 ? "s" : ""} aguardando sua resposta como mentor.
                      </p>
                      <Button size="sm" onClick={() => setView({ name: "mentor" })} className="gap-1 bg-navy hover:bg-navy-light">
                        Abrir painel
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Coluna lateral: próxima sessão + tarefas */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <SectionTitle title="Próxima sessão" />
              <div className="mt-4">
                {nextSession ? (
                  <div className="rounded-lg bg-gold-soft/50 p-4">
                    <div className="flex items-center gap-2 text-[#7a5c1f]">
                      <CalendarDays className="h-4 w-4" />
                      <p className="text-sm font-semibold">
                        {format(new Date(nextSession.session.scheduledAt!), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-navy">
                      Com <strong>{nextSession.mentorship.mentor.name.split(" ")[0]}</strong> ·{" "}
                      {nextSession.mentorship.plan?.sessions[
                        Math.min(nextSession.mentorship.sessions.filter((s) => s.completed).length, 3)
                      ]?.title ?? "Sessão de acompanhamento"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full gap-1 border-gold/50 bg-card"
                      onClick={() => setView({ name: "mentorship", id: nextSession.mentorship.id })}
                    >
                      <Route className="h-4 w-4" /> Abrir mentoria
                    </Button>
                  </div>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">
                    {active.length > 0
                      ? "Nenhuma sessão agendada — combine a próxima com seu mentor."
                      : "Elas aparecem aqui quando sua mentoria começar."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <SectionTitle title="Tarefas pendentes" action={<ListTodo className="h-5 w-5 text-muted-foreground" />} />
              <div className="mt-4 space-y-2">
                {pendingTasks.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {active.length > 0 ? "Tudo em dia por aqui. Boa!" : "Você ainda não tem mentorias ativas."}
                  </p>
                ) : (
                  pendingTasks.slice(0, 5).map(({ task, mentorship }) => (
                    <button
                      key={task.id}
                      onClick={() => setView({ name: "mentorship", id: mentorship.id })}
                      className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-gold/40"
                    >
                      <p className="text-sm font-medium text-navy">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.dueDate
                          ? `Prazo ${formatDistanceToNow(new Date(task.dueDate), { locale: ptBR, addSuffix: true })}`
                          : "Sem prazo"}{" "}
                        · com {mentorship.mentor.name.split(" ")[0]}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/40 bg-gold-soft/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#7a5c1f]" />
                <div>
                  <p className="text-sm font-semibold text-[#7a5c1f]">Dica do Coach</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#7a5c1f]/90">
                    Mentorias com registro de sessão e tarefas concluídas têm o dobro de progresso. Use o
                    IA Coach para preparar cada sessão!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MentorshipRow({ mentorship, onClick }: { mentorship: MentorshipDTO; onClick: () => void }) {
  const completed = mentorship.sessions.filter((s) => s.completed).length;
  const total = mentorship.plan?.sessions.length ?? 4;
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-gold/50 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <InitialsAvatar name={mentorship.mentor.name} color={mentorship.mentor.avatarColor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-navy">{mentorship.mentor.name}</p>
            <StatusBadge status={mentorship.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {mentorship.mentor.roleTitle} · {completed}/{total} sessões realizadas
          </p>
        </div>
        <Route className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="h-[76px] animate-pulse rounded-xl border border-border bg-card" />
  );
}
