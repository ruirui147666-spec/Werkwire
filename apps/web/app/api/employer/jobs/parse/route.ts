import { NextResponse } from "next/server";
import { parseJobPostingText } from "@/lib/groq";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { text } = await request.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Texto em falta." }, { status: 400 });
  }

  const parsed = await parseJobPostingText(text);
  // null quando o Groq não está configurado — o empregador preenche os
  // campos à mão nos passos seguintes, sem quebrar o fluxo.
  return NextResponse.json({ suggestion: parsed });
}
