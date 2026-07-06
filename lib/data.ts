import { demoTrip } from "@/lib/mock-data";
import { Trip, TripMember } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeTrip(tripId: string): Trip {
  if (tripId === demoTrip.id) {
    return demoTrip;
  }

  return {
    ...demoTrip,
    id: tripId,
    databaseId: tripId,
    name: "CocoTree Vacation",
  };
}

export async function getTripData(tripId: string): Promise<Trip> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return normalizeTrip(tripId);
  }

  const { data: tripRow } = await supabase
    .from("trips")
    .select("id, name, slug, location, starts_at, ends_at, description")
    .eq("slug", tripId)
    .maybeSingle();

  if (!tripRow) {
    return normalizeTrip(tripId);
  }

  const [{ data: memberRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("trip_members")
      .select(
        "id, nickname, profile_note, coconut_x, coconut_y, coconuts(base_image, accessories, label, colors)",
      )
      .eq("trip_id", tripRow.id),
    supabase
      .from("photos")
      .select(
        "id, trip_id, caption, created_at, storage_path, uploader:trip_members!uploader_member_id(nickname), photo_targets(trip_member_id)",
      )
      .eq("trip_id", tripRow.id)
      .order("created_at", { ascending: false }),
  ]);

  const members: TripMember[] =
    memberRows?.map((row) => {
      const coconutRow = Array.isArray(row.coconuts) ? row.coconuts[0] : row.coconuts;

      return {
        id: row.id,
        nickname: row.nickname,
        bio: row.profile_note ?? undefined,
        position: {
          x: row.coconut_x ?? 50,
          y: row.coconut_y ?? 40,
        },
        coconut: {
          baseImage: coconutRow?.base_image ?? "/assets/coconut-01.png",
          accessories: coconutRow?.accessories ?? [],
          label: coconutRow?.label ?? row.nickname,
          colors: coconutRow?.colors ?? {},
        },
      };
    }) ?? demoTrip.members;

  const signedPaths = photoRows?.map((row) => row.storage_path).filter(Boolean) ?? [];
  const signedUrlMap = new Map<string, string>();

  if (signedPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("trip-photos")
      .createSignedUrls(signedPaths, 60 * 60);

    signedUrls?.forEach((item, index) => {
      if (item?.signedUrl) {
        signedUrlMap.set(signedPaths[index], item.signedUrl);
      }
    });
  }

  return {
    id: tripRow.slug,
    databaseId: tripRow.id,
    name: tripRow.name,
    location: tripRow.location ?? "Summer trip",
    dates: `${tripRow.starts_at ?? ""} to ${tripRow.ends_at ?? ""}`,
    description: tripRow.description ?? demoTrip.description,
    members,
    photos:
      photoRows?.map((row) => {
        const uploader = row.uploader as
          | { nickname?: string }
          | { nickname?: string }[]
          | null;
        const photoTargets = row.photo_targets as { trip_member_id: string }[] | null;

        return {
          id: row.id,
          tripId: row.trip_id,
          uploaderName:
            (Array.isArray(uploader) ? uploader[0]?.nickname : uploader?.nickname) ?? "Friend",
          caption: row.caption ?? "",
          createdAt: row.created_at,
          imageUrl: signedUrlMap.get(row.storage_path) ?? demoTrip.photos[0].imageUrl,
          targets: photoTargets?.map((target) => ({ memberId: target.trip_member_id })) ?? [],
        };
      }) ?? demoTrip.photos,
  };
}

export async function getTripMember(tripId: string, memberId: string) {
  const trip = await getTripData(tripId);
  const member = trip.members.find((item) => item.id === memberId) ?? trip.members[0];

  return { trip, member };
}
