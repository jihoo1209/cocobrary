import { assertSupabaseClient } from "../lib/supabaseClient";
import type { CoconutConfig, SavedCoconut } from "../types/coconut";

type CoconutRow = {
  id: string;
  nickname: string;
  config: CoconutConfig;
  slot_index: number;
  created_at: string;
};

function mapCoconutRow(row: CoconutRow): SavedCoconut {
  return {
    id: row.id,
    nickname: row.nickname,
    createdAt: row.created_at,
    config: {
      ...row.config,
      albumId: row.config.albumId ?? row.id,
      label: row.config.label ?? row.nickname,
      persisted: true,
    },
  };
}

function createCoconutId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  throw new Error("This browser cannot create a coconut id.");
}

function findAvailableSlot(rows: Array<Pick<CoconutRow, "slot_index">>) {
  const occupiedSlots = new Set(rows.map((row) => row.slot_index));

  for (let slotIndex = 0; slotIndex < 9; slotIndex += 1) {
    if (!occupiedSlots.has(slotIndex)) {
      return slotIndex;
    }
  }

  return null;
}

export async function getCoconuts(): Promise<SavedCoconut[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("coconuts")
    .select("id,nickname,config,slot_index,created_at")
    .order("slot_index", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CoconutRow[]).map(mapCoconutRow);
}

export async function createCoconut(input: {
  nickname: string;
  config: CoconutConfig;
}): Promise<SavedCoconut> {
  const client = assertSupabaseClient();
  const { data: existingRows, error: existingRowsError } = await client
    .from("coconuts")
    .select("slot_index");

  if (existingRowsError) {
    throw existingRowsError;
  }

  const slotIndex = findAvailableSlot((existingRows ?? []) as Array<Pick<CoconutRow, "slot_index">>);

  if (slotIndex === null) {
    throw new Error("This tree already has 9 coconuts.");
  }

  const coconutId = createCoconutId();
  const config: CoconutConfig = {
    ...input.config,
    albumId: coconutId,
    label: input.nickname,
    persisted: true,
  };
  const { data, error } = await client
    .from("coconuts")
    .insert({
      id: coconutId,
      nickname: input.nickname,
      config,
      slot_index: slotIndex,
    })
    .select("id,nickname,config,slot_index,created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapCoconutRow(data as CoconutRow);
}

export async function deleteCoconut(coconutId: string): Promise<void> {
  const client = assertSupabaseClient();
  const { error } = await client.from("coconuts").delete().eq("id", coconutId);

  if (error) {
    throw error;
  }
}
