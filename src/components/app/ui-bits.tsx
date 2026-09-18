"use client";

// Componentes visuais compartilhados da marca JCI Collarint

import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/skills";
import { Badge } from "@/components/ui/badge";
import { LEVEL_LABELS, type SkillEntry } from "@/lib/types";

export function BrandLogo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <span
        className={cn(
          "flex items-center justify-center rounded-lg text-white font-bold",
          compact ? "h-8 w-8 text-sm" : "h-9 w-9 text-base"
        )}
        style={{ background: "linear-gradient(135deg, #0A1F44 0%, #1F3A68 100%)" }}
        aria-hidden="true"
      >
        <span className="text-gold">J</span>CI
      </span>
      <span className={cn("font-bold tracking-tight", compact ? "text-lg" : "text-xl", dark ? "text-white" : "text-navy")}>
        Collarint
      </span>
    </div>
  );
}

export function InitialsAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-2xl",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm",
        sizes[size],
        className
      )}
      style={{ backgroundColor: color ?? "#0A1F44" }}
      role="img"
      aria-label={`Avatar de ${name}`}
    >
      {initialsOf(name)}
    </span>
  );
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(100, score));
  const color = filled >= 75 ? "#1F7A4D" : filled >= 55 ? "#D4A843" : "#8A94A6";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={6} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={6}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>
        {filled}%
      </span>
    </div>
  );
}

export function SkillChip({
  skill,
  showLevel = true,
  variant = "default",
}: {
  skill: SkillEntry;
  showLevel?: boolean;
  variant?: "default" | "gold" | "outline";
}) {
  const styles =
    variant === "gold"
      ? "bg-gold-soft text-[#7a5c1f] border-gold/40"
      : variant === "outline"
        ? "bg-transparent text-navy border-border"
        : "bg-secondary text-navy border-transparent";
  return (
    <Badge variant="outline" className={cn("font-normal", styles)}>
      {skill.name}
      {showLevel && <span className="ml-1 opacity-70">· {LEVEL_LABELS[skill.level]}</span>}
    </Badge>
  );
}

export function SimpleSkillChip({ name }: { name: string }) {
  return (
    <Badge variant="outline" className="bg-gold-soft text-[#7a5c1f] border-gold/40 font-normal">
      {name}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-[#e7f4ec] text-[#1F7A4D] border-transparent" },
    pending: { label: "Convite pendente", className: "bg-gold-soft text-[#7a5c1f] border-transparent" },
    declined: { label: "Recusada", className: "bg-[#fdecec] text-[#b4232a] border-transparent" },
    completed: { label: "Concluída", className: "bg-secondary text-muted-foreground border-transparent" },
  };
  const info = map[status] ?? { label: status, className: "bg-secondary text-muted-foreground border-transparent" };
  return <Badge className={cn("font-medium", info.className)}>{info.label}</Badge>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-navy">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-[#7a5c1f]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-navy">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
