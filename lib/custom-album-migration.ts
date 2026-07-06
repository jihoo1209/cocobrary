import { AlbumPhoto, CoconutConfig } from "@/lib/types";

function createAlbumId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `album-${crypto.randomUUID()}`;
  }

  return `album-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupePhotosById(items: AlbumPhoto[]) {
  const seen = new Set<string>();

  return items.filter((photo) => {
    if (seen.has(photo.id)) {
      return false;
    }

    seen.add(photo.id);
    return true;
  });
}

function mergeAnonymousChat(currentValue: string | null, legacyValue: string | null) {
  const currentItems = currentValue ? JSON.parse(currentValue) : [];
  const legacyItems = legacyValue ? JSON.parse(legacyValue) : [];

  if (!Array.isArray(currentItems) && !Array.isArray(legacyItems)) {
    return [];
  }

  const safeCurrentItems = Array.isArray(currentItems) ? currentItems : [];
  const safeLegacyItems = Array.isArray(legacyItems) ? legacyItems : [];
  const seen = new Set<string>();

  return [...safeCurrentItems, ...safeLegacyItems].filter((item) => {
    const key = item?.id ?? JSON.stringify(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeObjectStorage(currentValue: string | null, legacyValue: string | null) {
  const currentObject =
    currentValue && typeof JSON.parse(currentValue) === "object"
      ? JSON.parse(currentValue)
      : {};
  const legacyObject =
    legacyValue && typeof JSON.parse(legacyValue) === "object"
      ? JSON.parse(legacyValue)
      : {};

  return {
    ...(legacyObject && typeof legacyObject === "object" ? legacyObject : {}),
    ...(currentObject && typeof currentObject === "object" ? currentObject : {}),
  };
}

export function migrateLegacyAlbumStorage(
  tripId: string,
  legacyMemberId: string,
  albumId: string,
) {
  if (legacyMemberId === albumId) {
    return;
  }

  try {
    const savedPhotos = window.localStorage.getItem(`cocotree:${tripId}:local-photos`);
    const parsedPhotos = savedPhotos ? JSON.parse(savedPhotos) : [];

    if (Array.isArray(parsedPhotos)) {
      const migratedPhotos = parsedPhotos.map((photo) => {
        if (!Array.isArray(photo?.targets)) {
          return photo;
        }

        return {
          ...photo,
          targets: photo.targets.map((target: { memberId?: string }) =>
            target.memberId === legacyMemberId
              ? { ...target, memberId: albumId }
              : target,
          ),
        };
      });

      window.localStorage.setItem(
        `cocotree:${tripId}:local-photos`,
        JSON.stringify(dedupePhotosById(migratedPhotos)),
      );
    }
  } catch {
    // Keep migration resilient even if old photo data is malformed.
  }

  try {
    const legacyChatKey = `cocotree:${tripId}:album-chat:${legacyMemberId}`;
    const albumChatKey = `cocotree:${tripId}:album-chat:${albumId}`;
    const mergedChat = mergeAnonymousChat(
      window.localStorage.getItem(albumChatKey),
      window.localStorage.getItem(legacyChatKey),
    );

    if (mergedChat.length > 0) {
      window.localStorage.setItem(albumChatKey, JSON.stringify(mergedChat));
    }
    window.localStorage.removeItem(legacyChatKey);
  } catch {
    // Keep migration resilient even if chat data is malformed.
  }

  try {
    const legacyLikesKey = `cocotree:${tripId}:${legacyMemberId}:photo-likes`;
    const albumLikesKey = `cocotree:${tripId}:${albumId}:photo-likes`;
    const mergedLikes = mergeObjectStorage(
      window.localStorage.getItem(albumLikesKey),
      window.localStorage.getItem(legacyLikesKey),
    );

    window.localStorage.setItem(albumLikesKey, JSON.stringify(mergedLikes));
    window.localStorage.removeItem(legacyLikesKey);
  } catch {
    // Keep migration resilient even if likes data is malformed.
  }

  try {
    const legacyCommentsKey = `cocotree:${tripId}:${legacyMemberId}:photo-comments`;
    const albumCommentsKey = `cocotree:${tripId}:${albumId}:photo-comments`;
    const mergedComments = mergeObjectStorage(
      window.localStorage.getItem(albumCommentsKey),
      window.localStorage.getItem(legacyCommentsKey),
    );

    window.localStorage.setItem(albumCommentsKey, JSON.stringify(mergedComments));
    window.localStorage.removeItem(legacyCommentsKey);
  } catch {
    // Keep migration resilient even if comments data is malformed.
  }
}

export function migrateTreeToAlbumIds(tripId: string, tree: CoconutConfig[]) {
  let changed = false;

  const migratedTree = tree.map((coconut, index) => {
    const albumId = coconut.albumId ?? createAlbumId();

    if (!coconut.albumId) {
      changed = true;
    }

    migrateLegacyAlbumStorage(tripId, `custom-${index + 1}`, albumId);

    return coconut.albumId ? coconut : { ...coconut, albumId };
  });

  return { migratedTree, changed };
}
