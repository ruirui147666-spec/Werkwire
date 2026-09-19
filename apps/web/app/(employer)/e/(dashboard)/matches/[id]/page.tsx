import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";

export default async function EmployerMatchChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: company } = await supabase.from("companies").select("id").eq("owner_user_id", user.id).single();

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, worker_id, jobs!inner(company_id, title)")
    .eq("id", id)
    .single();

  if (!match || (match as any).jobs?.company_id !== company?.id || match.status !== "confirmed") notFound();

  const { data: worker } = await supabase
    .from("worker_profiles")
    .select("user_id, display_alias")
    .eq("id", match.worker_id)
    .maybeSingle();
  const { data: profile } = worker
    ? await supabase.from("profiles").select("full_name").eq("id", worker.user_id).maybeSingle()
    : { data: null };

  const { data: conversation } = await supabase.from("conversations").select("id").eq("match_id", id).single();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversation!.id)
    .order("created_at", { ascending: true });

  const { data: pipelineRows } = await supabase
    .from("pipeline_events")
    .select("stage")
    .eq("match_id", id)
    .order("occurred_at", { ascending: false })
    .limit(1);

  const { data: hire } = await supabase
    .from("hires")
    .select("confirmed_by_worker, confirmed_by_employer")
    .eq("match_id", id)
    .maybeSingle();

  return (
    <ChatView
      matchId={id}
      conversationId={conversation!.id}
      currentUserId={user.id}
      counterpartName={profile?.full_name ?? worker?.display_alias ?? "Candidato"}
      initialMessages={(messages ?? []).map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at,
      }))}
      currentStage={(pipelineRows?.[0]?.stage as any) ?? "chat"}
      hire={hire ?? { confirmed_by_worker: false, confirmed_by_employer: false }}
      perspective="employer"
    />
  );
}
