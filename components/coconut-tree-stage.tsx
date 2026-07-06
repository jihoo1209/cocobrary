"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { CoconutAvatar } from "@/components/coconut-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Trip, TripMember } from "@/lib/types";

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

type CoconutTreeStageProps = {
  trip: Trip;
};

function buildMemberFromRow(
  row: {
    id: string;
    nickname: string;
    profile_note?: string | null;
    coconut_x?: number | null;
    coconut_y?: number | null;
    coconuts?:
      | {
          base_image?: string | null;
          accessories?: TripMember["coconut"]["accessories"] | null;
          label?: string | null;
          colors?: TripMember["coconut"]["colors"] | null;
          metadata?: Record<string, unknown> | null;
        }
      | {
          base_image?: string | null;
          accessories?: TripMember["coconut"]["accessories"] | null;
          label?: string | null;
          colors?: TripMember["coconut"]["colors"] | null;
          metadata?: Record<string, unknown> | null;
        }[]
      | null;
  },
): TripMember {
  const coconutRow = Array.isArray(row.coconuts) ? row.coconuts[0] : row.coconuts;
  const metadata =
    coconutRow?.metadata && typeof coconutRow.metadata === "object"
      ? (coconutRow.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    nickname: row.nickname,
    bio: row.profile_note ?? undefined,
    position: {
      x: row.coconut_x ?? 50,
      y: row.coconut_y ?? 40,
    },
    coconut: {
      persisted: Boolean(coconutRow),
      albumId: row.id,
      baseImage: coconutRow?.base_image ?? "/assets/coconut-01.png",
      accessories: coconutRow?.accessories ?? [],
      label: coconutRow?.label ?? row.nickname,
      sunglassesImage:
        typeof metadata.sunglassesImage === "string" ? metadata.sunglassesImage : "",
      skirtImage: typeof metadata.skirtImage === "string" ? metadata.skirtImage : "",
      hairImage: typeof metadata.hairImage === "string" ? metadata.hairImage : "",
      accessoryImage: "",
      accessoryTopImage:
        typeof metadata.accessoryTopImage === "string" ? metadata.accessoryTopImage : "",
      accessoryBottomImage:
        typeof metadata.accessoryBottomImage === "string" ? metadata.accessoryBottomImage : "",
      colors: coconutRow?.colors ?? {},
    },
  };
}

function getBadgeIndex(members: TripMember[], memberId: string) {
  return members.findIndex((member) => member.id === memberId);
}

