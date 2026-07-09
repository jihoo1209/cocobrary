import { assertSupabaseClient, supabaseStorageBucket } from "../lib/supabaseClient";

export type AlbumPhoto = {
  id: string;
  caption: string;
  imageUrl: string;
  storagePath: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  comments: string[];
};

type AlbumPhotoRow = {
  id: string;
  coconut_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

function createPhotoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionFromFile(file: File) {
  const nameExtension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  if (nameExtension) {
    return nameExtension;
  }

  if (file.type.includes("jpeg")) {
    return "jpg";
  }

  if (file.type.includes("png")) {
    return "png";
  }

  if (file.type.includes("gif")) {
    return "gif";
  }

  if (file.type.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

function mapAlbumPhotoRow(row: AlbumPhotoRow): AlbumPhoto {
  const client = assertSupabaseClient();
  const { data } = client.storage
    .from(supabaseStorageBucket)
    .getPublicUrl(row.storage_path);

  return {
    id: row.id,
    caption: row.caption ?? "Photo",
    imageUrl: data.publicUrl,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    likes: 0,
    liked: false,
    comments: [],
  };
}

export async function getAlbumPhotos(coconutId: string): Promise<AlbumPhoto[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("album_photos")
    .select("id,coconut_id,storage_path,caption,created_at")
    .eq("coconut_id", coconutId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AlbumPhotoRow[]).map(mapAlbumPhotoRow);
}

export async function uploadAlbumPhoto(coconutId: string, file: File): Promise<AlbumPhoto> {
  const client = assertSupabaseClient();
  const photoId = createPhotoId();
  const extension = extensionFromFile(file);
  const storagePath = `albums/${coconutId}/${photoId}.${extension}`;
  const { error: uploadError } = await client.storage
    .from(supabaseStorageBucket)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await client
    .from("album_photos")
    .insert({
      id: photoId,
      coconut_id: coconutId,
      storage_path: storagePath,
      caption: file.name || "Photo",
    })
    .select("id,coconut_id,storage_path,caption,created_at")
    .single();

  if (insertError) {
    await client.storage.from(supabaseStorageBucket).remove([storagePath]);
    throw insertError;
  }

  return mapAlbumPhotoRow(data as AlbumPhotoRow);
}

export async function deleteAlbumPhoto(photo: Pick<AlbumPhoto, "id" | "storagePath">): Promise<void> {
  const client = assertSupabaseClient();
  const { error: storageError } = await client.storage
    .from(supabaseStorageBucket)
    .remove([photo.storagePath]);

  if (storageError) {
    throw storageError;
  }

  const { error: rowError } = await client.from("album_photos").delete().eq("id", photo.id);

  if (rowError) {
    throw rowError;
  }
}
