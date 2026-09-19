import { requireRole } from "@/lib/auth";

// Consola de administração (§7.7) — fora do alcance deste MVP (moderação,
// simulador de pesos, fila de contestações, auditoria de equidade). Este
// stub existe só para que a role 'admin' tenha um destino válido em vez
// de um redirecionamento morto.
export default async function AdminHomePage() {
  await requireRole("admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-subtle px-4 text-center">
      <div>
        <h1 className="mb-2 text-xl font-semibold text-ink-900">Consola de administração</h1>
        <p className="text-sm text-ink-500">Fora do alcance deste MVP. Ver README para a ordem de construção.</p>
      </div>
    </div>
  );
}
