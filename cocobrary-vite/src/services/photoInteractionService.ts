import { assertSupabaseClient } from "../lib/supabaseClient";

export type PhotoSocialState = {
  comments: string[];
  likes: number;
  liked: boolean;
};

type PhotoCommentRow = {
  photo_id: string;
  body: string;
  created_at: string;
};

type PhotoLikeRow = {
  photo_id: string;
  client_id: string;
};

const CLIENT_ID_KEY = "cocobrary-vite:client-id";

export function getAnonymousClientId() {
  const existingClientId = window.localStorage.getItem(CLIENT_ID_KEY);

  if (existingClientId) {
    return existingClientId;
  }

  const clientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

export async function getPhotoSocialState(
  photoIds: string[],
  clientId: string,
): Promise<Record<string, PhotoSocialState>> {
  const initialState = Object.fromEntries(
    photoIds.map((photoId) => [
      photoId,
      {
        comments: [],
        likes: 0,
        liked: false,
      },
    ]),
  ) as Record<string, PhotoSocialState>;

  if (photoIds.length === 0) {
    return initialState;
  }

  const client = assertSupabaseClient();
  const [{ data: commentRows, error: commentsError }, { data: likeRows, error: likesError }] =
    await Promise.all([
      client
        .from("photo_comments")
        .select("photo_id,body,created_at")
        .in("photo_id", photoIds)
        .order("created_at", { ascending: true }),
      client.from("photo_likes").select("photo_id,client_id").in("photo_id", photoIds),
    ]);

  if (commentsError) {
    throw commentsError;
  }

  if (likesError) {
    throw likesError;
  }

  for (const row of (commentRows ?? []) as PhotoCommentRow[]) {
    initialState[row.photo_id]?.comments.push(row.body);
  }

  for (const row of (likeRows ?? []) as PhotoLikeRow[]) {
    const state = initialState[row.photo_id];

    if (!state) {
      continue;
    }

    state.likes += 1;
    state.liked = state.liked || row.client_id === clientId;
  }

  return initialState;
}

export async function createPhotoComment(photoId: string, body: string): Promise<void> {
  const client = assertSupabaseClient();
  const { error } = await client.from("photo_comments").insert({
    photo_id: photoId,
    body,
  });

  if (error) {
    throw error;
  }
}

export async function togglePhotoLike(photoId: string, clientId: string): Promise<void> {
  const client = assertSupabaseClient();
  const { data, error: selectError } = await client
    .from("photo_likes")
    .select("id")
    .eq("photo_id", photoId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (data?.id) {
    const { error: deleteError } = await client
      .from("photo_likes")
      .delete()
      .eq("id", data.id);

    if (deleteError) {
      throw deleteError;
    }

    return;
  }

  const { error: insertError } = await client.from("photo_likes").insert({
    photo_id: photoId,
    client_id: clientId,
  });

  if (insertError) {
    throw insertError;
  }
}
