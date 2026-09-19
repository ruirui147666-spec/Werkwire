import { Handshake, UserRound } from "lucide-react";
import { NavShell } from "@/components/nav/NavShell";
import { Brand } from "@/components/nav/Brand";
import { requireRole } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/w", label: "Matches", icon: Handshake },
  { href: "/w/perfil", label: "Perfil", icon: UserRound },
];

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("worker");

  return (
    <NavShell items={NAV_ITEMS} brand={<Brand />}>
      {children}
    </NavShell>
  );
}
