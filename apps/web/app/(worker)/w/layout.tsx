import { NavShell } from "@/components/nav/NavShell";
import { Brand } from "@/components/nav/Brand";
import { requireRole } from "@/lib/auth";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("worker");

  return (
    <NavShell role="worker" brand={<Brand />}>
      {children}
    </NavShell>
  );
}
