import { assertSupabaseClient } from "../lib/supabaseClient";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
};

type ChatMessageRow = {
  id: string;
  body: string;
  created_at: string;
};

function mapChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getAlbumChatMessages(coconutId: string): Promise<ChatMessage[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("album_chat_messages")
    .select("id,body,created_at")
    .eq("coconut_id", coconutId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ChatMessageRow[]).map(mapChatMessage);
}

export async function createAlbumChatMessage(coconutId: string, body: string): Promise<void> {
  const client = assertSupabaseClient();
  const { error } = await client.from("album_chat_messages").insert({
    coconut_id: coconutId,
    body,
  });

  if (error) {
    throw error;
  }
}
