import AlbumPageClient from "@/app/trip/[tripId]/album/[memberId]/album-page-client";
import { TripAccessGate } from "@/components/trip-access-gate";
import { getTripData } from "@/lib/data";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ tripId: string; memberId: string }>;
}) {
  const { tripId, memberId } = await params;
  const trip = await getTripData(tripId);

  return (
    <TripAccessGate tripSlug={tripId} initialTripDatabaseId={trip.databaseId}>
      <AlbumPageClient trip={trip} memberId={memberId} />
    </TripAccessGate>
  );
}
