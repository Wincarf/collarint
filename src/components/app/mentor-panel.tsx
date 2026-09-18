"use client";

// Painel do mentor: convites pendentes (aceitar/recusar), mentorias ativas,
// próximos agendamentos e visualização da preparação do mentorado.

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";
import type { MentorshipDTO } from "@/lib/types";
import { InitialsAvatar, SectionTitle, StatusBadge, EmptyState } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, HandHeart, Loader2, Route, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "./store";

export function MentorPanel() {
  const setView = useApp((s) => s.setView);
  const [data, setData] = useState<{ asMentor: MentorshipDTO[] } | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    api
      .mentorships()
      .then((d) => setData({ asMentor: d.asMentor }))
      .catch(() => setData({ asMentor: [] }));
  }, []);

  useEffect(load, [load]);

  async function respond(mentorship: MentorshipDTO, action: "accept" | "decline") {
    setResponding(mentorship.id + action);
    try {
      const res = await api.respond(mentorship.id, action);
      if (action === "accept") {
        toast({
          title: "Mentoria aceita!",
          description: "Plano de 4 sessões gerado com base no objetivo do mentorado.",
        });
      } else {
        toast({ title: "Proposta recusada", description: "O mentorado será direcionado a novos matches." });
      }
      void res;
      load();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setResponding(null);
    }
  }

  if (data === null) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-gold" />
      </div>
    );
  }

  const pending = data.asMentor.filter((m) => m.status === "pending");
  const active = data.asMentor.filter((m) => m.status === "active");
  const declined = data.asMentor.filter((m) => m.status === "declined");

  return (
    <div className="space-y-6">
      <SectionTitle title="Painel do mentor" subtitle="Solicitações, mentorias ativas e próximos compromissos" />

      {/* Convites pendentes */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <HandHeart className="h-4 w-4 text-gold" /> Convites recebidos
          {pending.length > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy">{pending.length}</span>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            Nenhum convite novo no momento. Quando um membro te propor mentoria, ele aparece aqui.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((m) => (
              <Card key={m.id} className="rise-in border-gold/40 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <InitialsAvatar name={m.mentee.name} color={m.mentee.avatarColor} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-navy">{m.mentee.name}</p>
                        <StatusBadge status={m.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.mentee.roleTitle}
                        {m.mentee.city ? ` · ${m.mentee.city}` : ""} · quer aprender{" "}
                        {m.mentee.learnSkills.map((s) => s.name).slice(0, 3).join(", ")}
                      </p>
                      <div className="mt-3 rounded-lg bg-gold-soft/50 p-3">
                        <p className="text-sm italic text-[#7a5c1f]">&ldquo;{m.inviteMessage}&rdquo;</p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          className="gap-2 bg-navy hover:bg-navy-light"
                          onClick={() => respond(m, "accept")}
                          disabled={responding !== null}
                        >
                          {responding === m.id + "accept" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Aceitar mentoria
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-border"
                          onClick={() => respond(m, "decline")}
                          disabled={responding !== null}
                        >
                          {responding === m.id + "decline" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Recusar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Mentorias ativas */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4 text-gold" /> Mentorias ativas
        </h3>
        {active.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Você ainda não orienta ninguém"
            description="Aceite um convite acima para começar — ou aguarde novos membros descobrirem seu perfil no matching."
          />
        ) : (
          <div className="space-y-3">
            {active.map((m) => {
              const next = m.sessions
                .filter((s) => !s.completed && s.scheduledAt)
                .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1))[0];
              const completed = m.sessions.filter((s) => s.completed).length;
              return (
                <Card key={m.id} className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-4">
                      <InitialsAvatar name={m.mentee.name} color={m.mentee.avatarColor} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-navy">{m.mentee.name}</p>
                          <StatusBadge status={m.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.mentee.roleTitle} · {completed}/{m.plan?.sessions.length ?? 4} sessões · objetivo:{" "}
                          {m.mentee.mainGoal?.slice(0, 70)}
                          {(m.mentee.mainGoal?.length ?? 0) > 70 ? "..." : ""}
                        </p>
                        {next ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-[#7a5c1f]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Próxima sessão: {format(new Date(next.scheduledAt!), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                            {" "}
                            ({formatDistanceToNow(new Date(next.scheduledAt!), { locale: ptBR, addSuffix: true })})
                          </p>
                        ) : (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                            Sem sessão agendada
                          </p>
                        )}
                      </div>
                      <Button onClick={() => setView({ name: "mentorship", id: m.id })} className="gap-2 bg-navy hover:bg-navy-light">
                        <Route className="h-4 w-4" /> Abrir mentoria
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {declined.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {declined.length} proposta{declined.length > 1 ? "s" : ""} recusada{declined.length > 1 ? "s" : ""} recentemente.
        </p>
      )}
    </div>
  );
}
