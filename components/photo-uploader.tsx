"use client";

import { ChangeEvent, useState } from "react";
import { UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlbumPhoto, TripMember } from "@/lib/types";

type PhotoUploaderProps = {
  tripId: string;
  tripDatabaseId?: string;
  members: TripMember[];
  defaultTargetMemberId?: string;
  onAddMockPhotos?: (photos: AlbumPhoto[]) => void;
};

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read file."));
    };

    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function PhotoUploader({
  tripId,
  tripDatabaseId,
  members,
  defaultTargetMemberId,
  onAddMockPhotos,
}: PhotoUploaderProps) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState(
    "Uploads will fall back to local preview mode until Supabase is configured.",
  );

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const targets =
      selectedMemberIds.length > 0
        ? selectedMemberIds
        : defaultTargetMemberId
          ? [defaultTargetMemberId]
          : members.map((member) => member.id);
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      const mockPhotos = await Promise.all(
        files.map(async (file, index) => ({
          id: `${file.name}-${index}-${Date.now()}`,
          tripId,
          uploaderName: "You",
          caption: caption || file.name,
          createdAt: new Date().toISOString(),
          imageUrl: await fileToDataUrl(file),
          targets: targets.map((memberId) => ({ memberId })),
        })),
      );

      onAddMockPhotos?.(mockPhotos);
      setStatus("Added local preview uploads. Connect Supabase to persist them.");
      event.target.value = "";
      return;
    }

    for (const file of files) {
      const path = `${tripDatabaseId ?? tripId}/anonymous/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("trip-photos")
        .upload(path, file, { upsert: false });

      if (storageError) {
        setStatus("Storage upload failed. Check your bucket and RLS policies.");
        continue;
      }

      const { data: photoRow, error: photoError } = await supabase
        .from("photos")
        .insert({
          trip_id: tripDatabaseId ?? tripId,
          caption: caption || file.name,
          storage_path: path,
        })
        .select("id")
        .single();

      if (photoError) {
        setStatus("Photo metadata insert failed. Check the SQL schema and auth flow.");
        continue;
      }

      const { error: targetError } = await supabase.from("photo_targets").insert(
        targets.map((memberId) => ({
          photo_id: photoRow.id,
          trip_member_id: memberId,
        })),
      );

      setStatus(
        targetError
          ? "Photo uploaded, but tagging failed. Check the photo_targets policy."
          : "Upload finished in Supabase. Add a refresh or realtime next.",
      );
    }

    event.target.value = "";
  }

  return (
    <section className="scrap-card px-4 py-5">
      <p className="font-[var(--font-display)] text-2xl leading-none text-[var(--leaf-deep)]">
        Upload beach memories
      </p>
      <p className="mt-2 text-sm leading-6 text-[rgba(79,58,41,0.72)]">
        One photo can be tagged to multiple friends, so each coconut album collects
        the right memories automatically.
      </p>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-bold text-[rgba(79,58,41,0.78)]">
          Caption
        </span>
        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Sunset snorkel squad"
          className="w-full rounded-2xl border border-[rgba(95,54,34,0.16)] bg-white/80 px-4 py-3 outline-none"
        />
      </label>

      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-[rgba(79,58,41,0.78)]">
          Who appears in this photo?
        </p>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const active = selectedMemberIds.includes(member.id);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMember(member.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  active
                    ? "bg-[var(--leaf)] text-white"
                    : "bg-white/80 text-[rgba(79,58,41,0.78)]"
                }`}
              >
                {member.nickname}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-[rgba(95,54,34,0.18)] bg-white/55 px-4 py-6 text-center">
        <UploadCloud size={22} className="text-[var(--leaf-deep)]" />
        <span className="text-sm font-bold text-[rgba(79,58,41,0.8)]">
          Tap to upload photos
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      <p className="mt-3 text-sm leading-6 text-[rgba(79,58,41,0.72)]">{status}</p>
    </section>
  );
}
