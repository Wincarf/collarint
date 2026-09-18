"use client";

// Member home: active mentorships, next session, pending tasks and shortcuts

import { useEffect, useState } from "react";
import { api } from "./api-client";
import { useApp } from "./store";
import type { MentorshipDTO, TaskDTO } from "@/lib/types";
import { InitialsAvatar, SectionTitle, StatusBadge, EmptyState } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { enUS } from "date-fns/locale";
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
      {/* Greeting */}
      <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl"
          style={{ background: "#D4A843" }}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Hello, {firstName}!</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {active.length > 0
            ? `You have ${active.length} active mentorship${active.length > 1 ? "s" : ""} — pick up where you left off.`
            : "Your next development step starts here: find a mentor aligned with your goals."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setView({ name: "matches" })} className="gap-2 bg-gold font-semibold text-navy hover:bg-gold/90">
            <Compass className="h-4 w-4" /> Find mentors
          </Button>
          {mentorPending.length > 0 && (
            <Button onClick={() => setView({ name: "mentor" })} variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Users className="h-4 w-4" /> {mentorPending.length} mentorship invite{mentorPending.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active mentorships */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle title="Your mentorships" subtitle="As a mentee" />
            <div className="mt-4 space-y-3">
              {loading && <SkeletonCard />}
              {!loading && active.length === 0 && pending.length === 0 && (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No mentorships yet"
                  description="Use semantic matching to find the 5 mentors most compatible with what you want to learn."
                  action={
                    <Button onClick={() => setView({ name: "matches" })} className="bg-navy hover:bg-navy-light gap-2">
                      <Compass className="h-4 w-4" /> View my matches
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
                        <p className="text-xs text-muted-foreground">Waiting for the mentor to respond to your invite.</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {mentorActive.length + mentorPending.length > 0 && (
            <section>
              <SectionTitle title="You as a mentor" subtitle="Members you guide" />
              <div className="mt-4 space-y-3">
                {mentorActive.map((m) => (
                  <MentorshipRow key={m.id} mentorship={m} onClick={() => setView({ name: "mentorship", id: m.id })} />
                ))}
                {mentorPending.length > 0 && (
                  <Card className="border-gold/40 bg-gold-soft/30">
                    <CardContent className="flex items-center justify-between p-4">
                      <p className="text-sm text-[#7a5c1f]">
                        {mentorPending.length} invite{mentorPending.length > 1 ? "s" : ""} awaiting your response as a mentor.
                      </p>
                      <Button size="sm" onClick={() => setView({ name: "mentor" })} className="gap-1 bg-navy hover:bg-navy-light">
                        Open panel
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Side column: next session + tasks */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <SectionTitle title="Next session" />
              <div className="mt-4">
                {nextSession ? (
                  <div className="rounded-lg bg-gold-soft/50 p-4">
                    <div className="flex items-center gap-2 text-[#7a5c1f]">
                      <CalendarDays className="h-4 w-4" />
                      <p className="text-sm font-semibold">
                        {format(new Date(nextSession.session.scheduledAt!), "MMMM d 'at' HH:mm", { locale: enUS })}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-navy">
                      With <strong>{nextSession.mentorship.mentor.name.split(" ")[0]}</strong> ·{" "}
                      {nextSession.mentorship.plan?.sessions[
                        Math.min(nextSession.mentorship.sessions.filter((s) => s.completed).length, 3)
                      ]?.title ?? "Follow-up session"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full gap-1 border-gold/50 bg-card"
                      onClick={() => setView({ name: "mentorship", id: nextSession.mentorship.id })}
                    >
                      <Route className="h-4 w-4" /> Open mentorship
                    </Button>
                  </div>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">
                    {active.length > 0
                      ? "No sessions scheduled — arrange the next one with your mentor."
                      : "Sessions will appear here once your mentorship starts."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <SectionTitle title="Pending tasks" action={<ListTodo className="h-5 w-5 text-muted-foreground" />} />
              <div className="mt-4 space-y-2">
                {pendingTasks.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {active.length > 0 ? "You're all caught up here. Nice!" : "You don't have active mentorships yet."}
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
                          ? `Due ${formatDistanceToNow(new Date(task.dueDate), { locale: enUS, addSuffix: true })}`
                          : "No due date"}{" "}
                        · with {mentorship.mentor.name.split(" ")[0]}
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
                  <p className="text-sm font-semibold text-[#7a5c1f]">Coach Tip</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#7a5c1f]/90">
                    Mentorships with logged sessions and completed tasks see twice the progress. Use the
                    AI Coach to prepare each session!
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
            {mentorship.mentor.roleTitle} · {completed}/{total} sessions completed
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
