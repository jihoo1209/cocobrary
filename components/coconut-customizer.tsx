"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { CoconutAvatar } from "@/components/coconut-avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { CoconutConfig, TripMember } from "@/lib/types";

const baseOptions = [
  "/assets/coconut-01.png",
  "/assets/coconut-02.png",
  "/assets/coconut-03.png",
  "/assets/coconut-04.png",
];

const sunglassesOptions = [
  "/assets/sunglasses-01.png",
  "/assets/sunglasses-03.png",
  "/assets/sunglasses-04.png",
  "/assets/sunglasses-05.png",
  "/assets/sunglasses-06.png",
  "/assets/sunglasses-07.png",
];

const skirtOptions = [
  "/assets/skirt-01.png",
  "/assets/skirt-02.png",
  "/assets/skirt-03.png",
  "/assets/skirt-05.png",
];

const hairOptions = [
  "/assets/hair-01.png",
  "/assets/hair-02.png",
  "/assets/hair-03.png",
  "/assets/hair-04.png",
  "/assets/hair-05.png",
];

const accessoryOptions = [
  "/assets/accessory-01.png",
  "/assets/accessory-02.png",
  "/assets/accessory-03.png",
  "/assets/accessory-04.png",
  "/assets/accessory-05.png",
  "/assets/accessory-06.png",
  "/assets/accessory-07.png",
];
const accessoryTopOptions = accessoryOptions.slice(0, 4);
const accessoryBottomOptions = accessoryOptions.slice(4);

type CustomizerPanel = "base" | "sunglasses" | "skirts" | "accessories" | "hair";

function sanitizeConfig(config: CoconutConfig): CoconutConfig {
  const isValidSunglasses = Boolean(
    config.sunglassesImage && sunglassesOptions.includes(config.sunglassesImage),
  );
  const isValidSkirt = Boolean(config.skirtImage && skirtOptions.includes(config.skirtImage));
  const isValidHair = Boolean(config.hairImage && hairOptions.includes(config.hairImage));
  const normalizedTopImage =
    config.accessoryTopImage ||
    (config.accessoryImage && accessoryTopOptions.includes(config.accessoryImage)
      ? config.accessoryImage
      : "");
  const normalizedBottomImage =
    config.accessoryBottomImage ||
    (config.accessoryImage && accessoryBottomOptions.includes(config.accessoryImage)
      ? config.accessoryImage
      : "");
  const isValidAccessory = Boolean(
    (normalizedTopImage && accessoryTopOptions.includes(normalizedTopImage)) ||
      (normalizedBottomImage && accessoryBottomOptions.includes(normalizedBottomImage)),
  );

  return {
    ...config,
    accessories: config.accessories.filter((item) => {
      if (item === "sunglasses") {
        return isValidSunglasses;
      }
      if (item === "ornament") {
        return isValidAccessory;
      }
      if (item === "hulaSkirt") {
        return isValidSkirt;
      }
      if (item === "hair") {
        return isValidHair;
      }
      return true;
    }),
    sunglassesImage: isValidSunglasses ? config.sunglassesImage : "",
    skirtImage: isValidSkirt ? config.skirtImage : "",
    hairImage: isValidHair ? config.hairImage : "",
    accessoryImage: "",
    accessoryTopImage:
      normalizedTopImage && accessoryTopOptions.includes(normalizedTopImage)
        ? normalizedTopImage
        : "",
    accessoryBottomImage:
      normalizedBottomImage && accessoryBottomOptions.includes(normalizedBottomImage)
        ? normalizedBottomImage
        : "",
  };
}

function removeAccessoryFlag(
  accessories: CoconutConfig["accessories"],
  accessory: (typeof accessories)[number],
) {
  return accessories.filter((item) => item !== accessory);
}

type CoconutCustomizerProps = {
  tripId: string;
  tripDatabaseId?: string;
  members: TripMember[];
};

