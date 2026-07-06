import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CoconutCustomizer } from "@/components/coconut-customizer";
import { TripAccessGate } from "@/components/trip-access-gate";
import { getTripData } from "@/lib/data";

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTripData(tripId);

  return (
    <TripAccessGate tripSlug={tripId} initialTripDatabaseId={trip.databaseId}>
      <main>
        <div className="mx-auto flex w-full max-w-md px-4 pt-4">
          <Link
            href={`/trip/${tripId}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)]"
          >
            <ChevronLeft size={16} />
            Back to tree
          </Link>
        </div>
        <CoconutCustomizer tripId={trip.id} members={trip.members} />
      </main>
    </TripAccessGate>
  );
}
