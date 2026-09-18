"use client";

// Matches page — top 5 mentors by semantic similarity with score and AI-generated reason

import { useEffect, useState } from "react";
import { api } from "./api-client";
import { useApp } from "./store";
import type { MatchResult } from "@/lib/types";
import { InitialsAvatar, ScoreRing, SectionTitle, SkillChip, EmptyState } from "./ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Compass, HandHeart, Loader2, MapPin, Clock3, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function MatchesView() {
  const user = useApp((s) => s.user);
  const setView = useApp((s) => s.setView);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [aiMode, setAiMode] = useState<"openai" | "fallback">("fallback");
  const [proposing, setProposing] = useState<MatchResult | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    api
      .matches()
      .then((d) => {
        setMatches(d.matches);
        setAiMode(d.aiMode);
      })
      .catch(() => setMatches([]));
  }, []);

  async function propose() {
    if (!proposing) return;
    if (message.trim().length < 10) {
      toast({ title: "Write an invite message", description: "Minimum of 10 characters — mentors receive dozens of requests; personalizing helps.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await api.propose(proposing.userId, message.trim());
      setSentTo((s) => new Set(s).add(proposing.userId));
      toast({
        title: "Request sent!",
        description: `${proposing.name.split(" ")[0]} received your invite and will be notified shortly.`,
      });
      setProposing(null);
      setMessage("");
    } catch (e) {
      toast({ title: "Unable to send", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (matches === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-gold" />
        <p className="text-sm text-muted-foreground">Calculating semantic similarities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle
          title="Your top matches"
          subtitle={
            matches.length > 0
              ? "Top 5 mentors by semantic similarity between what you want to learn and what they teach"
              : undefined
          }
          action={
            <Badge variant="outline" className="gap-1 border-gold/40 bg-gold-soft text-[#7a5c1f]">
              <Wand2 className="h-3.5 w-3.5" />
              {aiMode === "openai" ? "OpenAI · text-embedding-3-small" : "Local semantic analysis"}
            </Badge>
          }
        />
        <p className="mt-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          <Sparkles className="mr-1 inline h-4 w-4 text-gold" />
          Based on your goal{" "}
          <em className="text-navy">&ldquo;{user?.mainGoal?.slice(0, 120)}{user?.mainGoal && user.mainGoal.length > 120 ? "..." : ""}&rdquo;</em>
        </p>
      </div>

      {matches.length === 0 && (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No matches yet"
          description="As more members complete onboarding, your semantic matching becomes more accurate. Also update the skills you want to learn in your profile."
          action={
            <Button variant="outline" onClick={() => setView({ name: "home" })} className="gap-2">
              Back to home
            </Button>
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((m, i) => (
          <Card
            key={m.userId}
            className="rise-in border-border shadow-sm transition-all hover:border-gold/40"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <InitialsAvatar name={m.name} color={m.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-navy">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.roleTitle}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {m.city}
                          </span>
                        )}
                        {m.weeklyAvailability && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" /> {m.weeklyAvailability}/week
                          </span>
                        )}
                      </div>
                    </div>
                    <ScoreRing score={m.score} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.teachSkills.map((s) => (
                      <SkillChip key={s.name} skill={s} showLevel={false} variant="gold" />
                    ))}
                  </div>

                  {m.commonSkills.length > 0 && (
                    <p className="mt-3 text-xs font-medium text-[#1F7A4D]">
                      {m.commonSkills.length} skill{m.commonSkills.length > 1 ? "s" : ""} in common with what you want to learn:{" "}
                      {m.commonSkills.join(", ")}
                    </p>
                  )}

                  <div className="mt-3 rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this match</p>
                    <p className="mt-1 text-sm leading-relaxed text-navy">{m.reason}</p>
                  </div>

                  <Button
                    className="mt-4 w-full gap-2 bg-navy hover:bg-navy-light"
                    disabled={sentTo.has(m.userId)}
                    onClick={() => {
                      setProposing(m);
                      setMessage(
                        `Hello! I saw you have expertise in ${m.commonSkills[0] ?? m.teachSkills[0]?.name ?? "the skills I'm looking for"} and my goal is: ${user?.mainGoal?.slice(0, 80) ?? "professional development"}. Would you be open to mentoring me?`
                      );
                    }}
                  >
                    {sentTo.has(m.userId) ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-[#1F7A4D]" /> Request sent
                      </>
                    ) : (
                      <>
                        <HandHeart className="h-4 w-4" /> Request mentorship
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!proposing} onOpenChange={(open) => !open && setProposing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy">
              Request mentorship with {proposing?.name.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="invite-msg">Invite message</Label>
            <Textarea
              id="invite-msg"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain why you chose this mentor and what you hope to gain from the mentorship..."
            />
            <p className="text-xs text-muted-foreground">
              The mentor receives your message as a notification and can accept or decline. Upon acceptance, the
              4-session plan is generated automatically.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={propose} disabled={sending} className="w-full gap-2 bg-navy hover:bg-navy-light">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
