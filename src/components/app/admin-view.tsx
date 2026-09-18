"use client";

// Admin dashboard: skills heatmap (supply × demand) and program metrics

import { useEffect, useState } from "react";
import { api } from "./api-client";
import type { AdminStats } from "@/lib/types";
import { SectionTitle } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Award, CalendarCheck, Clock, ListTodo, TrendingDown, TrendingUp, Users, Wand2 } from "lucide-react";

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load statistics."));
  }, []);

  if (error) {
    return <p className="py-20 text-center text-sm text-muted-foreground">{error}</p>;
  }
  if (!stats) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Admin dashboard"
        subtitle="Overview of the organization's mentorship program"
        action={
          <Badge variant="outline" className="gap-1 border-gold/40 bg-gold-soft text-[#7a5c1f]">
            <Wand2 className="h-3.5 w-3.5" />
            AI: {stats.aiMode === "openai" ? "OpenAI (gpt-4o-mini)" : "local fallback mode"}
          </Badge>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Members" value={stats.onboardedMembers} hint={`${stats.totalMembers} registered`} />
        <MetricCard icon={<Award className="h-4 w-4" />} label="Active mentorships" value={stats.activeMentorships} hint={`${stats.pendingInvites} pending invites`} />
        <MetricCard icon={<CalendarCheck className="h-4 w-4" />} label="Sessions completed" value={stats.completedSessions} hint="completed logs" />
        <MetricCard icon={<Clock className="h-4 w-4" />} label="Mentoring hours" value={stats.hoursMentored} hint="1 session ≈ 1h" />
        <MetricCard icon={<ListTodo className="h-4 w-4" />} label="Tasks completed" value={stats.completedTasks} hint={`of ${stats.totalTasks} created`} />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Completion rate"
          value={stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}
          hint="of tasks"
          suffix="%"
        />
      </div>

      {/* Skills heatmap */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <SectionTitle
            title="Skills heatmap"
            subtitle="Where the organization has supply (teaches) and demand (wants to learn)"
          />
          <div className="mt-5 space-y-2">
            {stats.heatmap.map((row) => {
              const intensity = Math.min(1, Math.max(row.teachCount, row.learnCount) / 6);
              const teachColor = `rgba(212, 168, 67, ${Math.min(0.85, row.teachCount * 0.18 + (row.teachCount > 0 ? 0.12 : 0))})`;
              const learnColor = `rgba(10, 31, 68, ${Math.min(0.85, row.learnCount * 0.18 + (row.learnCount > 0 ? 0.12 : 0))})`;
              return (
                <div key={row.skill} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-sm font-medium text-navy sm:w-52" title={row.skill}>
                    {row.skill}
                  </div>
                  <div className="flex-1">
                    <div className="h-3 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(row.teachCount * 12, row.teachCount > 0 ? 8 : 0)}%`, backgroundColor: teachColor }}
                        title={`${row.teachCount} teaching`}
                      />
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-navy transition-all"
                        style={{ width: `${Math.max(row.learnCount * 12, row.learnCount > 0 ? 8 : 0)}%`, backgroundColor: learnColor }}
                        title={`${row.learnCount} want to learn`}
                      />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    <span className="font-semibold text-navy">{row.teachCount}</span> teach ·{" "}
                    <span className="font-semibold text-navy">{row.learnCount}</span> seek
                  </div>
                  <div
                    className="hidden w-28 shrink-0 sm:block"
                    title={row.balance > 0 ? "Supply exceeds demand" : "Demand exceeds supply"}
                  >
                    {row.balance > 0.15 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ec] px-2 py-0.5 text-xs font-medium text-[#1F7A4D]">
                        <TrendingUp className="h-3 w-3" /> abundant
                      </span>
                    ) : row.balance < -0.15 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fdecec] px-2 py-0.5 text-xs font-medium text-[#b4232a]">
                        <TrendingDown className="h-3 w-3" /> scarce
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        balanced
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gold" /> row 1: members who teach
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-navy" /> row 2: members who want to learn
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#1F7A4D]/30 bg-[#e7f4ec]/40">
          <CardContent className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#1F7A4D]">
              <Award className="h-4 w-4" /> Abundant skills
            </h3>
            <p className="mt-1 text-xs text-[#1F7A4D]/80">Plenty of mentor supply — encourage new mentees.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.abundantSkills.length > 0 ? (
                stats.abundantSkills.map((s) => (
                  <Badge key={s} className="bg-[#1F7A4D] text-white">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Not enough data yet.</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#b4232a]/25 bg-[#fdecec]/40">
          <CardContent className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#b4232a]">
              <AlertTriangle className="h-4 w-4" /> Scarce skills (high demand)
            </h3>
            <p className="mt-1 text-xs text-[#b4232a]/80">Many want to learn, few teach — recruit mentors in these areas.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.rareSkills.length > 0 ? (
                stats.rareSkills.map((s) => (
                  <Badge key={s} className="bg-[#b4232a] text-white">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Not enough data yet.</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  suffix?: string;
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-gold">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-navy">
          {value}
          {suffix}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
