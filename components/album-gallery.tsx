"use client";

import { FormEvent, TouchEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  MessageCircle,
  Images,
  Trash2,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlbumPhoto, TripMember } from "@/lib/types";

type AlbumGalleryProps = {
  tripId: string;
  tripDatabaseId?: string;
  currentTripMemberId?: string | null;
  member: TripMember;
  photos: AlbumPhoto[];
  isSelecting: boolean;
  selectedIds: string[];
  onToggleSelected: (photoId: string) => void;
  onDeletePhoto?: (photoId: string) => void;
  onDeleteSelectedPhotos?: (photoIds: string[]) => void;
};

type PhotoLikeState = {
  count: number;
  liked: boolean;
};

type AnonymousPhotoComment = {
  id: string;
  body: string;
  createdAt: string;
};

function formatPhotoTimestamp(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AlbumGallery({
  tripId,
  tripDatabaseId,
  currentTripMemberId,
  member,
  photos,
  isSelecting,
  selectedIds,
  onToggleSelected,
  onDeletePhoto,
  onDeleteSelectedPhotos,
}: AlbumGalleryProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [photoLikes, setPhotoLikes] = useState<Record<string, PhotoLikeState>>({});
  const [photoComments, setPhotoComments] = useState<
    Record<string, AnonymousPhotoComment[]>
  >({});
  const [hasLoadedPhotoLikes, setHasLoadedPhotoLikes] = useState(false);
  const [hasLoadedPhotoComments, setHasLoadedPhotoComments] = useState(false);
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const useServerSync = Boolean(supabase && tripDatabaseId && currentTripMemberId);

  const memberPhotos = useMemo(
    () =>
      photos.filter((photo) =>
        photo.targets.some((target) => target.memberId === member.id),
      ),
    [member.id, photos],
  );
  const memberPhotoIds = useMemo(() => memberPhotos.map((photo) => photo.id), [memberPhotos]);

  useEffect(() => {
    if (useServerSync && memberPhotoIds.length === 0) {
      setPhotoLikes({});
      setHasLoadedPhotoLikes(true);
      return;
    }

    if (useServerSync && supabase && currentTripMemberId && memberPhotoIds.length > 0) {
      let cancelled = false;
      const client = supabase;

      async function loadLikesFromSupabase() {
        const { data } = await client
          .from("album_photo_likes")
          .select("photo_id, trip_member_id")
          .in("photo_id", memberPhotoIds);

        if (cancelled) {
          return;
        }

        const nextLikes: Record<string, PhotoLikeState> = {};

        (data ?? []).forEach((row) => {
          const current = nextLikes[row.photo_id] ?? { count: 0, liked: false };
          nextLikes[row.photo_id] = {
            count: current.count + 1,
            liked: current.liked || row.trip_member_id === currentTripMemberId,
          };
        });

        setPhotoLikes(nextLikes);
        setHasLoadedPhotoLikes(true);
      }

      void loadLikesFromSupabase();

      return () => {
        cancelled = true;
      };
    }

    const storageKey = `cocotree:${tripId}:${member.id}:photo-likes`;

    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      setPhotoLikes(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setPhotoLikes({});
    } finally {
      setHasLoadedPhotoLikes(true);
    }
  }, [tripId, member.id, currentTripMemberId, memberPhotoIds, supabase, useServerSync]);

  useEffect(() => {
    if (!hasLoadedPhotoLikes || useServerSync) {
      return;
    }

    window.localStorage.setItem(
      `cocotree:${tripId}:${member.id}:photo-likes`,
      JSON.stringify(photoLikes),
    );
  }, [photoLikes, tripId, member.id, hasLoadedPhotoLikes, useServerSync]);

  useEffect(() => {
    if (useServerSync && memberPhotoIds.length === 0) {
      setPhotoComments({});
      setHasLoadedPhotoComments(true);
      return;
    }

    if (useServerSync && supabase && memberPhotoIds.length > 0) {
      let cancelled = false;
      const client = supabase;

      async function loadCommentsFromSupabase() {
        const { data } = await client
          .from("album_photo_comments")
          .select("id, photo_id, body, created_at")
          .in("photo_id", memberPhotoIds)
          .order("created_at", { ascending: true });

        if (cancelled) {
          return;
        }

        const nextComments: Record<string, AnonymousPhotoComment[]> = {};

        (data ?? []).forEach((row) => {
          nextComments[row.photo_id] = [
            ...(nextComments[row.photo_id] ?? []),
            {
              id: row.id,
              body: row.body,
              createdAt: row.created_at,
            },
          ];
        });

        setPhotoComments(nextComments);
        setHasLoadedPhotoComments(true);
      }

      void loadCommentsFromSupabase();

      return () => {
        cancelled = true;
      };
    }

    const storageKey = `cocotree:${tripId}:${member.id}:photo-comments`;

    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      setPhotoComments(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setPhotoComments({});
    } finally {
      setHasLoadedPhotoComments(true);
    }
  }, [tripId, member.id, memberPhotoIds, supabase, useServerSync]);

  useEffect(() => {
    if (!hasLoadedPhotoComments || useServerSync) {
      return;
    }

    window.localStorage.setItem(
      `cocotree:${tripId}:${member.id}:photo-comments`,
      JSON.stringify(photoComments),
    );
  }, [photoComments, tripId, member.id, hasLoadedPhotoComments, useServerSync]);

  function toggleSelected(photoId: string) {
    if (!isSelecting) {
      return;
    }
    onToggleSelected(photoId);
  }

  function openPhoto(index: number) {
    if (isSelecting) {
      return;
    }

    setActivePhotoIndex(index);
  }

  function closePhotoViewer() {
    setActivePhotoIndex(null);
    setTouchStartX(null);
    setIsCommentPanelOpen(false);
    setCommentDraft("");
  }

  function showPreviousPhoto() {
    setActivePhotoIndex((current) => {
      if (current === null) {
        return current;
      }

      return current === 0 ? memberPhotos.length - 1 : current - 1;
    });
  }

  function showNextPhoto() {
    setActivePhotoIndex((current) => {
      if (current === null) {
        return current;
      }

      return current === memberPhotos.length - 1 ? 0 : current + 1;
    });
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        showPreviousPhoto();
      } else {
        showNextPhoto();
      }
    }

    setTouchStartX(null);
  }

  function downloadPhotos(items: AlbumPhoto[]) {
    items.forEach((photo) => {
      const anchor = document.createElement("a");
      anchor.href = photo.imageUrl;
      anchor.download = `${member.nickname}-${photo.id}.png`;
      anchor.click();
    });
  }

  function downloadSinglePhoto(photo: AlbumPhoto) {
    const anchor = document.createElement("a");
    anchor.href = photo.imageUrl;
    anchor.download = `${member.nickname}-${photo.id}.png`;
    anchor.click();
  }

  function handleDeleteActivePhoto() {
    if (!activePhoto) {
      return;
    }

    onDeletePhoto?.(activePhoto.id);
    closePhotoViewer();
  }

  function handleDeleteSelectedPhotos() {
    if (selectedIds.length === 0) {
      return;
    }

    onDeleteSelectedPhotos?.(selectedIds);
  }

  async function toggleLike(photoId: string) {
    if (useServerSync && supabase && currentTripMemberId) {
      const client = supabase;
      const existing = photoLikes[photoId] ?? { count: 0, liked: false };

      if (existing.liked) {
        await client
          .from("album_photo_likes")
          .delete()
          .eq("photo_id", photoId)
          .eq("trip_member_id", currentTripMemberId);
      } else {
        await client.from("album_photo_likes").insert({
          photo_id: photoId,
          trip_member_id: currentTripMemberId,
        });
      }

      setPhotoLikes((current) => {
        const state = current[photoId] ?? { count: 0, liked: false };
        const nextLiked = !state.liked;
        const nextCount = nextLiked
          ? state.count + 1
          : Math.max(state.count - 1, 0);

        return {
          ...current,
          [photoId]: {
            count: nextCount,
            liked: nextLiked,
          },
        };
      });
      return;
    }

    setPhotoLikes((current) => {
      const existing = current[photoId] ?? { count: 0, liked: false };
      const nextLiked = !existing.liked;
      const nextCount = nextLiked
        ? existing.count + 1
        : Math.max(existing.count - 1, 0);

      return {
        ...current,
        [photoId]: {
          count: nextCount,
          liked: nextLiked,
        },
      };
    });
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activePhoto) {
      return;
    }

    const trimmed = commentDraft.trim();

    if (!trimmed) {
      return;
    }

    if (useServerSync && supabase && currentTripMemberId) {
      const client = supabase;
      const { data } = await client
        .from("album_photo_comments")
        .insert({
          photo_id: activePhoto.id,
          trip_member_id: currentTripMemberId,
          body: trimmed,
        })
        .select("id, photo_id, body, created_at")
        .single();

      if (data) {
        setPhotoComments((current) => ({
          ...current,
          [data.photo_id]: [
            ...(current[data.photo_id] ?? []),
            {
              id: data.id,
              body: data.body,
              createdAt: data.created_at,
            },
          ],
        }));
      }

      setCommentDraft("");
      return;
    }

    setPhotoComments((current) => ({
      ...current,
      [activePhoto.id]: [
        ...(current[activePhoto.id] ?? []),
        {
          id: `${activePhoto.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          body: trimmed,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setCommentDraft("");
  }

  const selectedPhotos = memberPhotos.filter((photo) => selectedIds.includes(photo.id));
  const activePhoto = activePhotoIndex === null ? null : memberPhotos[activePhotoIndex];
  const activePhotoNumber = activePhotoIndex === null ? 0 : activePhotoIndex + 1;
  const activePhotoLikeState = activePhoto
    ? (photoLikes[activePhoto.id] ?? { count: 0, liked: false })
    : { count: 0, liked: false };
  const activePhotoComments = activePhoto ? (photoComments[activePhoto.id] ?? []) : [];

  return (
    <section className="px-0 py-0">
      {isSelecting ? (
        <div className="mb-4 rounded-[24px] bg-white/62 px-4 py-3 backdrop-blur-md">
          <p className="text-sm text-[rgba(79,58,41,0.72)]">
            {selectedIds.length}/30 selected
          </p>
          <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => downloadPhotos(selectedPhotos)}
              disabled={selectedPhotos.length === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--accent-coral)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download size={16} />
              Download selected
            </button>
            <button
              type="button"
              onClick={() => downloadPhotos(memberPhotos)}
              disabled={memberPhotos.length === 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[rgba(255,255,255,0.86)] px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Images size={16} />
              Download all
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedPhotos}
              disabled={selectedIds.length === 0}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-coral)] text-white disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Delete selected photos"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {memberPhotos.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgba(95,54,34,0.18)] bg-white/50 px-5 py-10 text-center text-sm text-[rgba(79,58,41,0.7)]">
          No photos yet in this library.
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {memberPhotos.map((photo, index) => {
            const isSelected = selectedIds.includes(photo.id);

            return (
              <button
                key={photo.id}
                type="button"
                onClick={() =>
                  isSelecting ? toggleSelected(photo.id) : openPhoto(index)
                }
                className={`relative overflow-hidden rounded-none ${
                  isSelecting ? "cursor-pointer" : "cursor-default"
                } ${
                  isSelected
                    ? "ring-2 ring-[var(--leaf)] ring-offset-2 ring-offset-[rgba(255,250,243,0.9)]"
                    : ""
                }`}
              >
                <div className="relative aspect-square w-full bg-[rgba(255,255,255,0.68)]">
                  <Image
                    src={photo.imageUrl}
                    alt={photo.caption}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 20vw, 96px"
                  />
                </div>
                {isSelecting ? (
                  <div
                    className={`absolute inset-0 transition ${
                      isSelected ? "bg-[rgba(45,132,74,0.18)]" : "bg-[rgba(255,255,255,0.04)]"
                    }`}
                  />
                ) : null}
                {isSelecting ? (
                  <div className="absolute right-1.5 top-1.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-[var(--leaf)] bg-[var(--leaf)] text-white"
                          : "border-white/85 bg-[rgba(255,255,255,0.74)] text-transparent"
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {activePhoto ? (
        <div className="fixed inset-0 z-50 bg-[rgba(24,16,12,0.92)]">
          <button
            type="button"
            aria-label="Close photo viewer"
            onClick={closePhotoViewer}
            className="absolute inset-0"
          />

          <div
            className="relative flex h-full w-full items-center justify-center px-4 py-12"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              onClick={closePhotoViewer}
              className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md"
            >
              <X size={18} />
            </button>

            {memberPhotos.length > 1 ? (
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="absolute left-4 z-10 inline-flex h-11 w-11 items-center justify-center text-white"
              >
                <ChevronLeft size={22} />
              </button>
            ) : null}

            <div className="relative h-full max-h-[82vh] w-full max-w-2xl">
              <Image
                src={activePhoto.imageUrl}
                alt={activePhoto.caption}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            {memberPhotos.length > 1 ? (
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-4 z-10 inline-flex h-11 w-11 items-center justify-center text-white"
              >
                <ChevronRight size={22} />
              </button>
            ) : null}

            <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => downloadSinglePhoto(activePhoto)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md"
              >
                <Download size={20} />
              </button>
              <button
                type="button"
                onClick={handleDeleteActivePhoto}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md"
              >
                <Trash2 size={20} />
              </button>
            </div>

            <div className="absolute bottom-8 left-6 z-10 flex items-center gap-5">
              <button
                type="button"
                onClick={() => setIsCommentPanelOpen((current) => !current)}
                className="inline-flex items-center gap-2 text-white"
              >
                <MessageCircle size={22} className="text-white" />
                <span className="text-sm font-medium text-white">
                  {activePhotoComments.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleLike(activePhoto.id)}
                className="inline-flex items-center gap-2 text-white"
              >
                <Heart
                  size={22}
                  className="text-white"
                  fill={activePhotoLikeState.liked ? "currentColor" : "none"}
                />
                <span className="text-sm font-medium text-white">
                  {activePhotoLikeState.count}
                </span>
              </button>
            </div>

            {isCommentPanelOpen ? (
              <section className="absolute bottom-24 left-6 z-10 w-[min(320px,calc(100vw-48px))] rounded-[22px] bg-[rgba(255,255,255,0.14)] p-4 text-white backdrop-blur-md">
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {activePhotoComments.length === 0 ? (
                    <p className="text-sm text-white/72">
                      No anonymous comments yet.
                    </p>
                  ) : (
                    activePhotoComments.map((comment) => (
                      <article key={comment.id} className="rounded-[16px] bg-white/10 px-3 py-2">
                        <p className="text-sm leading-5 text-white">{comment.body}</p>
                      </article>
                    ))
                  )}
                </div>

                <form onSubmit={handleCommentSubmit} className="mt-3">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value.slice(0, 180))}
                    placeholder="Leave an anonymous comment..."
                    rows={2}
                    className="w-full resize-none rounded-[16px] border border-white/18 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/52"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={!commentDraft.trim()}
                      className="rounded-full border border-white/28 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      send
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 px-4 py-3 text-center text-white">
              <p className="text-sm font-medium tracking-[0.02em] text-white">
                {formatPhotoTimestamp(activePhoto.createdAt)}
              </p>
              <p className="mt-1 text-xs text-white/78">
                {activePhotoNumber} / {memberPhotos.length}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
