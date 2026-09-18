"use client";

// Detailed mentorship view — used by the mentee (with the AI Coach) and by the mentor
// (scheduling, session logging, and viewing the mentee's preparation).

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import type { MentorshipDTO, SessionDTO, TaskDTO } from "@/lib/types";
import { InitialsAvatar, SkillChip, StatusBadge, SectionTitle } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  Plus,
  Route,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useApp } from "./store";

interface CoachMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function MentorshipView({ id, onBack }: { id: string; onBack: () => void }) {
  const [mentorship, setMentorship] = useState<MentorshipDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [prepDialog, setPrepDialog] = useState<{ content: string } | null>(null);

  const { toast } = useToast();
  const me = useApp((s) => s.user);
  // The role (mentor/mentee) is derived from the mentorship data after loading
  const role: "mentee" | "mentor" =
    mentorship && me && mentorship.mentor.id === me.id ? "mentor" : "mentee";

  const load = useCallback(async () => {
    try {
      const data = await api.mentorship(id);
      setMentorship(data.mentorship);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mentorship.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-gold" />
      </div>
    );
  }

  if (error || !mentorship) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {error ?? "Mentorship not found."}
        <div className="mt-4">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const other = role === "mentee" ? mentorship.mentor : mentorship.mentee;
  const isInvitePending = mentorship.status === "pending";

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Pair header */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <InitialsAvatar name={other.name} color={other.avatarColor} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-navy">{other.name}</h1>
                <StatusBadge status={mentorship.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {other.roleTitle}
                {other.city ? ` · ${other.city}` : ""}
                {role === "mentee" ? " · Your mentor" : " · Your mentee"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {other.teachSkills.slice(0, 4).map((s) => (
                  <SkillChip key={s.name} skill={s} showLevel={false} variant="gold" />
                ))}
              </div>
            </div>
            {role === "mentor" && mentorship.status === "active" && (
              <div className="flex gap-2">
                <Button onClick={() => setScheduleOpen(true)} className="bg-navy hover:bg-navy-light gap-2">
                  <CalendarPlus className="h-4 w-4" /> Schedule session
                </Button>
              </div>
            )}
          </div>
          {isInvitePending && (
            <div className="mt-4 rounded-lg bg-gold-soft/60 p-4">
              <p className="text-sm font-medium text-[#7a5c1f]">Invite message:</p>
              <p className="mt-1 text-sm text-[#7a5c1f]/90">&ldquo;{mentorship.inviteMessage}&rdquo;</p>
            </div>
          )}
        </CardContent>
      </Card>

      {mentorship.status === "active" && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column: plan + sessions */}
          <div className="space-y-6 lg:col-span-3">
            <PlanTrail plan={mentorship.plan} sessions={mentorship.sessions} />
            <SessionsSection mentorship={mentorship} role={role} onChanged={load} />
            {role === "mentor" && <MenteePrepSection mentorshipId={mentorship.id} onOpen={setPrepDialog} />}
          </div>

          {/* Right column: coach (mentee) or tasks (both) */}
          <div className="space-y-6 lg:col-span-2">
            {role === "mentee" ? (
              <CoachChat
                mentorshipId={mentorship.id}
                mentorName={mentorship.mentor.name.split(" ")[0]}
                planReady={!!mentorship.plan}
                onTaskCreated={load}
              />
            ) : (
              <TasksCard mentorshipId={mentorship.id} tasks={mentorship.tasks} editable={false} onChanged={load} />
            )}
            {role === "mentee" && (
              <TasksCard mentorshipId={mentorship.id} tasks={mentorship.tasks} editable onChanged={load} />
            )}
          </div>
        </div>
      )}

      {mentorship.status === "declined" && (
        <Card className="border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This mentorship request was not accepted. Explore other matches on the platform — new
            mentors are always joining.
          </CardContent>
        </Card>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        mentorshipId={mentorship.id}
        onDone={load}
      />

      <Dialog open={!!prepDialog} onOpenChange={(open) => !open && setPrepDialog(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto scroll-slim sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy">Mentee&apos;s preparation for the next session</DialogTitle>
          </DialogHeader>
          <div className="prose-sm text-sm">
            <MarkdownContent content={prepDialog?.content ?? ""} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Mentorship plan (visual trail) ---------------- */

function PlanTrail({ plan, sessions }: { plan: MentorshipDTO["plan"]; sessions: SessionDTO[] }) {
  if (!plan) return null;
  const completed = sessions.filter((s) => s.completed).length;

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <SectionTitle
          title="Mentorship plan"
          subtitle={
            plan.generatedBy === "ai"
              ? "AI-generated plan tailored to your goal"
              : "Structured 4-session plan"
          }
          action={
            <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-[#7a5c1f]">
              {completed}/{plan.sessions.length} sessions
            </span>
          }
        />
        <ol className="mt-5 space-y-0">
          {plan.sessions.map((s, i) => {
            const done = i < completed;
            const current = i === completed;
            return (
              <li key={s.number} className="relative flex gap-4 pb-6 last:pb-0">
                {i < plan.sessions.length - 1 && (
                  <span
                    className={cn("absolute left-[15px] top-8 h-full w-0.5", done ? "bg-gold" : "bg-border")}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    done
                      ? "border-gold bg-gold text-navy"
                      : current
                        ? "border-gold bg-card text-[#7a5c1f]"
                        : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : s.number}
                </span>
                <div className="min-w-0 pt-1">
                  <p className={cn("font-semibold", done || current ? "text-navy" : "text-muted-foreground")}>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.objective}</p>
                  {s.topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.topics.map((t) => (
                        <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---------------- Sessions ---------------- */

function SessionsSection({
  mentorship,
  role,
  onChanged,
}: {
  mentorship: MentorshipDTO;
  role: "mentee" | "mentor";
  onChanged: () => void;
}) {
  const [recording, setRecording] = useState<SessionDTO | null>(null);
  const [notes, setNotes] = useState("");
  const [commitments, setCommitments] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const upcoming = mentorship.sessions.filter((s) => !s.completed);
  const past = mentorship.sessions.filter((s) => s.completed);

  async function saveRecord(complete: boolean) {
    if (!recording) return;
    if (complete && notes.trim().length === 0) {
      toast({ title: "Describe what was discussed", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.recordSession(mentorship.id, recording.id, notes.trim(), commitments.trim(), complete);
      toast({ title: complete ? "Session logged!" : "Draft saved." });
      setRecording(null);
      setNotes("");
      setCommitments("");
      onChanged();
    } catch (e) {
      toast({ title: "Error logging session", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <SectionTitle title="Sessions" subtitle="Scheduling, session notes, and commitments" />
        <div className="mt-4 space-y-3">
          {upcoming.length === 0 && past.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No sessions yet.
              {role === "mentor" ? " Schedule the first session." : " Your mentor will schedule the first session."}
            </p>
          )}

          {upcoming.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold-soft/40 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-navy">
                  <CalendarPlus className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {s.scheduledAt
                      ? format(new Date(s.scheduledAt), "EEEE, MMMM d 'at' HH:mm", { locale: enUS })
                      : "Date to be set"}
                  </p>
                  <p className="text-xs text-muted-foreground">Next session scheduled</p>
                </div>
              </div>
              {role === "mentor" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRecording(s);
                    setNotes("");
                    setCommitments("");
                  }}
                  className="gap-1 border-gold/50"
                >
                  <ClipboardList className="h-4 w-4" /> Log session
                </Button>
              )}
            </div>
          ))}

          {[...past].reverse().map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">
                  {s.scheduledAt
                    ? format(new Date(s.scheduledAt), "MMMM d, yyyy 'at' HH:mm", { locale: enUS })
                    : "Session"}
                </p>
                {role === "mentor" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={() => {
                      setRecording(s);
                      setNotes(s.notes ?? "");
                      setCommitments(s.commitments ?? "");
                    }}
                  >
                    Edit notes
                  </Button>
                )}
              </div>
              {s.notes && (
                <div className="mt-2 text-sm">
                  <span className="font-medium text-navy">What was discussed: </span>
                  <span className="text-muted-foreground">{s.notes}</span>
                </div>
              )}
              {s.commitments && (
                <div className="mt-1.5 text-sm">
                  <span className="font-medium text-navy">Commitments made: </span>
                  <span className="text-muted-foreground">{s.commitments}</span>
                </div>
              )}
              {!s.notes && !s.commitments && <p className="mt-1 text-xs text-muted-foreground">No detailed notes.</p>}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!recording} onOpenChange={(open) => !open && setRecording(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy">Session notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sess-notes">What was discussed</Label>
              <Textarea
                id="sess-notes"
                rows={4}
                placeholder="e.g. We mapped the sales funnel and identified the decision-maker diagnosis as the weak spot..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sess-commit">Commitments made</Label>
              <Textarea
                id="sess-commit"
                rows={3}
                placeholder="e.g. Mentee will map the 3 decision-makers; mentor will send the research template."
                value={commitments}
                onChange={(e) => setCommitments(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => saveRecord(false)} disabled={saving}>
              Save draft
            </Button>
            <Button
              onClick={() => saveRecord(true)}
              disabled={saving}
              className="bg-navy hover:bg-navy-light gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Complete session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Tasks ---------------- */

function TasksCard({
  mentorshipId,
  tasks,
  editable,
  onChanged,
}: {
  mentorshipId: string;
  tasks: TaskDTO[];
  editable: boolean;
  onChanged: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  async function toggle(task: TaskDTO) {
    try {
      await api.toggleTask(task.id, !task.completed);
      onChanged();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  }

  async function add() {
    if (newTitle.trim().length < 3) return;
    setAdding(true);
    try {
      await api.createTask(mentorshipId, newTitle.trim());
      setNewTitle("");
      onChanged();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5">
        <SectionTitle title="Tasks" subtitle={editable ? "Created by you and the Coach" : "Mentee's task tracking"} />
        <div className="mt-4 space-y-2">
          {tasks.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tasks yet. {editable ? "The Coach creates tasks in the chat — or add the first one." : ""}
            </p>
          )}
          {pending.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggle} />
          ))}
          {done.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggle} />
          ))}
        </div>
        {editable && (
          <div className="mt-4 flex gap-2">
            <Input
              placeholder="New task..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button size="icon" variant="outline" onClick={add} disabled={adding} aria-label="Add task">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, onToggle }: { task: TaskDTO; onToggle: (task: TaskDTO) => void }) {
  const overdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        task.completed ? "border-transparent bg-secondary/60" : "border-border bg-card hover:border-gold/40"
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        className="mt-0.5"
        aria-label={task.title}
      />
      <div className="min-w-0">
        <p className={cn("text-sm", task.completed ? "text-muted-foreground line-through" : "text-navy font-medium")}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className={cn("mt-0.5 text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            Due: {format(new Date(task.dueDate), "MMM d", { locale: enUS })}
            {task.source === "coach" && !task.completed ? " · created by the Coach" : ""}
          </p>
        )}
      </div>
    </label>
  );
}

/* ---------------- AI Coach (chat + session prep) ---------------- */

function CoachChat({
  mentorshipId,
  mentorName,
  planReady,
  onTaskCreated,
}: {
  mentorshipId: string;
  mentorName: string;
  planReady: boolean;
  onTaskCreated: () => void;
}) {
  const [messages, setMessages] = useState<CoachMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepResult, setPrepResult] = useState<{ content: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    api
      .coachHistory(mentorshipId)
      .then((data) => setMessages(data.messages))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [mentorshipId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const optimistic: CoachMsg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await api.coachSend(mentorshipId, text);
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), res.userMessage, res.assistantMessage]);
      if (res.createdTasks.length > 0) {
        toast({
          title: "Task created by the Coach",
          description: res.createdTasks.map((t) => t.title).join(" · "),
        });
        onTaskCreated();
      }
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      toast({ title: "Failed to send", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function prepareSession() {
    setPreparing(true);
    try {
      const res = await api.prepare(mentorshipId);
      setPrepResult(res.prep);
      toast({ title: "Preparation ready!", description: "Copy the agenda and bring it to the session." });
      onTaskCreated();
    } catch (e) {
      toast({ title: "Error preparing session", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setPreparing(false);
    }
  }

  async function copyPrep() {
    const content = prepResult?.content;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy automatically", description: "Select the text and copy it manually." });
    }
  }

  return (
    <Card className="flex h-[640px] flex-col border-border shadow-sm">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-gold">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navy">AI Coach</p>
            <p className="text-xs text-muted-foreground">Support between sessions · always with your mentorship context</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={prepareSession}
          disabled={preparing || !planReady}
          className="mt-3 w-full gap-2 bg-gold font-semibold text-navy hover:bg-gold/90"
        >
          {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
          Prepare next session
        </Button>
      </div>

      <div ref={scrollRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto p-4">
        {!loaded && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
            Hi! I&apos;m your Collarint Coach. I know your goal, your plan with {mentorName}, and your tasks.
            Ask me anything — for example: <em>&ldquo;how should I prepare for the next session?&rdquo;</em>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user"
                  ? "rounded-br-md bg-navy text-white"
                  : "rounded-bl-md border border-border bg-card text-foreground"
              )}
            >
              {m.role === "assistant" ? (
                <MarkdownContent content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
              <span className="flex gap-1">
                <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input
            placeholder="Write to the Coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" size="icon" className="shrink-0 bg-navy hover:bg-navy-light" disabled={sending || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <Dialog open={!!prepResult} onOpenChange={(open) => !open && setPrepResult(null)}>
        <DialogContent className="max-h-[80vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy">Your preparation for the next session</DialogTitle>
          </DialogHeader>
          <div className="scroll-slim max-h-[50vh] overflow-y-auto pr-2 text-sm">
            <MarkdownContent content={prepResult?.content ?? ""} />
          </div>
          <DialogFooter>
            <Button onClick={copyPrep} className="gap-2 bg-navy hover:bg-navy-light">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MenteePrepSection({
  mentorshipId,
  onOpen,
}: {
  mentorshipId: string;
  onOpen: (prep: { content: string }) => void;
}) {
  const [prep, setPrep] = useState<{ content: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .mentorship(mentorshipId)
      .then((d) => setPrep(d.mentorship.latestPrep))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [mentorshipId]);

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <SectionTitle
          title="Mentee's preparation"
          subtitle="Agenda and questions generated by the AI Coach before the session"
        />
        <div className="mt-4">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && !prep && (
            <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              The mentee hasn&apos;t generated the next session preparation yet.
            </p>
          )}
          {!loading && prep && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold-soft/40 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-navy">
                  <Route className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">Agenda + 5 ready-made questions</p>
                  <p className="text-xs text-muted-foreground">
                    Generated on{" "}
                    {format(new Date(prep.createdAt), "MMMM d 'at' HH:mm", { locale: enUS })}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1 border-gold/50" onClick={() => onOpen(prep)}>
                <MessageSquare className="h-4 w-4" /> View preparation
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Scheduling (mentor) ---------------- */

function ScheduleDialog({
  open,
  onOpenChange,
  mentorshipId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorshipId: string;
  onDone: () => void;
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("19:00");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function confirm() {
    if (!date) return;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      await api.scheduleSession(mentorshipId, d.toISOString());
      toast({ title: "Session scheduled!", description: format(d, "MMMM d 'at' HH:mm", { locale: enUS }) });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast({ title: "Error scheduling session", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy">Schedule next session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center rounded-lg border border-border p-2">
            <Calendar mode="single" selected={date} onSelect={setDate} locale={enUS} disabled={{ before: new Date() }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sess-time">Time</Label>
            <Input id="sess-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={confirm} disabled={saving || !date} className="w-full gap-2 bg-navy hover:bg-navy-light">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Confirm schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Lightweight markdown ---------------- */

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h3 className="mb-1 text-sm font-bold text-navy">{children}</h3>,
        h2: ({ children }) => <h3 className="mb-1 text-sm font-bold text-navy">{children}</h3>,
        h3: ({ children }) => <h4 className="mb-1 text-sm font-semibold text-navy">{children}</h4>,
        code: ({ children }) => <code className="rounded bg-secondary px-1 py-0.5 text-xs">{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
