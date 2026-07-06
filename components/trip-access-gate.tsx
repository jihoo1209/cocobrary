"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type TripAccessGateProps = {
  tripSlug: string;
  initialTripDatabaseId?: string;
  children: React.ReactNode;
};

type GateState = "loading" | "needs-login" | "needs-join" | "missing-trip" | "ready";

function isUuidLike(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function getAnonymousProfileKey(tripSlug: string) {
  return `cocotree:${tripSlug}:anonymous-profile`;
}

export function TripAccessGate({
  tripSlug,
  initialTripDatabaseId,
  children,
}: TripAccessGateProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const hasTriggeredRefreshRef = useRef(false);
  const [gateState, setGateState] = useState<GateState>(supabase ? "loading" : "ready");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("");
  const [resolvedTripDatabaseId, setResolvedTripDatabaseId] = useState<string | null>(
    isUuidLike(initialTripDatabaseId) ? initialTripDatabaseId ?? null : null,
  );
  const [hasResolvedTripLookup, setHasResolvedTripLookup] = useState(
    Boolean(isUuidLike(initialTripDatabaseId)),
  );
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoJoinAttemptedRef = useRef(false);
  const autoSessionAttemptedRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setGateState("ready");
      return;
    }

    const client = supabase;

    let isCancelled = false;

    async function loadSession() {
      const {
        data: { session },
      } = await client.auth.getSession();

      if (isCancelled) {
        return;
      }

      setSessionUserId(session?.user?.id ?? null);

      if (session?.user?.id) {
        try {
          const savedProfile = window.localStorage.getItem(getAnonymousProfileKey(tripSlug));
          const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;

          if (
            parsedProfile &&
            typeof parsedProfile === "object" &&
            parsedProfile.userId === session.user.id &&
            typeof parsedProfile.nickname === "string"
          ) {
            setNickname((current) => current || parsedProfile.nickname || "");
          }
        } catch {
          // Ignore malformed local profile cache.
        }
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);

      if (session?.user?.id) {
        try {
          const savedProfile = window.localStorage.getItem(getAnonymousProfileKey(tripSlug));
          const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;

          if (
            parsedProfile &&
            typeof parsedProfile === "object" &&
            parsedProfile.userId === session.user.id &&
            typeof parsedProfile.nickname === "string"
          ) {
            setNickname((current) => current || parsedProfile.nickname || "");
          }
        } catch {
          // Ignore malformed local profile cache.
        }
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setHasResolvedTripLookup(true);
      return;
    }

    const client = supabase;

    let isCancelled = false;
    setHasResolvedTripLookup(Boolean(isUuidLike(initialTripDatabaseId)));

    async function resolveTrip() {
      const { data: tripIdFromRpc } = await client.rpc("resolve_trip_id_by_slug", {
        target_trip_slug: tripSlug,
      });

      if (!isCancelled) {
        setResolvedTripDatabaseId(
          typeof tripIdFromRpc === "string"
            ? tripIdFromRpc
            : isUuidLike(initialTripDatabaseId)
              ? initialTripDatabaseId ?? null
              : null,
        );
        setHasResolvedTripLookup(true);
      }
    }

    void resolveTrip();

    return () => {
      isCancelled = true;
    };
  }, [supabase, tripSlug, initialTripDatabaseId]);

  useEffect(() => {
    if (!supabase || !hasResolvedTripLookup || sessionUserId || isSubmitting) {
      return;
    }

    if (resolvedTripDatabaseId === null && hasResolvedTripLookup) {
      return;
    }

    if (autoSessionAttemptedRef.current) {
      return;
    }

    autoSessionAttemptedRef.current = true;
    setIsSubmitting(true);
    setStatus("");

    void supabase.auth.signInAnonymously().then(({ error }) => {
      setIsSubmitting(false);

      if (error) {
        setStatus(`We couldn't start your coco session yet: ${error.message}`);
        autoSessionAttemptedRef.current = false;
        return;
      }

      setStatus("");
    });
  }, [supabase, hasResolvedTripLookup, resolvedTripDatabaseId, sessionUserId, isSubmitting]);

  useEffect(() => {
    if (!supabase) {
      setGateState("ready");
      return;
    }

    if (!hasResolvedTripLookup) {
      setGateState("loading");
      return;
    }

    if (!sessionUserId) {
      setGateState("needs-login");
      return;
    }

    if (!resolvedTripDatabaseId) {
      setGateState("missing-trip");
      return;
    }

    let isCancelled = false;
    const client = supabase;

    async function resolveMembership() {
      const { data: memberRow } = await client
        .from("trip_members")
        .select("id, nickname")
        .eq("trip_id", resolvedTripDatabaseId)
        .eq("user_id", sessionUserId)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      if (memberRow) {
        setNickname((current) => current || memberRow.nickname || "");
        setGateState("ready");

        if (
          !hasTriggeredRefreshRef.current &&
          resolvedTripDatabaseId &&
          resolvedTripDatabaseId !== initialTripDatabaseId
        ) {
          hasTriggeredRefreshRef.current = true;
          router.refresh();
        }

        return;
      }

      try {
        const savedProfile = window.localStorage.getItem(getAnonymousProfileKey(tripSlug));
        const parsedProfile = savedProfile ? JSON.parse(savedProfile) : null;

        if (
          !autoJoinAttemptedRef.current &&
          parsedProfile &&
          typeof parsedProfile === "object" &&
          parsedProfile.userId === sessionUserId &&
          typeof parsedProfile.nickname === "string" &&
          parsedProfile.nickname.trim()
        ) {
          autoJoinAttemptedRef.current = true;

          const { error } = await client.rpc("join_trip_by_slug", {
            target_trip_slug: tripSlug,
            desired_nickname: parsedProfile.nickname.trim().slice(0, 8),
          });

          if (!error && !isCancelled) {
            setNickname(parsedProfile.nickname.trim().slice(0, 8));
            setGateState("ready");
            router.refresh();
            return;
          }
        }
      } catch {
        // Ignore malformed local profile cache.
      }

      setGateState("needs-join");
    }

    void resolveMembership();

    return () => {
      isCancelled = true;
    };
  }, [
    supabase,
    resolvedTripDatabaseId,
    sessionUserId,
    initialTripDatabaseId,
    hasResolvedTripLookup,
    router,
    tripSlug,
  ]);

  async function handleStartAnonymous() {
    if (!supabase) {
      setStatus("Supabase isn't connected yet on this device.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    const { error } = await supabase.auth.signInAnonymously();

    setIsSubmitting(false);
    setStatus(
      error
        ? `We couldn't start your coco session yet: ${error.message}`
        : "Your coco session is ready. One more nickname step and you'll be in.",
    );

    if (!error) {
      autoSessionAttemptedRef.current = true;
    }
  }

  async function handleJoinTrip() {
    if (!supabase || !sessionUserId) {
      return;
    }

    const trimmedNickname = nickname.trim().slice(0, 8);

    if (!trimmedNickname) {
      setStatus("Please choose a nickname first.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    const { error } = await supabase.rpc("join_trip_by_slug", {
      target_trip_slug: tripSlug,
      desired_nickname: trimmedNickname,
    });

    if (error) {
      setIsSubmitting(false);
      setStatus("We couldn't join this CocoTree yet. Please make sure the new trip member policy is applied in Supabase.");
      return;
    }

    try {
      window.localStorage.setItem(
        getAnonymousProfileKey(tripSlug),
        JSON.stringify({
          userId: sessionUserId,
          nickname: trimmedNickname,
        }),
      );
    } catch {
      // Ignore storage failures; server join already succeeded.
    }

    setGateState("ready");
    setIsSubmitting(false);
    hasTriggeredRefreshRef.current = true;
    router.refresh();
  }

  if (gateState === "ready") {
    return <>{children}</>;
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6 py-10">
      <section className="w-full max-w-sm rounded-[28px] bg-white/78 px-6 py-7 text-[var(--cocoa-deep)] shadow-[0_18px_48px_rgba(79,58,41,0.12)] backdrop-blur-[18px]">
        {gateState === "loading" ? (
          <div className="space-y-3 text-center">
            <p className="text-[26px] font-normal leading-none text-[var(--leaf-deep)]">
              CocoTree
            </p>
            <p className="text-sm leading-6 text-[rgba(79,58,41,0.72)]">
              We&apos;re getting your tree ready.
            </p>
          </div>
        ) : gateState === "missing-trip" ? (
          <div className="space-y-3 text-center">
            <p className="text-[26px] font-normal leading-none text-[var(--leaf-deep)]">
              CocoTree
            </p>
            <p className="text-sm leading-6 text-[rgba(79,58,41,0.72)]">
              We couldn&apos;t find this shared album yet. Once the Supabase trip data is created, this link will open normally.
            </p>
          </div>
        ) : gateState === "needs-login" ? (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <p className="text-[26px] font-normal leading-none text-[var(--leaf-deep)]">
                Join This CocoTree
              </p>
              <p className="text-sm leading-6 text-[rgba(79,58,41,0.72)]">
                We&apos;re trying to start your anonymous coco session automatically. If it takes too long, you can start it yourself below.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartAnonymous}
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--leaf-deep)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? "starting..." : "start anonymously"}
            </button>

            {status ? (
              <p className="text-center text-sm leading-6 text-[rgba(79,58,41,0.72)]">
                {status}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <p className="text-[26px] font-normal leading-none text-[var(--leaf-deep)]">
                Pick Your Nickname
              </p>
              <p className="text-sm leading-6 text-[rgba(79,58,41,0.72)]">
                You&apos;re signed in. One last step, and we&apos;ll give you your own coconut album.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[rgba(79,58,41,0.78)]">
                Nickname
              </span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value.slice(0, 8))}
                maxLength={8}
                placeholder="My Coco"
                className="w-full rounded-full bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-[rgba(79,58,41,0.12)]"
              />
            </label>

            <button
              type="button"
              onClick={handleJoinTrip}
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--leaf-deep)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? "joining..." : "enter cocotree"}
            </button>

            {status ? (
              <p className="text-center text-sm leading-6 text-[rgba(79,58,41,0.72)]">
                {status}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
