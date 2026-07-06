"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlbumGallery } from "@/components/album-gallery";
import { AlbumChatFab } from "@/components/album-chat-fab";
import { ChevronLeft } from "lucide-react";
import { migrateTreeToAlbumIds } from "@/lib/custom-album-migration";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlbumPhoto, CoconutConfig, Trip, TripMember } from "@/lib/types";

type AlbumPageClientProps = {
  trip: Trip;
  memberId: string;
};

function dedupePhotosById(items: AlbumPhoto[]) {
  const seen = new Set<string>();

  return items.filter((photo) => {
    if (seen.has(photo.id)) {
      return false;
    }

    seen.add(photo.id);
    return true;
  });
}

export default function AlbumPageClient({
  trip,
  memberId,
}: AlbumPageClientProps) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>(trip.photos);
  const [customMember, setCustomMember] = useState<TripMember | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentTripMemberId, setCurrentTripMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (trip.databaseId) {
      setPhotos(trip.photos);
      return;
    }

    try {
      const saved = window.localStorage.getItem(`cocotree:${trip.id}:local-photos`);
      const parsed = saved ? JSON.parse(saved) : [];
      const localPhotos = Array.isArray(parsed) ? (parsed as AlbumPhoto[]) : [];
      setPhotos(dedupePhotosById([...localPhotos, ...trip.photos]));
    } catch {
      setPhotos(trip.photos);
    }
  }, [trip.id, trip.photos, trip.databaseId]);

  useEffect(() => {
    if (trip.members.some((item) => item.id === memberId)) {
      setCustomMember(null);
      return;
    }
    const savedTree = window.localStorage.getItem(`cocotree:${trip.id}:tree`);

    try {
      const parsed = savedTree ? JSON.parse(savedTree) : [];
      const tree = Array.isArray(parsed) ? (parsed as CoconutConfig[]) : [];
      const { migratedTree, changed } = migrateTreeToAlbumIds(trip.id, tree);

      if (changed) {
        window.localStorage.setItem(
          `cocotree:${trip.id}:tree`,
          JSON.stringify(migratedTree),
        );
      }

      const slotIndexFromRoute = memberId.startsWith("custom-")
        ? Number.parseInt(memberId.replace("custom-", ""), 10) - 1
        : -1;
      const coconut =
        migratedTree.find((item) => item?.albumId === memberId) ??
        (slotIndexFromRoute >= 0 ? migratedTree[slotIndexFromRoute] : undefined);

      if (!coconut) {
        setCustomMember(null);
        return;
      }

      const currentSlotIndex = migratedTree.findIndex((item) =>
        coconut.albumId ? item?.albumId === coconut.albumId : item === coconut,
      );
      const legacyMemberId =
        currentSlotIndex >= 0 ? `custom-${currentSlotIndex + 1}` : memberId;

      setCustomMember({
        id: coconut.albumId ?? memberId,
        nickname:
          coconut.label?.trim() ||
          `Coco ${Math.max(currentSlotIndex >= 0 ? currentSlotIndex + 1 : 1, 1)}`,
        bio: "This custom coconut is ready to collect its own photo memories.",
        position: { x: 50, y: 50 },
        coconut,
      });
    } catch {
      setCustomMember(null);
    }
  }, [memberId, trip.id, trip.members]);

  const member = useMemo(
    () => trip.members.find((item) => item.id === memberId) ?? customMember ?? trip.members[0],
    [trip.members, memberId, customMember],
  );
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    if (!supabase || !trip.databaseId) {
      setCurrentTripMemberId(null);
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function loadCurrentTripMember() {
      const { data: authData } = await client.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        if (!cancelled) {
          setCurrentTripMemberId(null);
        }
        return;
      }

      const { data: tripMember } = await client
        .from("trip_members")
        .select("id")
        .eq("trip_id", trip.databaseId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!cancelled) {
        setCurrentTripMemberId(tripMember?.id ?? null);
      }
    }

    void loadCurrentTripMember();

    return () => {
      cancelled = true;
    };
  }, [trip.databaseId]);

  async function deleteServerPhotos(photoIds: string[]) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase || !trip.databaseId || !member || photoIds.length === 0) {
      return false;
    }

    const { data: rows } = await supabase
      .from("album_photos")
      .select("id, storage_path")
      .eq("trip_id", trip.databaseId)
      .eq("album_id", member.id)
      .in("id", photoIds);

    const storagePaths = (rows ?? [])
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      await supabase.storage.from("trip-photos").remove(storagePaths);
    }

    const { error } = await supabase
      .from("album_photos")
      .delete()
      .eq("trip_id", trip.databaseId)
      .eq("album_id", member.id)
      .in("id", photoIds);

    return !error;
  }

  function handleAddMockPhotos(newPhotos: AlbumPhoto[]) {
    setPhotos((current) => {
      const next = dedupePhotosById([...newPhotos, ...current]);

      if (trip.databaseId) {
        return next;
      }

      try {
        const saved = window.localStorage.getItem(`cocotree:${trip.id}:local-photos`);
        const parsed = saved ? JSON.parse(saved) : [];
        const localPhotos = Array.isArray(parsed) ? (parsed as AlbumPhoto[]) : [];
        const mergedLocalPhotos = dedupePhotosById([...newPhotos, ...localPhotos]);
        window.localStorage.setItem(
          `cocotree:${trip.id}:local-photos`,
          JSON.stringify(mergedLocalPhotos),
        );
      } catch {
        window.localStorage.setItem(
          `cocotree:${trip.id}:local-photos`,
          JSON.stringify(dedupePhotosById(newPhotos)),
        );
      }

      return next;
    });
  }

  function toggleSelecting() {
    setIsSelecting((current) => {
      if (current) {
        setSelectedIds([]);
      }

      return !current;
    });
  }

  function handleToggleSelected(photoId: string) {
    setSelectedIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : current.length >= 30
          ? current
          : [...current, photoId],
    );
  }

  async function handleDeletePhoto(photoId: string) {
    if (trip.databaseId) {
      const deleted = await deleteServerPhotos([photoId]);

      if (!deleted) {
        return;
      }

      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setSelectedIds((current) => current.filter((id) => id !== photoId));
      return;
    }

    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    setSelectedIds((current) => current.filter((id) => id !== photoId));

    try {
      const saved = window.localStorage.getItem(`cocotree:${trip.id}:local-photos`);
      const parsed = saved ? JSON.parse(saved) : [];
      const localPhotos = Array.isArray(parsed) ? (parsed as AlbumPhoto[]) : [];
      window.localStorage.setItem(
        `cocotree:${trip.id}:local-photos`,
        JSON.stringify(localPhotos.filter((photo) => photo.id !== photoId)),
      );
    } catch {
      // Keep the in-memory delete even if localStorage is unavailable.
    }
  }

  async function handleDeleteSelectedPhotos(photoIds: string[]) {
    const photoIdSet = new Set(photoIds);

    if (trip.databaseId) {
      const deleted = await deleteServerPhotos(photoIds);

      if (!deleted) {
        return;
      }

      setPhotos((current) => current.filter((photo) => !photoIdSet.has(photo.id)));
      setSelectedIds([]);
      return;
    }

    setPhotos((current) => current.filter((photo) => !photoIdSet.has(photo.id)));
    setSelectedIds([]);

    try {
      const saved = window.localStorage.getItem(`cocotree:${trip.id}:local-photos`);
      const parsed = saved ? JSON.parse(saved) : [];
      const localPhotos = Array.isArray(parsed) ? (parsed as AlbumPhoto[]) : [];
      window.localStorage.setItem(
        `cocotree:${trip.id}:local-photos`,
        JSON.stringify(localPhotos.filter((photo) => !photoIdSet.has(photo.id))),
      );
    } catch {
      // Keep the in-memory delete even if localStorage is unavailable.
    }
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    if (!supabase || !trip.databaseId || !currentTripMemberId || !member) {
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function loadAlbumPhotosFromSupabase() {
      const { data: rows } = await client
        .from("album_photos")
        .select("id, trip_id, caption, created_at, storage_path")
        .eq("trip_id", trip.databaseId)
        .eq("album_id", member.id)
        .order("created_at", { ascending: false });

      const paths = (rows ?? []).map((row) => row.storage_path).filter(Boolean);
      const signedUrlMap = new Map<string, string>();

      if (paths.length > 0) {
        const { data: signedUrls } = await client.storage
          .from("trip-photos")
          .createSignedUrls(paths, 60 * 60);

        signedUrls?.forEach((item, index) => {
          if (item?.signedUrl) {
            signedUrlMap.set(paths[index], item.signedUrl);
          }
        });
      }

      if (!cancelled) {
        setPhotos(
          (rows ?? []).map((row) => ({
            id: row.id,
            tripId: row.trip_id,
            uploaderName: "Anonymous",
            caption: row.caption ?? "",
            createdAt: row.created_at,
            imageUrl: signedUrlMap.get(row.storage_path) ?? "",
            targets: [{ memberId: member.id }],
          })),
        );
      }
    }

    void loadAlbumPhotosFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [trip.databaseId, currentTripMemberId, member, trip.members]);

  if (!member) {
    return (
      <main className="app-shell mx-auto flex w-full max-w-md flex-col gap-4">
        <section className="scrap-card px-5 py-10 text-center text-sm text-[rgba(79,58,41,0.72)]">
          This coconut album could not be found.
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell mx-auto flex w-full max-w-md flex-col gap-4 pt-5">
      <header className="px-1">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={`/trip/${trip.id}`}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)]"
          >
            <ChevronLeft size={16} />
            back to tree
          </Link>
          <button
            type="button"
            onClick={toggleSelecting}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)]"
          >
            {isSelecting ? "done" : "select"}
          </button>
        </div>
        <p className="mt-5 text-[28px] font-normal leading-none text-[var(--leaf-deep)]">
          {member.nickname}&apos;s library
        </p>
      </header>

      <AlbumGallery
        tripId={trip.id}
        tripDatabaseId={trip.databaseId}
        currentTripMemberId={currentTripMemberId}
        member={member}
        photos={photos}
        isSelecting={isSelecting}
        selectedIds={selectedIds}
        onToggleSelected={handleToggleSelected}
        onDeletePhoto={handleDeletePhoto}
        onDeleteSelectedPhotos={handleDeleteSelectedPhotos}
      />
      <AlbumChatFab
        tripId={trip.id}
        tripDatabaseId={trip.databaseId}
        currentTripMemberId={currentTripMemberId}
        memberId={member.id}
        nickname={member.nickname}
        onUploadPhotos={handleAddMockPhotos}
      />
    </main>
  );
}
