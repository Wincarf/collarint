"use client";

// Dashboard administrativo: mapa de calor de skills (oferta × demanda) e métricas do programa

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
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar estatísticas."));
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
        title="Dashboard administrativo"
        subtitle="Visão do programa de mentoria da organização"
        action={
          <Badge variant="outline" className="gap-1 border-gold/40 bg-gold-soft text-[#7a5c1f]">
            <Wand2 className="h-3.5 w-3.5" />
            IA: {stats.aiMode === "openai" ? "OpenAI (gpt-4o-mini)" : "modo fallback local"}
          </Badge>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Membros" value={stats.onboardedMembers} hint={`${stats.totalMembers} cadastrados`} />
        <MetricCard icon={<Award className="h-4 w-4" />} label="Mentorias ativas" value={stats.activeMentorships} hint={`${stats.pendingInvites} convites pendentes`} />
        <MetricCard icon={<CalendarCheck className="h-4 w-4" />} label="Sessões realizadas" value={stats.completedSessions} hint="registros concluídos" />
        <MetricCard icon={<Clock className="h-4 w-4" />} label="Horas de mentoria" value={stats.hoursMentored} hint="1 sessão ≈ 1h" />
        <MetricCard icon={<ListTodo className="h-4 w-4" />} label="Tarefas concluídas" value={stats.completedTasks} hint={`de ${stats.totalTasks} criadas`} />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Taxa de conclusão"
          value={stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}
          hint="das tarefas"
          suffix="%"
        />
      </div>

      {/* Mapa de calor de skills */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <SectionTitle
            title="Mapa de calor de skills"
            subtitle="Onde a organização tem oferta (ensina) e demanda (quer aprender)"
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
                        title={`${row.teachCount} ensinam`}
                      />
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-navy transition-all"
                        style={{ width: `${Math.max(row.learnCount * 12, row.learnCount > 0 ? 8 : 0)}%`, backgroundColor: learnColor }}
                        title={`${row.learnCount} querem aprender`}
                      />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    <span className="font-semibold text-navy">{row.teachCount}</span> ensinam ·{" "}
                    <span className="font-semibold text-navy">{row.learnCount}</span> buscam
                  </div>
                  <div
                    className="hidden w-28 shrink-0 sm:block"
                    title={row.balance > 0 ? "Oferta maior que demanda" : "Demanda maior que oferta"}
                  >
                    {row.balance > 0.15 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ec] px-2 py-0.5 text-xs font-medium text-[#1F7A4D]">
                        <TrendingUp className="h-3 w-3" /> abunda
                      </span>
                    ) : row.balance < -0.15 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fdecec] px-2 py-0.5 text-xs font-medium text-[#b4232a]">
                        <TrendingDown className="h-3 w-3" /> rara
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        equilibrada
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gold" /> linha 1: membros que ensinam
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-navy" /> linha 2: membros que querem aprender
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#1F7A4D]/30 bg-[#e7f4ec]/40">
          <CardContent className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#1F7A4D]">
              <Award className="h-4 w-4" /> Skills que abundam
            </h3>
            <p className="mt-1 text-xs text-[#1F7A4D]/80">Muita oferta de mentores — incentive novos mentorados.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.abundantSkills.length > 0 ? (
                stats.abundantSkills.map((s) => (
                  <Badge key={s} className="bg-[#1F7A4D] text-white">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Sem dados suficientes ainda.</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#b4232a]/25 bg-[#fdecec]/40">
          <CardContent className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#b4232a]">
              <AlertTriangle className="h-4 w-4" /> Skills raras (alta demanda)
            </h3>
            <p className="mt-1 text-xs text-[#b4232a]/80">Muitos querem aprender, poucos ensinam — recrute mentores nessas áreas.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.rareSkills.length > 0 ? (
                stats.rareSkills.map((s) => (
                  <Badge key={s} className="bg-[#b4232a] text-white">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Sem dados suficientes ainda.</span>
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
