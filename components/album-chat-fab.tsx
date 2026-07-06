"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlbumPhoto } from "@/lib/types";

type AnonymousChatMessage = {
  id: string;
  body: string;
  createdAt: string;
};

type AlbumChatFabProps = {
  tripId: string;
  tripDatabaseId?: string;
  currentTripMemberId?: string | null;
  memberId: string;
  nickname: string;
  onUploadPhotos?: (photos: AlbumPhoto[]) => void;
};

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read file."));
    };

    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function buildUploadPhotoId(memberId: string, file: File, index: number) {
  return [
    memberId,
    file.name,
    file.size,
    file.lastModified,
    index,
  ].join("-");
}

function formatTimeLabel(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AlbumChatFab({
  tripId,
  tripDatabaseId,
  currentTripMemberId,
  memberId,
  nickname,
  onUploadPhotos,
}: AlbumChatFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AnonymousChatMessage[]>([]);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const useServerSync = Boolean(supabase && tripDatabaseId && currentTripMemberId);

  const storageKey = useMemo(
    () => `cocotree:${tripId}:album-chat:${memberId}`,
    [tripId, memberId],
  );

  useEffect(() => {
    if (useServerSync && supabase && tripDatabaseId) {
      let cancelled = false;
      const client = supabase;

      async function loadMessagesFromSupabase() {
        const { data } = await client
          .from("album_chats")
          .select("id, body, created_at")
          .eq("trip_id", tripDatabaseId)
          .eq("album_id", memberId)
          .order("created_at", { ascending: true });

        if (!cancelled) {
          setMessages(
            (data ?? []).map((item) => ({
              id: item.id,
              body: item.body,
              createdAt: item.created_at,
            })),
          );
          setHasLoadedMessages(true);
        }
      }

      void loadMessagesFromSupabase();

      return () => {
        cancelled = true;
      };
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMessages([]);
    } finally {
      setHasLoadedMessages(true);
    }
  }, [storageKey, memberId, supabase, tripDatabaseId, useServerSync]);

  useEffect(() => {
    if (!hasLoadedMessages || useServerSync) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey, hasLoadedMessages, useServerSync]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    if (useServerSync && supabase && tripDatabaseId && currentTripMemberId) {
      const client = supabase;
      const { data } = await client
        .from("album_chats")
        .insert({
          trip_id: tripDatabaseId,
          album_id: memberId,
          trip_member_id: currentTripMemberId,
          body: trimmed,
        })
        .select("id, body, created_at")
        .single();

      if (data) {
        setMessages((current) => [
          ...current,
          {
            id: data.id,
            body: data.body,
            createdAt: data.created_at,
          },
        ]);
      }
    } else {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          body: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setMessage("");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (useServerSync && supabase && tripDatabaseId && currentTripMemberId) {
      const client = supabase;
      const uploadedPhotos: AlbumPhoto[] = [];

      for (const file of files) {
        const path = `${tripDatabaseId}/${memberId}/${Date.now()}-${file.name}`;
        const { error: storageError } = await client.storage
          .from("trip-photos")
          .upload(path, file, { upsert: false });

        if (storageError) {
          continue;
        }

        const { data: photoRow } = await client
          .from("album_photos")
          .insert({
            trip_id: tripDatabaseId,
            album_id: memberId,
            uploader_member_id: currentTripMemberId,
            caption: file.name,
            storage_path: path,
          })
          .select("id, trip_id, caption, created_at, storage_path")
          .single();

        if (!photoRow) {
          continue;
        }

        const { data: signedUrlData } = await client.storage
          .from("trip-photos")
          .createSignedUrl(path, 60 * 60);

        if (!signedUrlData?.signedUrl) {
          continue;
        }

        uploadedPhotos.push({
          id: photoRow.id,
          tripId: photoRow.trip_id,
          uploaderName: "You",
          caption: photoRow.caption ?? file.name,
          createdAt: photoRow.created_at,
          imageUrl: signedUrlData.signedUrl,
          targets: [{ memberId }],
        });
      }

      if (uploadedPhotos.length > 0) {
        onUploadPhotos?.(uploadedPhotos);
      }

      event.target.value = "";
      return;
    }

    const uploadedPhotos = await Promise.all(
      files.map(async (file, index) => ({
        id: buildUploadPhotoId(memberId, file, index),
        tripId,
        uploaderName: "You",
        caption: file.name,
        createdAt: new Date().toISOString(),
        imageUrl: await fileToDataUrl(file),
        targets: [{ memberId }],
      })),
    );

    onUploadPhotos?.(uploadedPhotos);
    event.target.value = "";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => uploadInputRef.current?.click()}
        aria-label={`Add something to ${nickname}'s album`}
        className="fixed bottom-24 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/75 text-[var(--cocoa-deep)] shadow-[0_12px_30px_rgba(62,41,28,0.18)] backdrop-blur-md transition hover:bg-white/85"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] border-2 border-[var(--cocoa-deep)] bg-transparent text-lg font-bold leading-none text-[var(--cocoa-deep)]">
          <span className="translate-y-[1px]">+</span>
        </span>
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open anonymous chat for ${nickname}`}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/75 text-[var(--cocoa-deep)] shadow-[0_12px_30px_rgba(62,41,28,0.18)] backdrop-blur-md transition hover:bg-white/85"
      >
        <MessageCircle size={24} strokeWidth={2.2} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(42,27,19,0.18)] backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close anonymous chat"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0"
          />

          <section className="relative flex max-h-[82vh] w-full flex-col rounded-t-[32px] bg-[rgba(255,250,243,0.96)] px-5 pb-5 pt-4 shadow-[0_-10px_30px_rgba(62,41,28,0.18)] backdrop-blur-xl">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[rgba(95,54,34,0.18)]" />

            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-[var(--cocoa-deep)]">
                  Anonymous chat
                </p>
                <p className="mt-1 text-sm text-[rgba(79,58,41,0.68)]">
                  Leave a note for {nickname}&apos;s album.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[var(--cocoa-deep)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-[180px] flex-1 space-y-3 overflow-y-auto pb-4">
              {messages.length === 0 ? (
                <div className="rounded-[24px] bg-white/70 px-5 py-8 text-center text-sm leading-6 text-[rgba(79,58,41,0.72)]">
                  No anonymous notes yet. Start the first little message.
                </div>
              ) : (
                messages.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[22px] bg-white/82 px-4 py-3 shadow-[0_10px_24px_rgba(62,41,28,0.08)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[rgba(95,54,34,0.55)]">
                        Anonymous
                      </p>
                      <p className="text-xs text-[rgba(79,58,41,0.54)]">
                        {formatTimeLabel(item.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
                      {item.body}
                    </p>
                  </article>
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-2">
              <label className="block">
                <span className="sr-only">Anonymous message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 240))}
                  placeholder="Leave an anonymous note..."
                  rows={3}
                  className="w-full resize-none rounded-[24px] border-0 bg-white/78 px-4 py-3 text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[rgba(79,58,41,0.45)]"
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[rgba(79,58,41,0.55)]">
                  Anonymous only · up to 240 characters
                </p>
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--cocoa-deep)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={16} />
                  Send
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
