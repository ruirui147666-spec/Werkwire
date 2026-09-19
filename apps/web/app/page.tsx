import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Brand } from "@/components/nav/Brand";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-ink-100">
        <div className="container-app flex h-16 items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container-app py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles size={14} /> Sem candidaturas. Sem pesquisa. Só matches.
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            O emprego certo encontra-o. <span className="text-brand-500">Literalmente.</span>
          </h1>
          <p className="mt-4 text-lg text-ink-500">
            A Werkwire emparelha candidatos e vagas em ciclos automáticos. Não há botão
            &ldquo;candidatar&rdquo;, não há currículos perdidos numa pilha de 250. Só aparece quando
            serve bem aos dois lados — e só os dois, ao mesmo tempo, decidem avançar.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup?role=worker">
              <Button size="lg" fullWidth className="sm:w-auto">
                Sou candidato
              </Button>
            </Link>
            <Link href="/signup?role=employer">
              <Button size="lg" variant="outline" fullWidth className="sm:w-auto">
                Sou empregador
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container-app pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <Timer className="mb-3 text-brand-500" size={24} />
            <h3 className="mb-1 font-semibold text-ink-900">90 segundos para começar</h3>
            <p className="text-sm text-ink-500">
              Perfil por perguntas simples, não um formulário de 40 campos. Ou envie o CV e nós
              tratamos do resto — você só confirma.
            </p>
          </Card>
          <Card>
            <CheckCircle2 className="mb-3 text-accent-500" size={24} />
            <h3 className="mb-1 font-semibold text-ink-900">Só matches a sério</h3>
            <p className="text-sm text-ink-500">
              Um match só existe quando serve bem aos dois lados — salário, horário, distância,
              competências. Explicado em linguagem simples, sempre.
            </p>
          </Card>
          <Card>
            <ShieldCheck className="mb-3 text-ink-700" size={24} />
            <h3 className="mb-1 font-semibold text-ink-900">Anónimo até decidir</h3>
            <p className="text-sm text-ink-500">
              O seu nome e contacto só são partilhados depois de ambos aceitarem. Até lá, é só o
              perfil profissional que conta.
            </p>
          </Card>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8">
        <div className="container-app text-sm text-ink-400">© {new Date().getFullYear()} Werkwire</div>
      </footer>
    </div>
  );
}
