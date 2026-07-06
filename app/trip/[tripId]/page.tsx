import { CoconutTreeStage } from "@/components/coconut-tree-stage";
import { TripAccessGate } from "@/components/trip-access-gate";
import { getTripData } from "@/lib/data";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTripData(tripId);

  return (
    <TripAccessGate tripSlug={tripId} initialTripDatabaseId={trip.databaseId}>
      <CoconutTreeStage trip={trip} />
    </TripAccessGate>
  );
}