function getAnonymousProfileKey(tripSlug: string) {
  return `cocotree:${tripSlug}:anonymous-profile`;
}

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
          accessories?: CoconutConfig["accessories"] | null;
          label?: string | null;
          colors?: CoconutConfig["colors"] | null;
          metadata?: Record<string, unknown> | null;
        }
      | {
          base_image?: string | null;
          accessories?: CoconutConfig["accessories"] | null;
          label?: string | null;
          colors?: CoconutConfig["colors"] | null;
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
      y: row.coconut_y ?? 39,
    },
    coconut: {
      persisted: Boolean(coconutRow),
      albumId: row.id,
      baseImage: coconutRow?.base_image ?? baseOptions[0],
      accessories: coconutRow?.accessories ?? ["nameLabel"],
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

export function CoconutCustomizer({
  tripId,
  tripDatabaseId,
  members,
}: CoconutCustomizerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const baseSwipeStartX = useRef<number | null>(null);
  const sunglassesSwipeStartX = useRef<number | null>(null);
  const skirtsSwipeStartX = useRef<number | null>(null);
  const hairSwipeStartX = useRef<number | null>(null);
  const accessoriesSwipeStartX = useRef<number | null>(null);
  const hydratedMemberIdRef = useRef<string | null>(null);
  const fallbackMember: TripMember = {
    id: "self",
    nickname: "My Coco",
    position: { x: 50, y: 39 },
    coconut: {
      baseImage: baseOptions[0],
      accessories: ["nameLabel"],
      label: "My Coco",
      sunglassesImage: "",
      skirtImage: "",
      hairImage: "",
      accessoryImage: "",
      accessoryTopImage: "",
      accessoryBottomImage: "",
      colors: {},
    },
  };
  const initialMember = members[0] ?? fallbackMember;
  const [currentTripMemberId, setCurrentTripMemberId] = useState<string | null>(null);
  const [hydratedMember, setHydratedMember] = useState<TripMember | null>(null);
  const selectedMember =
    hydratedMember ??
    members.find((member) => member.id === currentTripMemberId) ??
    initialMember;
  const initialConfig = sanitizeConfig(
    selectedMember?.coconut ?? {
      baseImage: baseOptions[0],
      accessories: ["nameLabel"],
      label: selectedMember?.nickname ?? "Friend",
      sunglassesImage: "",
      skirtImage: "",
      hairImage: "",
      accessoryImage: "",
      accessoryTopImage: "",
      accessoryBottomImage: "",
      colors: {},
    },
  );
  const [config, setConfig] = useState<CoconutConfig>(
    initialConfig,
  );
  const [status, setStatus] = useState("Your coconut will be saved to the shared tree.");
  const [activePanel, setActivePanel] = useState<CustomizerPanel>("base");

  useEffect(() => {
    if (!supabase || !tripDatabaseId) {
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function loadCurrentMember() {
      const { data: authData } = await client.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        return;
      }

      let { data: tripMember } = await client
        .from("trip_members")
        .select(
          "id, nickname, profile_note, coconut_x, coconut_y, coconuts(base_image, accessories, label, colors, metadata)",
        )
        .eq("trip_id", tripDatabaseId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!tripMember) {
        try {
          const savedProfile = window.localStorage.getItem(getAnonymousProfileKey(tripId));
          const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;
          const desiredNickname =
            parsedProfile &&
            typeof parsedProfile === "object" &&
            parsedProfile.userId === userId &&
            typeof parsedProfile.nickname === "string"
              ? parsedProfile.nickname.trim().slice(0, 8)
              : "";

          if (desiredNickname) {
            const { error: joinError } = await client.rpc("join_trip_by_slug", {
              target_trip_slug: tripId,
              desired_nickname: desiredNickname,
            });

            if (!joinError) {
              const { data: joinedMember } = await client
                .from("trip_members")
                .select(
                  "id, nickname, profile_note, coconut_x, coconut_y, coconuts(base_image, accessories, label, colors, metadata)",
                )
                .eq("trip_id", tripDatabaseId)
                .eq("user_id", userId)
                .maybeSingle();

              tripMember = joinedMember ?? null;
            }
          }
        } catch {
          // Ignore malformed local profile cache and leave fallback handling below.
        }
      }

      if (cancelled) {
        return;
      }

      const nextMemberId = tripMember?.id ?? null;
      setCurrentTripMemberId(nextMemberId);
      setHydratedMember(tripMember ? buildMemberFromRow(tripMember) : null);
    }

    void loadCurrentMember();

    return () => {
      cancelled = true;
    };
  }, [supabase, tripDatabaseId]);

  useEffect(() => {
    const member =
      hydratedMember ??
      members.find((item) => item.id === currentTripMemberId) ??
      initialMember;
    const hydrateKey = member.id;

    if (hydratedMemberIdRef.current === hydrateKey) {
      return;
    }

    hydratedMemberIdRef.current = hydrateKey;
    setConfig(
      sanitizeConfig(
        member?.coconut ?? {
          baseImage: baseOptions[0],
          accessories: ["nameLabel"],
          label: member?.nickname ?? "My Coco",
          sunglassesImage: "",
          skirtImage: "",
          hairImage: "",
          accessoryImage: "",
          accessoryTopImage: "",
          accessoryBottomImage: "",
          colors: {},
        },
      ),
    );
  }, [currentTripMemberId, hydratedMember, members, initialMember]);

  function cycleBase(direction: -1 | 1) {
    setConfig((current) => {
      const currentIndex = Math.max(0, baseOptions.indexOf(current.baseImage));
      const nextIndex =
        (currentIndex + direction + baseOptions.length) % baseOptions.length;

      return {
        ...current,
        baseImage: baseOptions[nextIndex],
      };
    });
  }

  function cycleSunglasses(direction: -1 | 1) {
    setConfig((current) => {
      const currentIndex = current.sunglassesImage
        ? Math.max(0, sunglassesOptions.indexOf(current.sunglassesImage))
        : 0;
      const nextIndex =
        (currentIndex + direction + sunglassesOptions.length) % sunglassesOptions.length;

      return {
        ...current,
        accessories: current.accessories.includes("sunglasses")
          ? current.accessories
          : [...current.accessories, "sunglasses"],
        sunglassesImage: sunglassesOptions[nextIndex],
      };
    });
  }

  function cycleSkirts(direction: -1 | 1) {
    setConfig((current) => {
      const currentIndex = current.skirtImage
        ? Math.max(0, skirtOptions.indexOf(current.skirtImage))
        : 0;
      const nextIndex = (currentIndex + direction + skirtOptions.length) % skirtOptions.length;

      return {
        ...current,
        accessories: current.accessories.includes("hulaSkirt")
          ? current.accessories
          : [...current.accessories, "hulaSkirt"],
        skirtImage: skirtOptions[nextIndex],
      };
    });
  }

  function cycleHair(direction: -1 | 1) {
    setConfig((current) => {
      const currentIndex = current.hairImage
        ? Math.max(0, hairOptions.indexOf(current.hairImage))
        : 0;
      const nextIndex = (currentIndex + direction + hairOptions.length) % hairOptions.length;

      return {
        ...current,
        accessories: current.accessories.includes("hair")
          ? current.accessories
          : [...current.accessories, "hair"],
        hairImage: hairOptions[nextIndex],
      };
    });
  }

  function cycleAccessories(direction: -1 | 1) {
    setConfig((current) => {
      const currentIndex = current.accessoryTopImage
        ? Math.max(0, accessoryTopOptions.indexOf(current.accessoryTopImage))
        : 0;
      const nextIndex =
        (currentIndex + direction + accessoryTopOptions.length) % accessoryTopOptions.length;

      return {
        ...current,
        accessories: current.accessories.includes("ornament")
          ? current.accessories
          : [...current.accessories, "ornament"],
        accessoryTopImage: accessoryTopOptions[nextIndex],
      };
    });
  }

  function handleBaseSwipeStart(clientX: number) {
    baseSwipeStartX.current = clientX;
  }

  function handleBaseSwipeEnd(clientX: number) {
    if (baseSwipeStartX.current === null) {
      return;
    }

    const deltaX = clientX - baseSwipeStartX.current;
    baseSwipeStartX.current = null;

    if (Math.abs(deltaX) < 30) {
      return;
    }

    cycleBase(deltaX < 0 ? 1 : -1);
  }

  function handleSunglassesSwipeStart(clientX: number) {
    sunglassesSwipeStartX.current = clientX;
  }

  function handleSunglassesSwipeEnd(clientX: number) {
    if (sunglassesSwipeStartX.current === null) {
      return;
    }

    const deltaX = clientX - sunglassesSwipeStartX.current;
    sunglassesSwipeStartX.current = null;

    if (Math.abs(deltaX) < 30) {
      return;
    }

    cycleSunglasses(deltaX < 0 ? 1 : -1);
  }

  function handleSkirtsSwipeStart(clientX: number) {
    skirtsSwipeStartX.current = clientX;
  }

  function handleSkirtsSwipeEnd(clientX: number) {
    if (skirtsSwipeStartX.current === null) {
      return;
    }

    const deltaX = clientX - skirtsSwipeStartX.current;
    skirtsSwipeStartX.current = null;

    if (Math.abs(deltaX) < 30) {
      return;
    }

    cycleSkirts(deltaX < 0 ? 1 : -1);
  }

  function handleHairSwipeStart(clientX: number) {
    hairSwipeStartX.current = clientX;
  }

  function handleHairSwipeEnd(clientX: number) {
    if (hairSwipeStartX.current === null) {
      return;
    }

    const deltaX = clientX - hairSwipeStartX.current;
    hairSwipeStartX.current = null;

    if (Math.abs(deltaX) < 30) {
      return;
    }

    cycleHair(deltaX < 0 ? 1 : -1);
  }

  function handleAccessoriesSwipeStart(clientX: number) {
    accessoriesSwipeStartX.current = clientX;
  }

  function handleAccessoriesSwipeEnd(clientX: number) {
    if (accessoriesSwipeStartX.current === null) {
      return;
    }

    const deltaX = clientX - accessoriesSwipeStartX.current;
    accessoriesSwipeStartX.current = null;

    if (Math.abs(deltaX) < 30) {
      return;
    }

    cycleAccessories(deltaX < 0 ? 1 : -1);
  }

  async function handleSave() {
    let ensuredTripMemberId = currentTripMemberId;

    if (supabase && tripDatabaseId && !ensuredTripMemberId) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (userId) {
        const { data: existingMember } = await supabase
          .from("trip_members")
          .select("id")
          .eq("trip_id", tripDatabaseId)
          .eq("user_id", userId)
          .maybeSingle();

        ensuredTripMemberId = existingMember?.id ?? null;

        if (!ensuredTripMemberId) {
          try {
            const savedProfile = window.localStorage.getItem(getAnonymousProfileKey(tripId));
            const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;
            const desiredNickname =
              parsedProfile &&
              typeof parsedProfile === "object" &&
              parsedProfile.userId === userId &&
              typeof parsedProfile.nickname === "string"
                ? parsedProfile.nickname.trim().slice(0, 8)
                : (config.label?.trim().slice(0, 8) ?? "");

            if (desiredNickname) {
              const { error: joinError } = await supabase.rpc("join_trip_by_slug", {
                target_trip_slug: tripId,
                desired_nickname: desiredNickname,
              });

              if (!joinError) {
                const { data: joinedMember } = await supabase
                  .from("trip_members")
                  .select("id")
                  .eq("trip_id", tripDatabaseId)
                  .eq("user_id", userId)
                  .maybeSingle();

                ensuredTripMemberId = joinedMember?.id ?? null;
              }
            }
          } catch {
            // Ignore local profile parsing issues and fall through to the shared account error.
          }
        }
      }
    }

    const nextConfig = {
      ...config,
      persisted: true,
      albumId: ensuredTripMemberId ?? selectedMember?.id ?? "",
      label: config.label?.trim() || selectedMember?.nickname || "My Coco",
      sunglassesImage: config.sunglassesImage ?? "",
      skirtImage: config.skirtImage ?? "",
      hairImage: config.hairImage ?? "",
      accessoryImage: "",
      accessoryTopImage: config.accessoryTopImage ?? "",
      accessoryBottomImage: config.accessoryBottomImage ?? "",
    };

    if (!supabase || !ensuredTripMemberId) {
      setStatus("We couldn't find your shared coco account yet. Please reopen the tree and try again.");
      return;
    }

    if (ensuredTripMemberId !== currentTripMemberId) {
      setCurrentTripMemberId(ensuredTripMemberId);
    }

    const { error } = await supabase.from("coconuts").upsert(
      {
        trip_member_id: ensuredTripMemberId,
        base_image: nextConfig.baseImage,
        accessories: nextConfig.accessories,
        label: nextConfig.label,
        colors: nextConfig.colors ?? {},
        metadata: {
          albumId: ensuredTripMemberId,
          sunglassesImage: nextConfig.sunglassesImage ?? "",
          skirtImage: nextConfig.skirtImage ?? "",
          hairImage: nextConfig.hairImage ?? "",
          accessoryTopImage: nextConfig.accessoryTopImage ?? "",
          accessoryBottomImage: nextConfig.accessoryBottomImage ?? "",
        },
      },
      { onConflict: "trip_member_id" },
    );

    setStatus(
      error
        ? "We couldn't save your coconut to the shared tree yet."
        : "Saved to the shared tree. Your coconut is ready.",
    );

    if (!error) {
      sessionStorage.setItem(`cocotree:last-planted-member:${tripId}`, ensuredTripMemberId);
      window.setTimeout(() => {
        router.push(`/trip/${tripId}`);
      }, 450);
    }
  }

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-5">
      <div className="py-1 text-center text-sm leading-6 text-[rgba(79,58,41,0.78)]">
        This coconut will be saved to your shared CocoTree profile and appear for everyone.
      </div>

      <label>
        <span className="mb-2 block text-sm font-bold text-[rgba(79,58,41,0.78)]">
          Nickname
        </span>
        <input
          value={config.label ?? ""}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              label: event.target.value.slice(0, 8),
            }))
          }
          maxLength={8}
          placeholder="My Coco"
          className="w-full rounded-none bg-white/45 px-4 py-3 outline-none backdrop-blur-[6px]"
        />
      </label>

      <div>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[rgba(79,58,41,0.66)]">
          {activePanel === "sunglasses"
            ? "Sunglasses"
            : activePanel === "skirts"
              ? "Skirts"
              : activePanel === "hair"
                ? "Hair"
              : activePanel === "accessories"
                ? "Accessories"
              : "Coconut bases"}
        </p>
        <div className="relative px-2 py-4">
          <button
            type="button"
            aria-label={
              activePanel === "sunglasses"
                ? "Previous sunglasses"
                : activePanel === "skirts"
                  ? "Previous skirt"
                  : activePanel === "hair"
                    ? "Previous hair"
                  : activePanel === "accessories"
                    ? "Previous accessory"
                  : "Previous coconut"
            }
            onClick={() =>
              activePanel === "sunglasses"
                ? cycleSunglasses(-1)
                : activePanel === "skirts"
                  ? cycleSkirts(-1)
                  : activePanel === "hair"
                    ? cycleHair(-1)
                  : activePanel === "accessories"
                    ? cycleAccessories(-1)
                  : cycleBase(-1)
            }
            className="absolute left-0 top-[46%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--cocoa-deep)]"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            aria-label={
              activePanel === "sunglasses"
                ? "Next sunglasses"
                : activePanel === "skirts"
                  ? "Next skirt"
                  : activePanel === "hair"
                    ? "Next hair"
                  : activePanel === "accessories"
                    ? "Next accessory"
                  : "Next coconut"
            }
            onClick={() =>
              activePanel === "sunglasses"
                ? cycleSunglasses(1)
                : activePanel === "skirts"
                  ? cycleSkirts(1)
                  : activePanel === "hair"
                    ? cycleHair(1)
                  : activePanel === "accessories"
                    ? cycleAccessories(1)
                  : cycleBase(1)
            }
            className="absolute right-0 top-[46%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--cocoa-deep)]"
          >
            <ChevronRight size={22} />
          </button>

          <div
            className="mx-auto flex min-h-[220px] w-full touch-pan-y items-center justify-center"
            onTouchStart={(event) =>
              activePanel === "sunglasses"
                ? handleSunglassesSwipeStart(event.touches[0].clientX)
                : activePanel === "skirts"
                  ? handleSkirtsSwipeStart(event.touches[0].clientX)
                  : activePanel === "hair"
                    ? handleHairSwipeStart(event.touches[0].clientX)
                  : activePanel === "accessories"
                    ? handleAccessoriesSwipeStart(event.touches[0].clientX)
                : handleBaseSwipeStart(event.touches[0].clientX)
            }
            onTouchEnd={(event) =>
              activePanel === "sunglasses"
                ? handleSunglassesSwipeEnd(event.changedTouches[0].clientX)
                : activePanel === "skirts"
                  ? handleSkirtsSwipeEnd(event.changedTouches[0].clientX)
                  : activePanel === "hair"
                    ? handleHairSwipeEnd(event.changedTouches[0].clientX)
                  : activePanel === "accessories"
                    ? handleAccessoriesSwipeEnd(event.changedTouches[0].clientX)
                : handleBaseSwipeEnd(event.changedTouches[0].clientX)
            }
            onMouseDown={(event) =>
              activePanel === "sunglasses"
                ? handleSunglassesSwipeStart(event.clientX)
                : activePanel === "skirts"
                  ? handleSkirtsSwipeStart(event.clientX)
                  : activePanel === "hair"
                    ? handleHairSwipeStart(event.clientX)
                  : activePanel === "accessories"
                    ? handleAccessoriesSwipeStart(event.clientX)
                : handleBaseSwipeStart(event.clientX)
            }
            onMouseUp={(event) =>
              activePanel === "sunglasses"
                ? handleSunglassesSwipeEnd(event.clientX)
                : activePanel === "skirts"
                  ? handleSkirtsSwipeEnd(event.clientX)
                  : activePanel === "hair"
                    ? handleHairSwipeEnd(event.clientX)
                  : activePanel === "accessories"
                    ? handleAccessoriesSwipeEnd(event.clientX)
                : handleBaseSwipeEnd(event.clientX)
            }
            onMouseLeave={() => {
              baseSwipeStartX.current = null;
              sunglassesSwipeStartX.current = null;
              skirtsSwipeStartX.current = null;
              hairSwipeStartX.current = null;
              accessoriesSwipeStartX.current = null;
            }}
          >
            <CoconutAvatar config={config} size={182} priority />
          </div>

          <div className={activePanel === "accessories" ? "mt-8" : "mt-8 flex items-center justify-center gap-3"}>
            {activePanel === "sunglasses"
              ? sunglassesOptions.map((image, index) => (
                  <button
                      key={image}
                      type="button"
                      aria-label={`Select sunglasses ${index + 1}`}
                    onClick={() =>
                      setConfig((current) => {
                        if (current.sunglassesImage === image) {
                          return {
                            ...current,
                            accessories: removeAccessoryFlag(current.accessories, "sunglasses"),
                            sunglassesImage: "",
                          };
                        }

                        return {
                          ...current,
                          accessories: current.accessories.includes("sunglasses")
                            ? current.accessories
                            : [...current.accessories, "sunglasses"],
                          sunglassesImage: image,
                        };
                      })
                    }
                      className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border transition ${
                        config.sunglassesImage === image
                          ? "border-[var(--leaf)] bg-white shadow-sm"
                          : "border-[rgba(95,54,34,0.14)] bg-white/70"
                      }`}
                    >
                      <img
                        src={image}
                        alt=""
                        className="h-7 w-9 object-contain"
                        draggable={false}
                    />
                  </button>
                ))
              : activePanel === "skirts"
                ? skirtOptions.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      aria-label={`Select skirt ${index + 1}`}
                      onClick={() =>
                        setConfig((current) => {
                          if (current.skirtImage === image) {
                            return {
                              ...current,
                              accessories: removeAccessoryFlag(current.accessories, "hulaSkirt"),
                              skirtImage: "",
                            };
                          }

                          return {
                            ...current,
                            accessories: current.accessories.includes("hulaSkirt")
                              ? current.accessories
                              : [...current.accessories, "hulaSkirt"],
                            skirtImage: image,
                          };
                        })
                      }
                      className={`flex h-16 w-16 items-center justify-center rounded-full border transition ${
                        config.skirtImage === image
                          ? "border-[var(--leaf)] bg-white shadow-sm"
                          : "border-[rgba(95,54,34,0.14)] bg-white/70"
                      }`}
                    >
                      <img
                        src={image}
                        alt=""
                        className="h-9 w-11 object-contain"
                        draggable={false}
                      />
                    </button>
                  ))
                : activePanel === "hair"
                  ? hairOptions.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        aria-label={`Select hair ${index + 1}`}
                        onClick={() =>
                          setConfig((current) => {
                            if (current.hairImage === image) {
                              return {
                                ...current,
                                accessories: removeAccessoryFlag(current.accessories, "hair"),
                                hairImage: "",
                              };
                            }

                            return {
                              ...current,
                              accessories: current.accessories.includes("hair")
                                ? current.accessories
                                : [...current.accessories, "hair"],
                              hairImage: image,
                            };
                          })
                        }
                        className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border transition ${
                          config.hairImage === image
                            ? "border-[var(--leaf)] bg-white shadow-sm"
                            : "border-[rgba(95,54,34,0.14)] bg-white/70"
                        }`}
                      >
                        <img
                          src={image}
                          alt=""
                          className="h-8 w-8 object-contain"
                          draggable={false}
                        />
                      </button>
                    ))
                : activePanel === "accessories"
                  ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="grid grid-cols-4 gap-3">
                        {accessoryTopOptions.map((image, index) => (
                          <button
                            key={image}
                            type="button"
                            aria-label={`Select accessory ${index + 1}`}
                            onClick={() =>
                              setConfig((current) => {
                                if (current.accessoryTopImage === image) {
                                  const nextTopImage = "";
                                  const hasBottomImage = Boolean(current.accessoryBottomImage);

                                  return {
                                    ...current,
                                    accessories: hasBottomImage
                                      ? current.accessories
                                      : removeAccessoryFlag(current.accessories, "ornament"),
                                    accessoryTopImage: nextTopImage,
                                  };
                                }

                                return {
                                  ...current,
                                  accessories: current.accessories.includes("ornament")
                                    ? current.accessories
                                    : [...current.accessories, "ornament"],
                                  accessoryTopImage: image,
                                };
                              })
                            }
                            className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border transition ${
                              config.accessoryTopImage === image
                                ? "border-[var(--leaf)] bg-white shadow-sm"
                                : "border-[rgba(95,54,34,0.14)] bg-white/70"
                            }`}
                          >
                            <img
                              src={image}
                              alt=""
                              className="h-8 w-8 object-contain"
                              draggable={false}
                            />
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {accessoryBottomOptions.map((image, index) => (
                          <button
                            key={image}
                            type="button"
                            aria-label={`Select accessory ${index + 5}`}
                            onClick={() =>
                              setConfig((current) => {
                                if (current.accessoryBottomImage === image) {
                                  const nextBottomImage = "";
                                  const hasTopImage = Boolean(current.accessoryTopImage);

                                  return {
                                    ...current,
                                    accessories: hasTopImage
                                      ? current.accessories
                                      : removeAccessoryFlag(current.accessories, "ornament"),
                                    accessoryBottomImage: nextBottomImage,
                                  };
                                }

                                return {
                                  ...current,
                                  accessories: current.accessories.includes("ornament")
                                    ? current.accessories
                                    : [...current.accessories, "ornament"],
                                  accessoryBottomImage: image,
                                };
                              })
                            }
                            className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border transition ${
                              config.accessoryBottomImage === image
                                ? "border-[var(--leaf)] bg-white shadow-sm"
                                : "border-[rgba(95,54,34,0.14)] bg-white/70"
                            }`}
                          >
                            <img
                              src={image}
                              alt=""
                              className="h-8 w-8 object-contain"
                              draggable={false}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
              : baseOptions.map((baseImage, index) => (
                  <button
                    key={baseImage}
                    type="button"
                    aria-label={`Select coconut ${index + 1}`}
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        baseImage,
                      }))
                    }
                    className={`flex h-16 w-16 items-center justify-center rounded-full border transition ${
                      config.baseImage === baseImage
                        ? "border-[var(--leaf)] bg-white shadow-sm"
                        : "border-[rgba(95,54,34,0.14)] bg-white/70"
                    }`}
                  >
                    <CoconutAvatar
                      config={{ ...config, baseImage, accessories: [] }}
                      size={46}
                    />
                  </button>
                ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {["sunglasses", "skirts", "accessories", "hair"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              if (item === "sunglasses") {
                if (activePanel === "sunglasses") {
                  setActivePanel("base");
                  return;
                }

                setActivePanel("sunglasses");
                setConfig((current) => ({
                  ...current,
                  accessories: current.accessories.includes("sunglasses")
                    ? current.accessories
                    : [...current.accessories, "sunglasses"],
                  sunglassesImage: current.sunglassesImage || sunglassesOptions[0],
                }));
                return;
              }

              if (item === "skirts") {
                if (activePanel === "skirts") {
                  setActivePanel("base");
                  return;
                }

                setActivePanel("skirts");
                setConfig((current) => ({
                  ...current,
                  accessories: current.accessories.includes("hulaSkirt")
                    ? current.accessories
                    : [...current.accessories, "hulaSkirt"],
                  skirtImage: current.skirtImage || skirtOptions[0],
                }));
                return;
              }

              if (item === "accessories") {
                if (activePanel === "accessories") {
                  setActivePanel("base");
                  return;
                }

                setActivePanel("accessories");
                setConfig((current) => ({
                  ...current,
                  accessories: current.accessories.includes("ornament")
                    ? current.accessories
                    : [...current.accessories, "ornament"],
                  accessoryTopImage: current.accessoryTopImage || accessoryTopOptions[0],
                  accessoryBottomImage:
                    current.accessoryBottomImage || accessoryBottomOptions[0],
                }));
                return;
              }

              if (item === "hair") {
                if (activePanel === "hair") {
                  setActivePanel("base");
                  return;
                }

                setActivePanel("hair");
                setConfig((current) => ({
                  ...current,
                  accessories: current.accessories.includes("hair")
                    ? current.accessories
                    : [...current.accessories, "hair"],
                  hairImage: current.hairImage || hairOptions[0],
                }));
                return;
              }

              setActivePanel("base");
            }}
            className={`rounded-full bg-white/38 px-3 py-2 text-[13px] font-bold text-[var(--cocoa-deep)] backdrop-blur-[6px] ${
              ((activePanel === "sunglasses" && item === "sunglasses") ||
                (activePanel === "skirts" && item === "skirts") ||
                (activePanel === "accessories" && item === "accessories") ||
                (activePanel === "hair" && item === "hair"))
                ? "ring-2 ring-[rgba(75,168,102,0.16)]"
                : ""
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--leaf)] px-6 py-3 font-bold text-white shadow-lg shadow-[rgba(75,168,102,0.28)]"
      >
        <Save size={18} />
        Save coconut
      </button>
      <p className="text-sm leading-6 text-[rgba(79,58,41,0.72)]">{status}</p>
    </div>
  );
}
