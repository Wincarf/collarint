"use client";

// Wizard de onboarding em 3 passos:
//  1. O que você pode ENSINAR? (skills + nível + campo livre)
//  2. O que você quer APRENDER? (skills + nível + campo livre)
//  3. Seu objetivo principal + disponibilidade semanal

import { useState } from "react";
import { useApp } from "./store";
import { api } from "./api-client";
import { BrandLogo, InitialsAvatar, SkillChip } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, GraduationCap, HandHeart, Target, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { PRESET_SKILLS, AVATAR_COLORS } from "@/lib/skills";
import type { SkillEntry, SkillLevel } from "@/lib/types";
import { LEVEL_LABELS } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "O que você pode ENSINAR?",
    subtitle: "Selecione as habilidades em que você tem experiência para compartilhar com outros membros.",
    icon: <HandHeart className="h-5 w-5" />,
  },
  {
    title: "O que você quer APRENDER?",
    subtitle: "Diga onde quer chegar — isso alimenta o matching semântico com os mentores certos.",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    title: "Seu objetivo principal",
    subtitle: "Em uma frase, qual resultado você quer da mentoria? E quanto tempo pode dedicar por semana?",
    icon: <Target className="h-5 w-5" />,
  },
];

export function OnboardingWizard() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [teach, setTeach] = useState<SkillEntry[]>([]);
  const [learn, setLearn] = useState<SkillEntry[]>([]);
  const [mainGoal, setMainGoal] = useState("");
  const [availability, setAvailability] = useState<string>("2h");
  const [roleTitle, setRoleTitle] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  const customNames = (list: SkillEntry[]) =>
    list.filter((s) => !(PRESET_SKILLS as readonly string[]).includes(s.name)).map((s) => s.name);

  function toggleSkill(list: SkillEntry[], setList: (v: SkillEntry[]) => void, name: string) {
    if (list.some((s) => s.name === name)) {
      setList(list.filter((s) => s.name !== name));
    } else {
      setList([...list, { name, level: "intermediario" }]);
    }
  }

  function setLevel(list: SkillEntry[], setList: (v: SkillEntry[]) => void, name: string, level: SkillLevel) {
    setList(list.map((s) => (s.name === name ? { ...s, level } : s)));
  }

  async function handleFinish() {
    if (mainGoal.trim().length < 10) {
      toast({
        title: "Conte um pouco mais sobre seu objetivo",
        description: "Escreva pelo menos uma frase (10 caracteres) — a IA usa isso para gerar seu plano.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const result = await api.saveProfile({
        teachSkills: teach,
        learnSkills: learn,
        mainGoal: mainGoal.trim(),
        weeklyAvailability: availability,
      });
      setUser({ ...result.user, roleTitle: roleTitle || result.user.roleTitle, city: city || result.user.city });
      toast({ title: "Perfil pronto!", description: "Seu matching semântico já está ativo." });
    } catch (e) {
      toast({
        title: "Erro ao salvar perfil",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
      setSaving(false);
    }
  }

  const current = STEPS[step];
  const avatarColor = AVATAR_COLORS[(user?.email.length ?? 3) % AVATAR_COLORS.length];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="brand-gradient px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <BrandLogo dark compact />
          <div className="flex items-center gap-3 text-white">
            <InitialsAvatar name={user?.name ?? "J"} color={avatarColor} size="sm" />
            <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Passo {step + 1} de {STEPS.length}
            </span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}% concluído</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-1 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-soft text-[#7a5c1f]">
                {current.icon}
              </span>
              <div>
                <h1 className="text-lg font-bold text-navy sm:text-xl">{current.title}</h1>
              </div>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">{current.subtitle}</p>

            {step === 0 && (
              <SkillsStep
                list={teach}
                custom={customNames(teach)}
                onToggle={(name) => toggleSkill(teach, setTeach, name)}
                onSetLevel={(name, level) => setLevel(teach, setTeach, name, level)}
                onAddCustom={(name) => setTeach([...teach, { name, level: "intermediario" }])}
                onRemoveCustom={(name) => setTeach(teach.filter((s) => s.name !== name))}
              />
            )}

            {step === 1 && (
              <SkillsStep
                list={learn}
                custom={customNames(learn)}
                onToggle={(name) => toggleSkill(learn, setLearn, name)}
                onSetLevel={(name, level) => setLevel(learn, setLearn, name, level)}
                onAddCustom={(name) => setLearn([...learn, { name, level: "iniciante" }])}
                onRemoveCustom={(name) => setLearn(learn.filter((s) => s.name !== name))}
              />
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ob-role">Cargo atual (opcional)</Label>
                    <Input
                      id="ob-role"
                      placeholder="Ex.: Gerente Comercial"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-city">Cidade (opcional)</Label>
                    <Input id="ob-city" placeholder="Ex.: São Paulo, SP" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ob-goal">Seu objetivo principal</Label>
                  <Textarea
                    id="ob-goal"
                    rows={4}
                    placeholder="Ex.: Quero me preparar para liderar um time comercial e fechar contratos com clientes maiores."
                    value={mainGoal}
                    onChange={(e) => setMainGoal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto é usado pela IA para gerar seu plano de mentoria e encontrar matches semânticos.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Disponibilidade semanal</Label>
                  <RadioGroup value={availability} onValueChange={setAvailability} className="grid grid-cols-3 gap-3">
                    {[
                      { value: "1h", label: "1h", hint: "por semana" },
                      { value: "2h", label: "2h", hint: "por semana" },
                      { value: "4h+", label: "4h+", hint: "por semana" },
                    ].map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={`avail-${opt.value}`}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border p-4 text-center transition-colors",
                          availability === opt.value
                            ? "border-gold bg-gold-soft text-[#7a5c1f]"
                            : "border-border bg-card hover:bg-secondary"
                        )}
                      >
                        <RadioGroupItem id={`avail-${opt.value}`} value={opt.value} className="sr-only" />
                        <span className="text-lg font-bold">{opt.label}</span>
                        <span className="text-xs opacity-70">{opt.hint}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} className="bg-navy hover:bg-navy-light gap-1">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving} className="bg-navy hover:bg-navy-light gap-2">
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Concluir perfil
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SkillsStep({
  list,
  custom,
  onToggle,
  onSetLevel,
  onAddCustom,
  onRemoveCustom,
}: {
  list: SkillEntry[];
  custom: string[];
  onToggle: (name: string) => void;
  onSetLevel: (name: string, level: SkillLevel) => void;
  onAddCustom: (name: string) => void;
  onRemoveCustom: (name: string) => void;
}) {
  const [customInput, setCustomInput] = useState("");

  function addCustom() {
    const name = customInput.trim();
    if (name.length >= 2) {
      onAddCustom(name.slice(0, 60));
      setCustomInput("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-2 block">Habilidades do catálogo</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_SKILLS.map((name) => {
            const selected = list.some((s) => s.name === name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => onToggle(name)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                  selected
                    ? "border-navy bg-navy text-white shadow-sm"
                    : "border-border bg-card text-navy hover:border-gold hover:bg-gold-soft"
                )}
              >
                {selected && <Check className="mr-1 inline h-3.5 w-3.5 text-gold" />}
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-skill" className="mb-2 block">
          Outra habilidade? Adicione livremente
        </Label>
        <div className="flex gap-2">
          <Input
            id="custom-skill"
            placeholder="Ex.: Oratória avançada, Product Discovery..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustom} className="shrink-0 gap-1">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {custom.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {custom.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onRemoveCustom(name)}
                className="group rounded-full border border-gold/50 bg-gold-soft px-3 py-1 text-xs text-[#7a5c1f]"
                title="Clique para remover"
              >
                {name} <span className="ml-1 opacity-60 group-hover:opacity-100">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="mb-3 text-sm font-medium text-navy">
            Selecione seu nível {list.length > 0 && `(${list.length} selecionada${list.length > 1 ? "s" : ""})`}
          </p>
          <div className="space-y-3">
            {list.map((skill) => (
              <div key={skill.name} className="flex flex-wrap items-center gap-2">
                <SkillChip skill={skill} showLevel={false} />
                <div className="flex gap-1">
                  {(["iniciante", "intermediario", "avancado"] as SkillLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onSetLevel(skill.name, level)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs transition-colors",
                        skill.level === level
                          ? "bg-gold font-semibold text-navy"
                          : "bg-card text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
