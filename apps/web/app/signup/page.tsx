"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, User } from "lucide-react";
import { Brand } from "@/components/nav/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "employer" ? "employer" : "worker";

  const [role, setRole] = useState<"worker" | "employer">(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // Email confirmation is required by the Supabase project's auth settings.
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push(role === "worker" ? "/w/onboarding" : "/e/onboarding");
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <div className="card p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold text-ink-900">Confirme o seu email</h1>
        <p className="text-sm text-ink-500">
          Enviámos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, volte e entre com a sua
          palavra-passe.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button variant="outline">Ir para Entrar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-900">Criar conta</h1>
      <p className="mb-6 text-sm text-ink-500">Leva menos de um minuto.</p>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRole("worker")}
          className={cn(
            "focus-ring flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium",
            role === "worker" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500"
          )}
        >
          <User size={20} />
          Sou candidato
        </button>
        <button
          type="button"
          onClick={() => setRole("employer")}
          className={cn(
            "focus-ring flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium",
            role === "employer" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500"
          )}
        >
          <Briefcase size={20} />
          Sou empregador
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="full_name">Nome</Label>
          <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Palavra-passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger-500">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "A criar conta…" : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-subtle px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Suspense>
          <SignupForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-ink-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
