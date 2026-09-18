"use client";

// 3-step onboarding wizard:
//  1. What you can TEACH (skills + level + free-form field)
//  2. What you want to LEARN (skills + level + free-form field)
//  3. Your main goal + weekly availability

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
    title: "What can you TEACH?",
    subtitle: "Select the skills you have experience in to share with other members.",
    icon: <HandHeart className="h-5 w-5" />,
  },
  {
    title: "What do you want to LEARN?",
    subtitle: "Tell us where you want to go — this powers semantic matching with the right mentors.",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    title: "Your main goal",
    subtitle: "In one sentence, what outcome do you want from the mentorship? And how much time can you dedicate per week?",
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
        title: "Tell us a bit more about your goal",
        description: "Write at least one sentence (10 characters) — the AI uses it to generate your plan.",
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
      toast({ title: "Profile ready!", description: "Your semantic matching is now active." });
    } catch (e) {
      toast({
        title: "Failed to save profile",
        description: e instanceof Error ? e.message : "Try again.",
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
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}% complete</span>
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
                    <Label htmlFor="ob-role">Current role (optional)</Label>
                    <Input
                      id="ob-role"
                      placeholder="e.g. Sales Manager"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-city">City (optional)</Label>
                    <Input id="ob-city" placeholder="e.g. New York, NY" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ob-goal">Your main goal</Label>
                  <Textarea
                    id="ob-goal"
                    rows={4}
                    placeholder="e.g. I want to prepare myself to lead a sales team and close contracts with larger clients."
                    value={mainGoal}
                    onChange={(e) => setMainGoal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This text is used by the AI to generate your mentorship plan and find semantic matches.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Weekly availability</Label>
                  <RadioGroup value={availability} onValueChange={setAvailability} className="grid grid-cols-3 gap-3">
                    {[
                      { value: "1h", label: "1h", hint: "per week" },
                      { value: "2h", label: "2h", hint: "per week" },
                      { value: "4h+", label: "4h+", hint: "per week" },
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
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} className="bg-navy hover:bg-navy-light gap-1">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving} className="bg-navy hover:bg-navy-light gap-2">
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Complete profile
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
        <Label className="mb-2 block">Skills from the catalog</Label>
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
          Another skill? Add your own
        </Label>
        <div className="flex gap-2">
          <Input
            id="custom-skill"
            placeholder="e.g. Advanced public speaking, Product Discovery..."
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
            <Plus className="h-4 w-4" /> Add
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
                title="Click to remove"
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
            Select your level {list.length > 0 && `(${list.length} selected)`}
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
