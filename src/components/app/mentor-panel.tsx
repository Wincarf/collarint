"use client";

// Mentor panel: pending invites (accept/decline), active mentorships,
// upcoming sessions and a view of the mentee's session prep.

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";
import type { MentorshipDTO } from "@/lib/types";
import { InitialsAvatar, SectionTitle, StatusBadge, EmptyState } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
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
          title: "Mentorship accepted!",
          description: "4-session plan generated based on the mentee's goal.",
        });
      } else {
        toast({ title: "Request declined", description: "The mentee will be guided to new matches." });
      }
      void res;
      load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
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
      <SectionTitle title="Mentor panel" subtitle="Requests, active mentorships and upcoming commitments" />

      {/* Pending invites */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <HandHeart className="h-4 w-4 text-gold" /> Invites received
          {pending.length > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy">{pending.length}</span>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            No new invites right now. When a member requests your mentorship, it will appear here.
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
                        {m.mentee.city ? ` · ${m.mentee.city}` : ""} · wants to learn{" "}
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
                          Accept mentorship
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
                          Decline
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

      {/* Active mentorships */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4 text-gold" /> Active mentorships
        </h3>
        {active.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="You are not mentoring anyone yet"
            description="Accept an invite above to get started — or wait for new members to discover your profile in matching."
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
                          {m.mentee.roleTitle} · {completed}/{m.plan?.sessions.length ?? 4} sessions · goal:{" "}
                          {m.mentee.mainGoal?.slice(0, 70)}
                          {(m.mentee.mainGoal?.length ?? 0) > 70 ? "..." : ""}
                        </p>
                        {next ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-[#7a5c1f]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Next session: {format(new Date(next.scheduledAt!), "MMM d 'at' HH:mm", { locale: enUS })}
                            {" "}
                            ({formatDistanceToNow(new Date(next.scheduledAt!), { locale: enUS, addSuffix: true })})
                          </p>
                        ) : (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                            No session scheduled
                          </p>
                        )}
                      </div>
                      <Button onClick={() => setView({ name: "mentorship", id: m.id })} className="gap-2 bg-navy hover:bg-navy-light">
                        <Route className="h-4 w-4" /> Open mentorship
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
          {declined.length} request{declined.length > 1 ? "s" : ""} declined recently.
        </p>
      )}
    </div>
  );
}
