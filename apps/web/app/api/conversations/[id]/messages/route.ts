import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({ body: z.string().min(1).max(2000) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // RLS ("participants read conversation messages") only returns rows the
  // caller is entitled to see — no extra ownership check needed here.
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    messages: (data ?? []).map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  // RLS ("participants send messages") já garante que só quem participa
  // num match confirmado pode escrever aqui — usamos o cliente do próprio
  // utilizador, não o service role.
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id: user.id, body: parsed.data.body });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
