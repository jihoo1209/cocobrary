"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { CoconutAvatar } from "@/components/coconut-avatar";
import { migrateTreeToAlbumIds } from "@/lib/custom-album-migration";
import { CoconutConfig, Trip } from "@/lib/types";

type CoconutTreeStageProps = {
  trip: Trip;
};

const SELF_COCONUT_KEY_PREFIX = "cocotree:";
const TREE_SLOT_POSITIONS = [
  { left: "28%", top: "18%" },
  { left: "62%", top: "24%" },
  { left: "87%", top: "calc(32% - 40px)" },
  { left: "40%", top: "calc(42% - 45px)" },
  { left: "calc(10% + 12px)", top: "calc(48% - 75px)" },
  { left: "calc(86% - 45px)", top: "calc(58% - 110px)" },
  { left: "calc(16% + 15px)", top: "calc(75% - 140px)" },
  { left: "calc(78% + 10px)", top: "calc(79% - 140px)" },
  { left: "45%", top: "calc(84% - 190px)" },
] as const;

function normalizeTreeStorage(value: unknown): CoconutConfig[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as CoconutConfig[];
  }

  if (value && typeof value === "object") {
    return [value as CoconutConfig];
  }

  return [];
}

function getAlbumMemberId(coconut: CoconutConfig, index: number) {
  return coconut.albumId ?? `custom-${index + 1}`;
}

function removeAlbumStorageForMember(tripId: string, memberId: string) {
  try {
    const savedPhotos = window.localStorage.getItem(`cocotree:${tripId}:local-photos`);
    const parsedPhotos = savedPhotos ? JSON.parse(savedPhotos) : [];

    if (Array.isArray(parsedPhotos)) {
      const filteredPhotos = parsedPhotos.filter(
        (photo) =>
          !Array.isArray(photo?.targets) ||
          !photo.targets.some((target: { memberId?: string }) => target.memberId === memberId),
      );

      window.localStorage.setItem(
        `cocotree:${tripId}:local-photos`,
        JSON.stringify(filteredPhotos),
      );
    }
  } catch {
    // Keep the main delete flow even if photo cleanup fails.
  }

  window.localStorage.removeItem(`cocotree:${tripId}:album-chat:${memberId}`);
  window.localStorage.removeItem(`cocotree:${tripId}:${memberId}:photo-likes`);
  window.localStorage.removeItem(`cocotree:${tripId}:${memberId}:photo-comments`);
}

function reindexAlbumStorageAfterDelete(tripId: string, deletedIndex: number, totalCount: number) {
  const deletedMemberId = `custom-${deletedIndex + 1}`;

  try {
    const savedPhotos = window.localStorage.getItem(`cocotree:${tripId}:local-photos`);
    const parsedPhotos = savedPhotos ? JSON.parse(savedPhotos) : [];

    if (Array.isArray(parsedPhotos)) {
      const reindexedPhotos = parsedPhotos
        .filter((photo) =>
          Array.isArray(photo?.targets) &&
          !photo.targets.some((target: { memberId?: string }) => target.memberId === deletedMemberId),
        )
        .map((photo) => {
          if (!Array.isArray(photo?.targets)) {
            return photo;
          }

          return {
            ...photo,
            targets: photo.targets.map((target: { memberId?: string }) => {
              const currentMemberId = target.memberId ?? "";

              if (!currentMemberId.startsWith("custom-")) {
                return target;
              }

              const slotNumber = Number.parseInt(currentMemberId.replace("custom-", ""), 10);

              if (!Number.isFinite(slotNumber) || slotNumber <= deletedIndex + 1) {
                return target;
              }

              return {
                ...target,
                memberId: `custom-${slotNumber - 1}`,
              };
            }),
          };
        });

      window.localStorage.setItem(
        `cocotree:${tripId}:local-photos`,
        JSON.stringify(reindexedPhotos),
      );
    }
  } catch {
    // If local photo data is malformed, skip reindexing and keep tree delete working.
  }

  window.localStorage.removeItem(`cocotree:${tripId}:album-chat:${deletedMemberId}`);
  window.localStorage.removeItem(`cocotree:${tripId}:${deletedMemberId}:photo-likes`);
  window.localStorage.removeItem(`cocotree:${tripId}:${deletedMemberId}:photo-comments`);

  for (let slotNumber = deletedIndex + 2; slotNumber <= totalCount; slotNumber += 1) {
    const currentMemberId = `custom-${slotNumber}`;
    const nextMemberId = `custom-${slotNumber - 1}`;

    const chatValue = window.localStorage.getItem(`cocotree:${tripId}:album-chat:${currentMemberId}`);
    if (chatValue !== null) {
      window.localStorage.setItem(`cocotree:${tripId}:album-chat:${nextMemberId}`, chatValue);
      window.localStorage.removeItem(`cocotree:${tripId}:album-chat:${currentMemberId}`);
    }

    const likesValue = window.localStorage.getItem(`cocotree:${tripId}:${currentMemberId}:photo-likes`);
    if (likesValue !== null) {
      window.localStorage.setItem(`cocotree:${tripId}:${nextMemberId}:photo-likes`, likesValue);
      window.localStorage.removeItem(`cocotree:${tripId}:${currentMemberId}:photo-likes`);
    }

    const commentsValue = window.localStorage.getItem(`cocotree:${tripId}:${currentMemberId}:photo-comments`);
    if (commentsValue !== null) {
      window.localStorage.setItem(`cocotree:${tripId}:${nextMemberId}:photo-comments`, commentsValue);
      window.localStorage.removeItem(`cocotree:${tripId}:${currentMemberId}:photo-comments`);
    }
  }
}