export function CoconutTreeStage({ trip }: CoconutTreeStageProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const longPressTimeoutRef = useRef<number | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ memberId: string | null; time: number }>({
    memberId: null,
    time: 0,
  });
  const [currentTripMemberId, setCurrentTripMemberId] = useState<string | null>(null);
  const [sharedMembers, setSharedMembers] = useState<TripMember[]>(trip.members);
  const [justPlantedIndex, setJustPlantedIndex] = useState<number | null>(null);
  const [deleteModeMemberId, setDeleteModeMemberId] = useState<string | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const visibleMembers = useMemo(
    () => sharedMembers.filter((member) => member.coconut.persisted).slice(0, 9),
    [sharedMembers],
  );

  useEffect(() => {
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
  }, [supabase, trip.databaseId]);

  useEffect(() => {
    if (!supabase || !trip.databaseId || !currentTripMemberId) {
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function loadSharedMembers() {
      const { data: rows } = await client
        .from("trip_members")
        .select(
          "id, nickname, profile_note, coconut_x, coconut_y, created_at, coconuts(base_image, accessories, label, colors, metadata)",
        )
        .eq("trip_id", trip.databaseId)
        .order("created_at", { ascending: true });

      if (cancelled) {
        return;
      }

      setSharedMembers((rows ?? []).map(buildMemberFromRow));
    }

    void loadSharedMembers();

    return () => {
      cancelled = true;
    };
  }, [supabase, trip.databaseId, currentTripMemberId]);

  useEffect(() => {
    const plantedMemberId = sessionStorage.getItem(
      `cocotree:last-planted-member:${trip.id}`,
    );

    if (!plantedMemberId) {
      setJustPlantedIndex(null);
      return;
    }

    const nextIndex = getBadgeIndex(visibleMembers, plantedMemberId);

    if (nextIndex >= 0) {
      setJustPlantedIndex(nextIndex);
      const timeout = window.setTimeout(() => setJustPlantedIndex(null), 1800);
      sessionStorage.removeItem(`cocotree:last-planted-member:${trip.id}`);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    sessionStorage.removeItem(`cocotree:last-planted-member:${trip.id}`);
    setJustPlantedIndex(null);
  }, [trip.id, visibleMembers]);

  useEffect(() => {
    function handleOutsidePointerDown() {
      setDeleteModeMemberId(null);
    }

    if (!deleteModeMemberId || confirmDeleteMemberId) {
      return;
    }

    window.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [deleteModeMemberId, confirmDeleteMemberId]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  function beginLongPress(memberId: string) {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }

    longPressTimeoutRef.current = window.setTimeout(() => {
      setDeleteModeMemberId(memberId);
      longPressTimeoutRef.current = null;
    }, 460);
  }

  function cancelLongPress() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function openAlbum(memberId: string) {
    router.push(`/trip/${trip.id}/album/${memberId}`);
  }

  function handleDesktopClick(memberId: string) {
    if (deleteModeMemberId === memberId) {
      return;
    }

    openAlbum(memberId);
  }

  function handleTouchEnd(memberId: string) {
    cancelLongPress();

    if (deleteModeMemberId === memberId) {
      return;
    }

    const now = Date.now();
    const wasDoubleTap =
      lastTapRef.current.memberId === memberId && now - lastTapRef.current.time < 280;

    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }

    if (wasDoubleTap) {
      setDeleteModeMemberId(memberId);
      lastTapRef.current = { memberId: null, time: 0 };
      return;
    }

    lastTapRef.current = { memberId, time: now };
    tapTimeoutRef.current = window.setTimeout(() => {
      openAlbum(memberId);
      tapTimeoutRef.current = null;
    }, 260);
  }

  async function handleDeleteMember(member: TripMember) {
    if (!supabase || !trip.databaseId) {
      return;
    }

    setIsDeleting(true);
    setDeleteModeMemberId(null);

    try {
      const { data: photoRows } = await supabase
        .from("album_photos")
        .select("storage_path")
        .eq("trip_id", trip.databaseId)
        .eq("album_id", member.id);

      const storagePaths = (photoRows ?? [])
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        await supabase.storage.from("trip-photos").remove(storagePaths);
      }

      await supabase.rpc("delete_own_album", {
        target_trip_id: trip.databaseId,
        target_album_member_id: member.id,
      });

      sessionStorage.removeItem(`cocotree:last-planted-member:${trip.id}`);
      router.refresh();
    } finally {
      setConfirmDeleteMemberId(null);
      setIsDeleting(false);
    }
  }

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-[#bfe7f8]">
      <Image
        src="/assets/coconut-tree.png"
        alt={`${trip.name} coconut tree`}
        fill
        priority
        className="object-cover"
        style={{ objectPosition: "50% 48%" }}
      />

      {visibleMembers.map((member, index) => {
        const position = TREE_SLOT_POSITIONS[index];
        const isCurrentUsersCoconut = currentTripMemberId === member.id;
        const isDeleteMode = deleteModeMemberId === member.id;
        const shouldAnimate = justPlantedIndex === index;

        return (
          <div
            key={member.id}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${shouldAnimate ? "animate-coconut-pop" : ""}`}
            style={position}
          >
            <div className="pointer-events-none absolute left-1/2 top-[-22px] h-5 w-px -translate-x-1/2 bg-[rgba(78,55,33,0.22)]" />
            <div className="pointer-events-none absolute left-1/2 top-[-26px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[rgba(78,55,33,0.26)] bg-[rgba(255,255,255,0.72)]" />

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDesktopClick(member.id);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (isCurrentUsersCoconut) {
                  setDeleteModeMemberId(member.id);
                }
              }}
              onMouseDown={() => {
                if (isCurrentUsersCoconut) {
                  beginLongPress(member.id);
                }
              }}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => {
                if (isCurrentUsersCoconut) {
                  beginLongPress(member.id);
                }
              }}
              onTouchEnd={(event) => {
                event.stopPropagation();
                handleTouchEnd(member.id);
              }}
              onTouchCancel={cancelLongPress}
              className="relative block"
              aria-label={`${member.nickname} album`}
            >
              <CoconutAvatar
                config={member.coconut}
                size={150}
              />
            </button>

            {isDeleteMode && isCurrentUsersCoconut ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmDeleteMemberId(member.id);
                }}
                className="absolute right-[-10px] top-[-12px] z-30 flex h-9 w-9 items-center justify-center rounded-full bg-[#d75d5d] text-white shadow-[0_12px_25px_rgba(120,42,42,0.32)]"
                aria-label={`Delete ${member.nickname}`}
              >
                <Trash2 size={17} />
              </button>
            ) : null}
          </div>
        );
      })}

      {confirmDeleteMemberId !== null ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(42,27,19,0.22)] px-6 backdrop-blur-[2px]"
          onClick={() => {
            if (!isDeleting) {
              setConfirmDeleteMemberId(null);
            }
          }}
        >
          <div
            className="w-full max-w-xs rounded-[28px] bg-[rgba(255,250,243,0.96)] px-5 py-5 text-center shadow-[0_18px_40px_rgba(62,41,28,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold text-[var(--cocoa-deep)]">
              Delete this coconut?
            </p>
            <p className="mt-2 text-sm leading-6 text-[rgba(79,58,41,0.72)]">
              Its album, photos, likes, comments, and chat will also be deleted from
              this site.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteMemberId(null)}
                disabled={isDeleting}
                className="rounded-full bg-[rgba(255,255,255,0.84)] px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)] disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => {
                  const member = visibleMembers.find(
                    (item) => item.id === confirmDeleteMemberId,
                  );

                  if (member) {
                    void handleDeleteMember(member);
                  }
                }}
                disabled={isDeleting}
                className="rounded-full bg-[#d75d5d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => router.push(`/trip/${trip.id}/customize`)}
        aria-label="Add my coconut"
        className="absolute bottom-8 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white/75 text-[var(--cocoa-deep)] transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <Plus size={30} strokeWidth={2} color="currentColor" />
      </button>
    </section>
  );
}
