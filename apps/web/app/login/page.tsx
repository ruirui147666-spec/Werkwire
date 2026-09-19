"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand } from "@/components/nav/Brand";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Email ou palavra-passe incorretos.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

    const next = searchParams.get("next");
    if (next) router.push(next);
    else if (profile?.role === "employer") router.push("/e");
    else if (profile?.role === "admin") router.push("/admin");
    else router.push("/w");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h1 className="mb-6 text-xl font-semibold text-ink-900">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger-500">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "A entrar…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-subtle px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-ink-500">
          Ainda não tem conta?{" "}
          <Link href="/signup?role=worker" className="font-medium text-brand-600 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