export function CoconutTreeStage({ trip }: CoconutTreeStageProps) {
  const router = useRouter();
  const [customCoconuts, setCustomCoconuts] = useState<CoconutConfig[]>([]);
  const [justPlantedIndex, setJustPlantedIndex] = useState<number | null>(null);
  const [deleteModeIndex, setDeleteModeIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextTapRef = useRef(false);
  const lastTapRef = useRef<{ index: number; time: number } | null>(null);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => {
    const treeKey = `${SELF_COCONUT_KEY_PREFIX}${trip.id}:tree`;
    const savedTree = window.localStorage.getItem(treeKey);
    const plantedKey = `cocotree:last-planted:${trip.id}`;
    const savedPlantedIndex = window.sessionStorage.getItem(plantedKey);

    try {
      const parsedTree = savedTree ? JSON.parse(savedTree) : [];
      const normalizedTree = normalizeTreeStorage(parsedTree);
      const baseTree = normalizedTree.slice(0, 9);
      const { migratedTree, changed } = migrateTreeToAlbumIds(trip.id, baseTree);
      const nextTree = migratedTree.slice(0, 9);

      if (changed) {
        window.localStorage.setItem(treeKey, JSON.stringify(nextTree));
      }

      setCustomCoconuts(nextTree);
      const nextJustPlantedIndex =
        savedPlantedIndex !== null ? Number.parseInt(savedPlantedIndex, 10) : null;
      setJustPlantedIndex(Number.isFinite(nextJustPlantedIndex) ? nextJustPlantedIndex : null);

      if (savedPlantedIndex !== null) {
        window.sessionStorage.removeItem(plantedKey);
        window.setTimeout(() => {
          setJustPlantedIndex(null);
        }, 1400);
      }
    } catch {
      setCustomCoconuts([]);
      setJustPlantedIndex(null);
    }
  }, [trip.id]);

  function persistTree(nextTree: CoconutConfig[]) {
    const treeKey = `${SELF_COCONUT_KEY_PREFIX}${trip.id}:tree`;
    window.localStorage.setItem(treeKey, JSON.stringify(nextTree));
    setCustomCoconuts(nextTree);
  }

  function handleDeleteCoconut(index: number) {
    const deletedCoconut = customCoconuts[index];

    if (deletedCoconut?.albumId) {
      removeAlbumStorageForMember(trip.id, deletedCoconut.albumId);
    } else {
      reindexAlbumStorageAfterDelete(trip.id, index, customCoconuts.length);
    }

    const nextTree = customCoconuts.filter((_, itemIndex) => itemIndex !== index);
    persistTree(nextTree);
    window.localStorage.removeItem(`${SELF_COCONUT_KEY_PREFIX}${trip.id}:self`);
    setDeleteModeIndex(null);
    setConfirmDeleteIndex(null);
  }

  function triggerDeleteMode(index: number) {
    clearLongPressTimer();
    setDeleteModeIndex(index);
    suppressNextTapRef.current = true;
  }

  function handlePointerDown(index: number) {
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      triggerDeleteMode(index);
    }, 520);
  }

  function handlePointerUp(index: number) {
    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (lastTap && lastTap.index === index && now - lastTap.time < 280) {
      triggerDeleteMode(index);
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { index, time: now };
    clearLongPressTimer();
  }

  function openAlbum(index: number) {
    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
      return;
    }

    setDeleteModeIndex(null);
    setConfirmDeleteIndex(null);
    router.push(`/trip/${trip.id}/album/${getAlbumMemberId(customCoconuts[index], index)}`);
  }

  return (
    <section
      className="relative h-[100svh] w-full overflow-hidden bg-[#8fc6ff]"
      onClick={() => {
        setDeleteModeIndex(null);
        setConfirmDeleteIndex(null);
      }}
    >
      <Image
        src="/assets/coconut-tree.png"
        alt="CocoTree main tree"
        fill
        priority
        className="object-cover"
        style={{ objectPosition: "50% 48%" }}
        sizes="100vw"
      />

      {customCoconuts.map((coconut, index) => {
        const slot = TREE_SLOT_POSITIONS[index];

        return (
          <div
            key={`${coconut.label ?? "coco"}-${index}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: slot.left, top: slot.top }}
            onClick={(event) => event.stopPropagation()}
          >
            {deleteModeIndex === index ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteIndex(index)}
                className="absolute -right-2 -top-8 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,87,87,0.94)] text-white shadow-[0_10px_22px_rgba(77,29,29,0.22)]"
                aria-label={`Delete ${coconut.label ?? `coconut ${index + 1}`}`}
              >
                <Trash2 size={16} />
              </button>
            ) : null}

            <button
              type="button"
              onPointerDown={() => handlePointerDown(index)}
              onPointerUp={() => handlePointerUp(index)}
              onPointerLeave={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onClick={() => openAlbum(index)}
              className={justPlantedIndex === index ? "animate-coconut-pop" : ""}
              aria-label={`Open album for ${coconut.label ?? `coconut ${index + 1}`}`}
            >
              <div className="absolute left-1/2 top-[-34px] h-10 w-[2px] -translate-x-1/2 rounded-full bg-[rgba(98,64,42,0.45)]" />
              <div className="absolute left-1/2 top-[-6px] h-4 w-4 -translate-x-1/2 rounded-full border border-[rgba(98,64,42,0.18)] bg-[rgba(255,250,243,0.92)] shadow-sm" />
              <div>
                <CoconutAvatar
                  config={coconut}
                  size={102}
                  priority={index === 0}
                  className="animate-floaty"
                />
              </div>
            </button>
          </div>
        );
      })}

      {confirmDeleteIndex !== null ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(42,27,19,0.22)] px-6 backdrop-blur-[2px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="w-full max-w-xs rounded-[28px] bg-[rgba(255,250,243,0.96)] px-5 py-5 text-center shadow-[0_18px_40px_rgba(62,41,28,0.18)]">
            <p className="text-base font-bold text-[var(--cocoa-deep)]">
              Delete this coconut?
            </p>
            <p className="mt-2 text-sm leading-6 text-[rgba(79,58,41,0.72)]">
              Its album, photos, likes, comments, and chat will also be deleted from this site.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteIndex(null)}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCoconut(confirmDeleteIndex)}
                className="rounded-full bg-[rgba(255,87,87,0.94)] px-4 py-2 text-sm font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Link
        href={`/trip/${trip.id}/customize`}
        aria-label="Add my coconut"
        className="absolute bottom-8 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white/75 text-[var(--cocoa-deep)] transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <Plus size={30} strokeWidth={2} color="currentColor" />
      </Link>
    </section>
  );
}
