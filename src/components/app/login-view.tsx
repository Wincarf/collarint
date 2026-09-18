"use client";

// Tela de entrada: login, cadastro e acesso rápido às contas de demonstração

import { useState } from "react";
import { useApp } from "./store";
import { api } from "./api-client";
import { BrandLogo } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Sparkles, HandHeart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEMO_ACCOUNTS = [
  { email: "lucas@demo.jci", label: "Lucas (mentorado)", icon: <Sparkles className="h-4 w-4" /> },
  { email: "marcos@demo.jci", label: "Marcos (mentor)", icon: <HandHeart className="h-4 w-4" /> },
  { email: "carlos@demo.jci", label: "Carlos (convite pendente)", icon: <HandHeart className="h-4 w-4" /> },
  { email: "admin@jci.org.br", label: "Administração JCI", icon: <Users className="h-4 w-4" /> },
];

export function LoginView() {
  const { setUser } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  async function finishAuth() {
    const { user } = await api.me();
    setUser(user); // o AppRoot exibe o wizard de onboarding se o perfil estiver incompleto
  }

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    try {
      await api.login(email, password);
      await finishAuth();
    } catch (e) {
      toast({
        title: "Não foi possível entrar",
        description: e instanceof Error ? e.message : "Verifique seus dados.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

  async function handleRegister(name: string, email: string, password: string) {
    setLoading(true);
    try {
      await api.register(name, email, password);
      await finishAuth();
    } catch (e) {
      toast({
        title: "Não foi possível criar a conta",
        description: e instanceof Error ? e.message : "Verifique seus dados.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

  async function quickLogin(email: string) {
    setDemoLoading(email);
    try {
      await api.login(email, "demo1234");
      await finishAuth();
    } catch (e) {
      toast({
        title: "Falha no acesso demo",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
      setDemoLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Hero — marca */}
      <div className="brand-gradient relative flex flex-col justify-between overflow-hidden px-6 py-10 lg:w-[46%] lg:px-12 lg:py-16">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "#D4A843" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full opacity-10 blur-3xl"
          style={{ background: "#D4A843" }}
          aria-hidden="true"
        />
        <BrandLogo dark />
        <div className="relative mt-10 lg:mt-0">
          <p className="mb-3 inline-block rounded-full border border-gold/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold">
            Junior Chamber International · Programa de Mentoria
          </p>
          <h1 className="max-w-xl text-3xl font-bold leading-tight text-white lg:text-4xl">
            Conecte-se com quem já percorreu o caminho que você quer trilhar.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 lg:text-base">
            O Collarint une membros experientes a quem busca desenvolvimento profissional por meio
            de <strong className="text-gold">skill matching semântico</strong> — e acompanha sua
            evolução com um <strong className="text-gold">IA Coach</strong> entre as sessões.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
              Matching inteligente: top 5 mentores com score de compatibilidade
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
              Plano de 4 sessões gerado por IA a partir do seu objetivo
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
              Coach entre sessões: tarefas, pautas e acompanhamento contínuo
            </li>
          </ul>
        </div>
        <p className="mt-10 text-xs text-white/50 lg:mt-0">
          MVP de demonstração · Hackathon JCI · {new Date().getFullYear()}
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Card className="border-border shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <Tabs defaultValue="login">
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="register">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <LoginForm loading={loading} onSubmit={handleLogin} />
                </TabsContent>
                <TabsContent value="register">
                  <RegisterForm loading={loading} onSubmit={handleRegister} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="mt-6">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Acesso rápido para demonstração
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start gap-2 border-border bg-card px-3 py-2.5 text-xs"
                  disabled={demoLoading !== null}
                  onClick={() => quickLogin(acc.email)}
                >
                  {demoLoading === acc.email ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  ) : (
                    acc.icon
                  )}
                  <span className="font-medium">{acc.label}</span>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Senha de todas as contas demo: <code className="rounded bg-secondary px-1.5 py-0.5">demo1234</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, password);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Senha</Label>
        <Input
          id="login-password"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full bg-navy hover:bg-navy-light" disabled={loading}>
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "Entrar"}
      </Button>
    </form>
  );
}

function RegisterForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (name: string, email: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, email, password);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="reg-name">Nome completo</Label>
        <Input id="reg-name" placeholder="Ex.: Ana Beatriz Souza" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" type="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">Senha</Label>
        <Input
          id="reg-password"
          type="password"
          placeholder="Mínimo de 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>
      <Button type="submit" className="w-full bg-navy hover:bg-navy-light" disabled={loading}>
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "Criar conta"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Depois do cadastro, um breve questionário configura seu perfil de mentoria.
      </p>
    </form>
  );
}
