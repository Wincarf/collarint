"use client";

// Shell da SPA: carrega sessão, decide a view (login / onboarding / app),
// renderiza navegação superior com sino de notificações e rodapé sticky.

import { useCallback, useEffect, useState } from "react";
import { useApp, type View } from "./store";
import { api } from "./api-client";
import { LoginView } from "./login-view";
import { OnboardingWizard } from "./onboarding-wizard";
import { MenteeHome } from "./mentee-home";
import { MatchesView } from "./matches-view";
import { MentorshipView } from "./mentorship-view";
import { MentorPanel } from "./mentor-panel";
import { AdminView } from "./admin-view";
import { BrandLogo, InitialsAvatar } from "./ui-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Compass, LayoutDashboard, LogOut, ShieldCheck, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/lib/types";

export function AppRoot() {
  const { user, loadingUser, view, setView, setUser, notifications, unread, setNotifications } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);

  const refreshNotifications = useCallback(() => {
    api
      .notifications()
      .then((d) => setNotifications(d.notifications, d.unread))
      .catch(() => undefined);
  }, [setNotifications]);

  useEffect(() => {
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => useApp.getState().setLoadingUser(false));
  }, [setUser]);

  useEffect(() => {
    if (user) {
      refreshNotifications();
      const timer = setInterval(refreshNotifications, 30000);
      return () => clearInterval(timer);
    }
  }, [user, refreshNotifications]);

  async function openNotification(n: NotificationDTO) {
    try {
      if (!n.read) await api.markNotifications(n.id);
    } catch {
      // ignora falha de marcação
    }
    setNotifOpen(false);
    refreshNotifications();
    if (n.payload?.mentorshipId) {
      if (n.type === "mentorship_invite") {
        setView({ name: "mentor" });
      } else {
        setView({ name: "mentorship", id: n.payload.mentorshipId });
      }
    }
  }

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-gold" />
          <p className="text-sm text-muted-foreground">Carregando Collarint...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (!user.onboarded) {
    return <OnboardingWizard />;
  }

  const navItems: Array<{ view: View; label: string; icon: React.ReactNode }> = [
    { view: { name: "home" }, label: "Início", icon: <Compass className="h-4 w-4" /> },
    { view: { name: "matches" }, label: "Matches", icon: <Sparkles className="h-4 w-4" /> },
    { view: { name: "mentor" }, label: "Painel do mentor", icon: <Users className="h-4 w-4" /> },
  ];
  if (user.isAdmin) {
    navItems.push({
      view: { name: "admin" },
      label: "Admin",
      icon: <LayoutDashboard className="h-4 w-4" />,
    });
  }

  function isActive(v: View): boolean {
    if (v.name === view.name) {
      if (v.name === "mentorship" && view.name === "mentorship") return v.id === view.id;
      return true;
    }
    return false;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="brand-gradient sticky top-0 z-40 shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            onClick={() => setView({ name: "home" })}
            className="flex items-center"
            aria-label="Ir para o início"
          >
            <BrandLogo dark compact />
          </button>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setView(item.view)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.view) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Sino de notificações */}
            <button
              onClick={() => {
                setNotifOpen(true);
                if (unread > 0) {
                  api.markNotifications().then(refreshNotifications).catch(() => undefined);
                }
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={`Notificações (${unread} não lidas)`}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {/* Menu do usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none ring-gold focus-visible:ring-2">
                <InitialsAvatar name={user.name} color={user.avatarColor} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold text-navy">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.isAdmin && (
                  <DropdownMenuItem onClick={() => setView({ name: "admin" })} className="gap-2">
                    <ShieldCheck className="h-4 w-4" /> Dashboard admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    await api.logout().catch(() => undefined);
                    setUser(null);
                    setView({ name: "home" });
                  }}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Navegação mobile */}
        <nav
          className="flex overflow-x-auto border-t border-white/10 px-2 pb-2 pt-1 md:hidden"
          aria-label="Navegação principal mobile"
        >
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setView(item.view)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                isActive(item.view) ? "bg-white/15 text-white" : "text-white/70"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {view.name === "home" && <MenteeHome />}
        {view.name === "matches" && <MatchesView />}
        {view.name === "mentorship" && (
          <MentorshipView
            id={view.id}
            onBack={() => setView({ name: "home" })}
          />
        )}
        {view.name === "mentor" && <MentorPanel />}
        {view.name === "admin" && <AdminView />}
      </main>

      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <p className="text-xs text-muted-foreground">
            JCI Collarint · Plataforma de mentoria por skill matching · Junior Chamber International
          </p>
          <p className="text-xs text-muted-foreground">MVP de demonstração</p>
        </div>
      </footer>

      {/* Diálogo de notificações */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-h-[75vh] overflow-y-auto scroll-slim sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy">Notificações</DialogTitle>
            <DialogDescription>Acontecimentos recentes nas suas mentorias</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:border-gold/40",
                    n.read ? "border-transparent bg-secondary/50" : "border-gold/40 bg-gold-soft/30"
                  )}
                >
                  <p className={cn("text-sm", n.read ? "text-muted-foreground" : "font-semibold text-navy")}>
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { locale: ptBR, addSuffix: true })}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
