import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, MouseEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { CoconutAvatar } from "../components/CoconutAvatar";
import {
  createAlbumChatMessage,
  getAlbumChatMessages,
  type ChatMessage,
} from "../services/chatService";
import { createCoconut, deleteCoconut, getCoconuts } from "../services/coconutService";
import {
  createPhotoComment,
  getAnonymousClientId,
  getPhotoSocialState,
  togglePhotoLike,
} from "../services/photoInteractionService";
import {
  deleteAlbumPhoto,
  getAlbumPhotos,
  uploadAlbumPhoto,
  type AlbumPhoto,
} from "../services/photoService";
import type { CoconutConfig, SavedCoconut } from "../types/coconut";

type HomePageProps = {
  view: "loading" | "nickname" | "tree" | "customize" | "album";
  albumId: string | null;
  onEnterTree: () => void;
  onOpenCustomizer: () => void;
  onOpenAlbum: (albumId: string) => void;
  onBackToTree: () => void;
};

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

const SAVED_COCONUTS_STORAGE_KEY = "cocobrary-vite:saved-coconuts";
const MAX_TREE_COCONUTS = 9;

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

const startingCoconut: CoconutConfig = {
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
};

function withAccessory(
  accessories: CoconutConfig["accessories"],
  accessory: CoconutConfig["accessories"][number],
) {
  return accessories.includes(accessory) ? accessories : [...accessories, accessory];
}

function withoutAccessory(
  accessories: CoconutConfig["accessories"],
  accessory: CoconutConfig["accessories"][number],
) {
  return accessories.filter((item) => item !== accessory);
}

function readSavedCoconuts(): SavedCoconut[] {
  try {
    const savedValue = window.localStorage.getItem(SAVED_COCONUTS_STORAGE_KEY);
    const parsedValue = savedValue ? JSON.parse(savedValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (item): item is SavedCoconut =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.nickname === "string" &&
        typeof item.createdAt === "string" &&
        item.config &&
        typeof item.config === "object" &&
        typeof item.config.baseImage === "string" &&
        Array.isArray(item.config.accessories),
    ).slice(0, MAX_TREE_COCONUTS);
  } catch {
    return [];
  }
}

function writeSavedCoconuts(coconuts: SavedCoconut[]) {
  window.localStorage.setItem(
    SAVED_COCONUTS_STORAGE_KEY,
    JSON.stringify(coconuts.slice(0, MAX_TREE_COCONUTS)),
  );
}

export function HomePage({
  view,
  albumId,
  onEnterTree,
  onOpenCustomizer,
  onOpenAlbum,
  onBackToTree,
}: HomePageProps) {
  const [nickname, setNickname] = useState("My Coco");
  const [config, setConfig] = useState<CoconutConfig>(startingCoconut);
  const [savedCoconuts, setSavedCoconuts] = useState<SavedCoconut[]>([]);
  const [treeNotice, setTreeNotice] = useState("");

  async function refreshCoconuts(options: { fallbackToLocalStorage: boolean }) {
    try {
      const remoteCoconuts = await getCoconuts();

      setSavedCoconuts(remoteCoconuts.slice(0, MAX_TREE_COCONUTS));
      return remoteCoconuts;
    } catch (error) {
      console.error("Failed to load Supabase coconuts.", error);

      if (!options.fallbackToLocalStorage) {
        throw error;
      }

      console.error("Falling back to localStorage coconuts.", error);
      const loadedCoconuts = readSavedCoconuts();
      setSavedCoconuts(loadedCoconuts);
      writeSavedCoconuts(loadedCoconuts);
      return loadedCoconuts;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCoconuts() {
      try {
        const loadedCoconuts = await refreshCoconuts({ fallbackToLocalStorage: true });

        if (!isMounted) {
          return;
        }

        setSavedCoconuts(loadedCoconuts.slice(0, MAX_TREE_COCONUTS));
      } catch {
        // refreshCoconuts already logs and falls back during initial load.
      }
    }

    void loadCoconuts();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleOpenCustomizer() {
    if (savedCoconuts.length >= MAX_TREE_COCONUTS) {
      setTreeNotice("This tree already has 9 coconuts.");
      return;
    }

    setTreeNotice("");
    onOpenCustomizer();
  }

  async function handleSaveCoconut() {
    if (savedCoconuts.length >= MAX_TREE_COCONUTS) {
      setTreeNotice("This tree already has 9 coconuts.");
      onBackToTree();
      return false;
    }

    const trimmedNickname = (nickname || config.label || "My Coco").trim().slice(0, 8) || "My Coco";
    try {
      const savedCoconut = await createCoconut({
        nickname: trimmedNickname,
        config: {
          ...config,
          label: trimmedNickname,
        },
      });

      setNickname(trimmedNickname);
      setConfig(startingCoconut);
      console.log("Save coconut", savedCoconut);
      await refreshCoconuts({ fallbackToLocalStorage: false });
      onBackToTree();
      return true;
    } catch (error) {
      console.error("Failed to save coconut to Supabase.", error);
      window.alert("Failed to save coconut. Please try again.");
      return false;
    }
  }

  async function handleDeleteCoconut(coconutId: string) {
    const coconut = savedCoconuts.find((item) => item.id === coconutId);

    if (!coconut) {
      return;
    }

    const confirmed = window.confirm(`Delete ${coconut.nickname}'s coconut from the tree?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteCoconut(coconutId);
      await refreshCoconuts({ fallbackToLocalStorage: false });
      setTreeNotice("");
    } catch (error) {
      console.error("Failed to delete coconut from Supabase.", error);
      window.alert("Failed to delete coconut. Please try again.");
    }
  }

  if (view === "loading") {
    return <LoadingScreen />;
  }

  if (view === "nickname") {
    return (
      <NicknameScreen
        nickname={nickname}
        onNicknameChange={setNickname}
        onEnterTree={onEnterTree}
      />
    );
  }

  if (view === "tree") {
    return (
      <TreeScreen
        savedCoconuts={savedCoconuts}
        notice={treeNotice}
        onClearNotice={() => setTreeNotice("")}
        onDeleteCoconut={handleDeleteCoconut}
        onOpenAlbum={onOpenAlbum}
        onOpenCustomizer={handleOpenCustomizer}
      />
    );
  }

  if (view === "album") {
    return (
      <AlbumPage
        albumId={albumId}
        savedCoconuts={savedCoconuts}
        onBackToTree={onBackToTree}
      />
    );
  }

  return (
    <CustomizerScreen
      config={{ ...config, label: nickname }}
      onConfigChange={setConfig}
      onNicknameChange={setNickname}
      onSaveCoconut={handleSaveCoconut}
      onBackToTree={onBackToTree}
    />
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-white px-6">
      <img
        src="/assets/loading-coco.png"
        alt="CocoTree loading coconut"
        className="h-auto w-full max-w-[330px] object-contain"
        draggable={false}
      />
    </main>
  );
}

function NicknameScreen({
  nickname,
  onNicknameChange,
  onEnterTree,
}: {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onEnterTree: () => void;
}) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(180deg,#a6e3f1_0%,#dff5fb_100%)] px-7 py-10">
      <section className="w-full max-w-[415px] rounded-[32px] bg-[rgba(255,255,255,0.84)] px-7 py-9 text-[var(--cocoa-deep)] shadow-[0_24px_70px_rgba(79,58,41,0.10)] backdrop-blur-[18px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onEnterTree();
          }}
          className="space-y-6"
        >
          <div className="space-y-4 text-center">
            <h1 className="text-[30px] font-normal leading-none text-[#2f8b4e]">
              Pick Your Nickname
            </h1>
            <p className="text-[17px] leading-8 text-[rgba(79,58,41,0.66)]">
              You&apos;re signed in. One last step, and we&apos;ll give you your own
              coconut album.
            </p>
          </div>

          <label className="block pt-1 text-left">
            <span className="mb-3 block text-[17px] font-medium text-[rgba(79,58,41,0.72)]">
              Nickname
            </span>
            <input
              value={nickname}
              onChange={(event) => onNicknameChange(event.target.value.slice(0, 8))}
              maxLength={8}
              placeholder="My Coco"
              className="h-[60px] w-full rounded-full border border-[rgba(79,58,41,0.12)] bg-white/70 px-5 text-[20px] text-[rgba(79,58,41,0.82)] outline-none shadow-[inset_0_0_0_1px_rgba(79,58,41,0.05)] placeholder:text-[rgba(95,54,34,0.46)]"
            />
          </label>

          <button
            type="submit"
            className="h-[58px] w-full rounded-full bg-[#2f864b] px-5 text-[20px] font-normal text-white"
          >
            enter cocotree
          </button>
        </form>
      </section>
    </main>
  );
}

function TreeScreen({
  savedCoconuts,
  notice,
  onClearNotice,
  onDeleteCoconut,
  onOpenAlbum,
  onOpenCustomizer,
}: {
  savedCoconuts: SavedCoconut[];
  notice: string;
  onClearNotice: () => void;
  onDeleteCoconut: (coconutId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onOpenCustomizer: () => void;
}) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function clearClickTimer() {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }

  function openDeletePopover(coconutId: string) {
    clearLongPressTimer();
    clearClickTimer();
    suppressNextClickRef.current = true;
    onClearNotice();
    setDeleteTargetId(coconutId);
  }

  function handlePointerDown(coconutId: string) {
    return (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse") {
        return;
      }

      clearLongPressTimer();
      suppressNextClickRef.current = false;
      longPressTimerRef.current = window.setTimeout(() => {
        openDeletePopover(coconutId);
      }, 650);
    };
  }

  function handlePointerEnd() {
    clearLongPressTimer();
  }

  function handleCoconutClick(coconut: SavedCoconut) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    setDeleteTargetId(null);
    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      onClearNotice();
      onOpenAlbum(coconut.config.albumId ?? coconut.id);
      clickTimerRef.current = null;
    }, 220);
  }

  function handleContextMenu(event: MouseEvent, coconutId: string) {
    event.preventDefault();
    openDeletePopover(coconutId);
  }

  function handleDoubleClick(event: MouseEvent, coconutId: string) {
    event.preventDefault();
    openDeletePopover(coconutId);
  }

  function handleDeleteClick(coconutId: string) {
    setDeleteTargetId(null);
    onDeleteCoconut(coconutId);
  }

  function closeDeletePopover() {
    clearLongPressTimer();
    clearClickTimer();
    suppressNextClickRef.current = false;
    setDeleteTargetId(null);
  }

  return (
    <section
      className="relative h-[100svh] w-full overflow-hidden bg-[#bfe7f8]"
      onClick={() => {
        if (deleteTargetId) {
          closeDeletePopover();
        }
      }}
    >
      <img
        src="/assets/coconut-tree.png"
        alt="CocoTree coconut tree"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "50% 48%" }}
        draggable={false}
      />

      {savedCoconuts.map((coconut, index) => {
        const position = TREE_SLOT_POSITIONS[index];

        return (
          <div
            key={coconut.id}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 animate-coconut-pop"
            style={position}
          >
            <div className="pointer-events-none absolute left-1/2 top-[-16px] h-4 w-px -translate-x-1/2 bg-[rgba(78,55,33,0.22)]" />
            <div className="pointer-events-none absolute left-1/2 top-[-20px] h-2 w-2 -translate-x-1/2 rounded-full border border-[rgba(78,55,33,0.26)] bg-[rgba(255,255,255,0.72)]" />
            <button
              type="button"
              className="relative block"
              aria-label={`${coconut.nickname} coconut`}
              onClick={(event) => {
                event.stopPropagation();
                handleCoconutClick(coconut);
              }}
              onContextMenu={(event) => handleContextMenu(event, coconut.id)}
              onDoubleClick={(event) => handleDoubleClick(event, coconut.id)}
              onPointerCancel={handlePointerEnd}
              onPointerDown={handlePointerDown(coconut.id)}
              onPointerLeave={handlePointerEnd}
              onPointerUp={handlePointerEnd}
            >
              <CoconutAvatar
                config={{
                  ...coconut.config,
                  label: coconut.nickname,
                  accessories: withAccessory(coconut.config.accessories, "nameLabel"),
                }}
                size={86}
              />
            </button>
            {deleteTargetId === coconut.id ? (
              <div className="tree-delete-popover">
                <button
                  type="button"
                  className="tree-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteClick(coconut.id);
                  }}
                >
                  <Trash2 size={14} />
                  delete
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {notice ? (
        <div className="absolute left-1/2 top-6 z-30 w-[min(330px,calc(100vw-40px))] -translate-x-1/2 rounded-[24px] bg-white/82 px-5 py-4 text-center text-sm font-bold leading-6 text-[var(--cocoa-deep)] shadow-[0_16px_38px_rgba(62,41,28,0.14)] backdrop-blur-md">
          {notice}
        </div>
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          closeDeletePopover();
          onOpenCustomizer();
        }}
        aria-label="Add my coconut"
        className="absolute bottom-9 right-7 z-20 flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/75 text-[var(--cocoa-deep)] shadow-[0_18px_42px_rgba(62,41,28,0.12)] backdrop-blur-[8px] transition hover:scale-105"
      >
        <Plus size={36} strokeWidth={1.8} />
      </button>
    </section>
  );
}

function formatPhotoTimestamp(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sanitizeDownloadSegment(value: string) {
  const sanitizedValue = value
    .trim()
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return sanitizedValue || "coconut";
}

function formatDownloadDate(value: string) {
  const date = new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, "0");
  const day = String(validDate.getDate()).padStart(2, "0");
  const hour = String(validDate.getHours()).padStart(2, "0");
  const minute = String(validDate.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}`;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("jpeg")) {
    return "jpg";
  }

  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("gif")) {
    return "gif";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "";
}

function extensionFromImageUrl(imageUrl: string) {
  const dataUrlMimeType = imageUrl.match(/^data:([^;,]+)/)?.[1];
  const dataUrlExtension = dataUrlMimeType ? extensionFromMimeType(dataUrlMimeType) : "";

  if (dataUrlExtension) {
    return dataUrlExtension;
  }

  try {
    const parsedUrl = new URL(imageUrl, window.location.href);
    const extension = parsedUrl.pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1];

    if (extension) {
      return extension.toLowerCase();
    }
  } catch {
    // Fall back to the default below for unusual but still renderable image URLs.
  }

  return "";
}

function createPhotoDownloadName(albumNickname: string, photo: AlbumPhoto, index: number) {
  const safeNickname = sanitizeDownloadSegment(albumNickname);
  const dateSegment = formatDownloadDate(photo.createdAt);
  const indexSegment = String(index + 1).padStart(2, "0");
  const urlExtension = extensionFromImageUrl(photo.imageUrl);

  return `${safeNickname}-${dateSegment}-${indexSegment}.${urlExtension || "png"}`;
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  return isIosDevice && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome/i.test(userAgent);
}

function openImageInNewTab(imageUrl: string, targetWindow: Window | null) {
  console.log("[album download] opening image tab", { imageUrl });

  if (targetWindow) {
    targetWindow.location.href = imageUrl;
    return true;
  }

  const openedWindow = window.open(imageUrl, "_blank", "noopener,noreferrer");
  return Boolean(openedWindow);
}

async function downloadImageUrl(
  imageUrl: string,
  fileName: string,
  targetWindow: Window | null,
) {
  console.log("[album download] image src", imageUrl);
  console.log("[album download] fetch start", imageUrl);
  const response = await fetch(imageUrl);
  console.log("[album download] fetch result", {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}.`);
  }

  const blob = await response.blob();
  const blobExtension = extensionFromMimeType(blob.type);
  const normalizedFileName =
    blobExtension && fileName.endsWith(".png")
      ? fileName.replace(/\.png$/, `.${blobExtension}`)
      : fileName;
  const objectUrl = URL.createObjectURL(blob);

  if (isIosSafari()) {
    const opened = openImageInNewTab(objectUrl, targetWindow);

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    if (!opened) {
      throw new Error("Safari blocked the image tab.");
    }

    return;
  }

  try {
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = normalizedFileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    console.log("[album download] anchor click", {
      href: objectUrl,
      download: normalizedFileName,
    });
    anchor.click();
    anchor.remove();
  } catch (error) {
    console.error("[album download] anchor download failed", error);

    const opened = openImageInNewTab(objectUrl, targetWindow);

    if (!opened) {
      throw error;
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

function AlbumPage({
  albumId,
  savedCoconuts,
  onBackToTree,
}: {
  albumId: string | null;
  savedCoconuts: SavedCoconut[];
  onBackToTree: () => void;
}) {
  const coconut = savedCoconuts.find(
    (item) => item.id === albumId || item.config.albumId === albumId,
  );
  const resolvedAlbumId = coconut?.config.albumId ?? coconut?.id ?? albumId ?? "";
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshAlbumPhotos() {
    const loadedPhotos = await getAlbumPhotos(resolvedAlbumId);
    const clientId = getAnonymousClientId();
    const socialState = await getPhotoSocialState(
      loadedPhotos.map((photo) => photo.id),
      clientId,
    );

    const photosWithSocialState = loadedPhotos.map((photo) => ({
      ...photo,
      comments: socialState[photo.id]?.comments ?? [],
      likes: socialState[photo.id]?.likes ?? 0,
      liked: socialState[photo.id]?.liked ?? false,
    }));

    setPhotos(photosWithSocialState);
    return photosWithSocialState;
  }

  async function refreshAlbumChat() {
    const loadedMessages = await getAlbumChatMessages(resolvedAlbumId);

    setChatMessages(loadedMessages);
    return loadedMessages;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAlbumData() {
      try {
        const [loadedPhotos, loadedMessages] = await Promise.all([
          getAlbumPhotos(resolvedAlbumId),
          getAlbumChatMessages(resolvedAlbumId),
        ]);
        const clientId = getAnonymousClientId();
        const socialState = await getPhotoSocialState(
          loadedPhotos.map((photo) => photo.id),
          clientId,
        );

        if (!isMounted) {
          return;
        }

        setPhotos(
          loadedPhotos.map((photo) => ({
            ...photo,
            comments: socialState[photo.id]?.comments ?? [],
            likes: socialState[photo.id]?.likes ?? 0,
            liked: socialState[photo.id]?.liked ?? false,
          })),
        );
        setChatMessages(loadedMessages);
      } catch (error) {
        console.error("Failed to load album data from Supabase.", error);

        if (isMounted) {
          window.alert("Failed to load album data. Please try again.");
          setPhotos([]);
          setChatMessages([]);
        }
      }
    }

    if (!resolvedAlbumId) {
      setPhotos([]);
      setChatMessages([]);
      return () => {
        isMounted = false;
      };
    }

    void loadAlbumData();
    setSelectedIds([]);
    setActivePhotoIndex(null);
    setIsCommentPanelOpen(false);

    return () => {
      isMounted = false;
    };
  }, [resolvedAlbumId]);

  if (!coconut) {
    return (
      <main className="min-h-[100svh] px-4 pt-5 text-[var(--ink)]">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <button
            type="button"
            onClick={onBackToTree}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[var(--cocoa-deep)]"
          >
            <ChevronLeft size={16} />
            back to tree
          </button>
          <section className="scrap-card px-5 py-10 text-center text-sm text-[rgba(79,58,41,0.72)]">
            This coconut album could not be found.
          </section>
        </div>
      </main>
    );
  }

  const activePhoto = activePhotoIndex === null ? null : photos[activePhotoIndex];
  const activePhotoNumber = activePhotoIndex === null ? 0 : activePhotoIndex + 1;
  const activePhotoComments = activePhoto?.comments ?? [];
  const selectedPhotos = photos.filter((photo) => selectedIds.includes(photo.id));

  function toggleSelecting() {
    setIsSelecting((current) => {
      if (current) {
        setSelectedIds([]);
      }

      return !current;
    });
  }

  function toggleSelected(photoId: string) {
    setSelectedIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : current.length >= 30
          ? current
          : [...current, photoId],
    );
  }

  async function downloadPhotos(items: AlbumPhoto[], source: string) {
    console.log("[album download] click", {
      source,
      count: items.length,
      albumId: resolvedAlbumId,
    });

    if (items.length === 0) {
      window.alert("No photos selected to download.");
      return;
    }

    const failures: Array<{ photo: AlbumPhoto; error: unknown }> = [];
    const shouldOpenImageTabs = isIosSafari();
    const firstImageWindow =
      shouldOpenImageTabs && items.length >= 1
        ? window.open("", "_blank", "noopener,noreferrer")
        : null;

    for (const [index, photo] of items.entries()) {
      try {
        console.log("[album download] photo", {
          source,
          index,
          photoId: photo.id,
          src: photo.imageUrl,
        });
        await downloadImageUrl(
          photo.imageUrl,
          createPhotoDownloadName(coconut?.nickname ?? "coconut", photo, index),
          index === 0 ? firstImageWindow : null,
        );
      } catch (error) {
        console.error("Failed to download album photo", {
          albumId: resolvedAlbumId,
          source,
          photoId: photo.id,
          imageUrl: photo.imageUrl,
          error,
        });
        failures.push({ photo, error });
      }
    }

    if (failures.length > 0) {
      window.alert(
        failures.length === items.length
          ? "Photo download failed. Please try again."
          : "Some photos could not be downloaded. Please try again.",
      );
      return;
    }

    if (shouldOpenImageTabs) {
      window.alert("이미지를 길게 눌러 사진에 저장하세요.");
    }
  }

  async function deletePhotos(photoIds: string[]) {
    const photosToDelete = photos.filter((photo) => photoIds.includes(photo.id));

    if (photosToDelete.length === 0) {
      return;
    }

    try {
      await Promise.all(photosToDelete.map((photo) => deleteAlbumPhoto(photo)));
    } catch (error) {
      console.error("Failed to delete album photo from Supabase.", error);
      window.alert("Failed to delete photo. Please try again.");
      return;
    }

    const photoIdSet = new Set(photoIds);
    setPhotos((current) => current.filter((photo) => !photoIdSet.has(photo.id)));
    setSelectedIds((current) => current.filter((id) => !photoIdSet.has(id)));
    if (activePhoto && photoIdSet.has(activePhoto.id)) {
      setActivePhotoIndex(null);
      setIsCommentPanelOpen(false);
    }
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      await Promise.all(files.map((file) => uploadAlbumPhoto(resolvedAlbumId, file)));
      await refreshAlbumPhotos();
      event.target.value = "";
    } catch (error) {
      console.error("Failed to upload album photo to Supabase.", error);
      window.alert("Failed to upload photo. Please try again.");
      event.target.value = "";
    }
  }

  async function toggleLike(photoId: string) {
    try {
      await togglePhotoLike(photoId, getAnonymousClientId());
      await refreshAlbumPhotos();
    } catch (error) {
      console.error("Failed to toggle photo like in Supabase.", error);
      window.alert("Failed to update like. Please try again.");
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activePhoto || !commentDraft.trim()) {
      return;
    }

    const nextComment = commentDraft.trim().slice(0, 180);

    try {
      await createPhotoComment(activePhoto.id, nextComment);
      await refreshAlbumPhotos();
      setCommentDraft("");
    } catch (error) {
      console.error("Failed to create photo comment in Supabase.", error);
      window.alert("Failed to send comment. Please try again.");
    }
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!chatDraft.trim()) {
      return;
    }

    try {
      await createAlbumChatMessage(resolvedAlbumId, chatDraft.trim().slice(0, 240));
      await refreshAlbumChat();
      setChatDraft("");
    } catch (error) {
      console.error("Failed to create album chat message in Supabase.", error);
      window.alert("Failed to send chat message. Please try again.");
    }
  }

  return (
    <main className="album-page">
      <header className="album-header">
        <button type="button" onClick={onBackToTree} className="album-pill-button">
          <ChevronLeft size={18} />
          back to tree
        </button>
        <button type="button" onClick={toggleSelecting} className="album-pill-button album-select-button">
          {isSelecting ? "done" : "select"}
        </button>
      </header>

      <h1 className="album-title">{coconut.nickname}&apos;s library</h1>

      {isSelecting ? (
        <section className="album-select-panel">
          <p className="album-select-count">{selectedIds.length}/30 selected</p>
          <div className="album-select-actions">
            <button
              type="button"
              onClick={() => void downloadPhotos(selectedPhotos, "selected")}
              disabled={selectedPhotos.length === 0}
              className="album-action-button album-action-button--coral"
            >
              <Download size={19} />
              Download selected
            </button>
            <button
              type="button"
              onClick={() => void downloadPhotos(photos, "all")}
              disabled={photos.length === 0}
              className="album-action-button album-action-button--white"
            >
              <ImageIcon size={19} />
              Download all
            </button>
            <button
              type="button"
              onClick={() => deletePhotos(selectedIds)}
              disabled={selectedIds.length === 0}
              className="album-delete-button"
              aria-label="Delete selected photos"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </section>
      ) : null}

      <section className="album-grid" aria-label={`${coconut.nickname} photo grid`}>
        {photos.map((photo, index) => {
          const isSelected = selectedIds.includes(photo.id);

          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => {
                if (isSelecting) {
                  toggleSelected(photo.id);
                  return;
                }

                setActivePhotoIndex(index);
              }}
              className={`album-thumb ${isSelected ? "album-thumb--selected" : ""}`}
            >
              <img src={photo.imageUrl} alt={photo.caption} draggable={false} />
              {isSelecting ? (
                <span className={`album-check ${isSelected ? "album-check--selected" : ""}`}>
                  <Check size={18} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </section>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => uploadInputRef.current?.click()}
        className="album-fab album-fab--upload"
        aria-label={`Add something to ${coconut.nickname}'s album`}
      >
        <span className="album-plus-icon" aria-hidden="true">
          <Plus size={16} strokeWidth={2.1} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="album-fab album-fab--chat"
        aria-label={`Open anonymous chat for ${coconut.nickname}`}
      >
        <MessageCircle size={28} strokeWidth={2.1} />
      </button>

      {activePhoto ? (
        <section className="album-viewer" aria-label="Photo viewer">
          <button
            type="button"
            className="album-viewer-close"
            onClick={() => {
              setActivePhotoIndex(null);
              setIsCommentPanelOpen(false);
              setCommentDraft("");
            }}
            aria-label="Close photo viewer"
          >
            <X size={30} />
          </button>

          <div className="album-viewer-image-wrap">
            <img src={activePhoto.imageUrl} alt={activePhoto.caption} draggable={false} />
          </div>

          <div className="album-viewer-side-actions">
            <button
              type="button"
              onClick={() => void downloadPhotos([activePhoto], "viewer")}
              className="album-viewer-round-button"
              aria-label="Download photo"
            >
              <Download size={25} />
            </button>
            <button
              type="button"
              onClick={() => deletePhotos([activePhoto.id])}
              className="album-viewer-round-button"
              aria-label="Delete photo"
            >
              <Trash2 size={25} />
            </button>
          </div>

          {isCommentPanelOpen ? (
            <section className="album-comment-panel">
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {activePhotoComments.length === 0 ? (
                  <p>No anonymous comments yet.</p>
                ) : (
                  activePhotoComments.map((comment, index) => (
                    <article key={`${comment}-${index}`} className="album-comment-bubble">
                      {comment}
                    </article>
                  ))
                )}
              </div>
              <form onSubmit={handleCommentSubmit} className="mt-3">
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value.slice(0, 180))}
                  placeholder="Leave an anonymous comment..."
                  rows={2}
                  className="album-comment-input"
                />
                <div className="mt-2 flex justify-end">
                  <button type="submit" disabled={!commentDraft.trim()} className="album-comment-send">
                    send
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <div className="album-viewer-social">
            <button
              type="button"
              onClick={() => setIsCommentPanelOpen((current) => !current)}
              className="album-viewer-social-button"
            >
              <MessageCircle size={28} />
              <span>{activePhotoComments.length}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleLike(activePhoto.id)}
              className="album-viewer-social-button"
            >
              <Heart size={28} fill={activePhoto.liked ? "currentColor" : "none"} />
              <span>{activePhoto.likes}</span>
            </button>
          </div>

          <div className="album-viewer-meta">
            <p>{formatPhotoTimestamp(activePhoto.createdAt)}</p>
            <span>
              {activePhotoNumber} / {photos.length}
            </span>
          </div>
        </section>
      ) : null}

      {isChatOpen ? (
        <section className="album-chat-overlay" aria-label="Anonymous chat">
          <button
            type="button"
            className="album-chat-backdrop"
            aria-label="Close anonymous chat"
            onClick={() => setIsChatOpen(false)}
          />
          <div className="album-chat-sheet">
            <div className="album-chat-handle" />
            <div className="album-chat-heading">
              <div>
                <h2>Anonymous chat</h2>
                <p>Leave a note for {coconut.nickname}&apos;s album.</p>
              </div>
              <button type="button" onClick={() => setIsChatOpen(false)} aria-label="Close chat">
                <X size={23} />
              </button>
            </div>

            <div className="album-chat-messages">
              {chatMessages.length === 0 ? (
                <p>No anonymous notes yet. Start the first little message.</p>
              ) : (
                chatMessages.map((message) => (
                  <article key={message.id} className="album-chat-message">
                    {message.body}
                  </article>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="album-chat-form">
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value.slice(0, 240))}
                placeholder="Leave an anonymous note..."
                rows={3}
              />
              <div className="album-chat-footer">
                <span>Anonymous only · up to 240 characters</span>
                <button type="submit" disabled={!chatDraft.trim()}>
                  <Send size={21} />
                  Send
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function CustomizerScreen({
  config,
  onConfigChange,
  onNicknameChange,
  onSaveCoconut,
  onBackToTree,
}: {
  config: CoconutConfig;
  onConfigChange: (config: CoconutConfig) => void;
  onNicknameChange: (value: string) => void;
  onSaveCoconut: () => Promise<boolean>;
  onBackToTree: () => void;
}) {
  const [activePanel, setActivePanel] = useState<CustomizerPanel>("base");
  const [status, setStatus] = useState("Your coconut will be saved to the shared tree.");
  const currentBaseIndex = Math.max(0, baseOptions.indexOf(config.baseImage));
  const panelTitle =
    activePanel === "sunglasses"
      ? "Sunglasses"
      : activePanel === "skirts"
        ? "Skirts"
        : activePanel === "accessories"
          ? "Accessories"
          : activePanel === "hair"
            ? "Hair"
            : "Coconut bases";

  function selectBase(baseImage: string) {
    onConfigChange({
      ...config,
      baseImage,
    });
  }

  function cycleBase(direction: -1 | 1) {
    const nextIndex =
      (currentBaseIndex + direction + baseOptions.length) % baseOptions.length;
    selectBase(baseOptions[nextIndex]);
  }

  function selectSunglasses(image: string) {
    if (config.sunglassesImage === image) {
      onConfigChange({
        ...config,
        accessories: withoutAccessory(config.accessories, "sunglasses"),
        sunglassesImage: "",
      });
      return;
    }

    onConfigChange({
      ...config,
      accessories: withAccessory(config.accessories, "sunglasses"),
      sunglassesImage: image,
    });
  }

  function selectSkirt(image: string) {
    if (config.skirtImage === image) {
      onConfigChange({
        ...config,
        accessories: withoutAccessory(config.accessories, "hulaSkirt"),
        skirtImage: "",
      });
      return;
    }

    onConfigChange({
      ...config,
      accessories: withAccessory(config.accessories, "hulaSkirt"),
      skirtImage: image,
    });
  }

  function selectHair(image: string) {
    if (config.hairImage === image) {
      onConfigChange({
        ...config,
        accessories: withoutAccessory(config.accessories, "hair"),
        hairImage: "",
      });
      return;
    }

    onConfigChange({
      ...config,
      accessories: withAccessory(config.accessories, "hair"),
      hairImage: image,
    });
  }

  function selectTopAccessory(image: string) {
    const isRemoving = config.accessoryTopImage === image;
    const nextTopImage = isRemoving ? "" : image;
    const hasAnyAccessory = Boolean(nextTopImage || config.accessoryBottomImage);

    onConfigChange({
      ...config,
      accessories: hasAnyAccessory
        ? withAccessory(config.accessories, "ornament")
        : withoutAccessory(config.accessories, "ornament"),
      accessoryTopImage: nextTopImage,
    });
  }

  function selectBottomAccessory(image: string) {
    const isRemoving = config.accessoryBottomImage === image;
    const nextBottomImage = isRemoving ? "" : image;
    const hasAnyAccessory = Boolean(config.accessoryTopImage || nextBottomImage);

    onConfigChange({
      ...config,
      accessories: hasAnyAccessory
        ? withAccessory(config.accessories, "ornament")
        : withoutAccessory(config.accessories, "ornament"),
      accessoryBottomImage: nextBottomImage,
    });
  }

  function openPanel(panel: CustomizerPanel) {
    if (activePanel === panel) {
      setActivePanel("base");
      return;
    }

    setActivePanel(panel);

    if (panel === "sunglasses" && !config.sunglassesImage) {
      selectSunglasses(sunglassesOptions[0]);
    }

    if (panel === "skirts" && !config.skirtImage) {
      selectSkirt(skirtOptions[0]);
    }

    if (panel === "accessories" && !config.accessoryTopImage && !config.accessoryBottomImage) {
      onConfigChange({
        ...config,
        accessories: withAccessory(config.accessories, "ornament"),
        accessoryTopImage: accessoryTopOptions[0],
        accessoryBottomImage: accessoryBottomOptions[0],
      });
    }

    if (panel === "hair" && !config.hairImage) {
      selectHair(hairOptions[0]);
    }
  }

  function renderOptions() {
    if (activePanel === "sunglasses") {
      return (
        <div className="customizer-options-row">
          {sunglassesOptions.map((image, index) => (
            <button
              key={image}
              type="button"
              aria-label={`Select sunglasses ${index + 1}`}
              onClick={() => selectSunglasses(image)}
              className={`customizer-option-button customizer-option-button--small ${
                config.sunglassesImage === image ? "customizer-option-button--active" : ""
              }`}
            >
              <img src={image} alt="" className="h-8 w-11 object-contain" draggable={false} />
            </button>
          ))}
        </div>
      );
    }

    if (activePanel === "skirts") {
      return (
        <div className="customizer-options-row customizer-options-row--wide">
          {skirtOptions.map((image, index) => (
            <button
              key={image}
              type="button"
              aria-label={`Select skirt ${index + 1}`}
              onClick={() => selectSkirt(image)}
              className={`customizer-option-button customizer-option-button--large ${
                config.skirtImage === image ? "customizer-option-button--active" : ""
              }`}
            >
              <img src={image} alt="" className="h-11 w-14 object-contain" draggable={false} />
            </button>
          ))}
        </div>
      );
    }

    if (activePanel === "accessories") {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="customizer-options-row customizer-options-row--accessories-top">
            {accessoryTopOptions.map((image, index) => (
              <button
                key={image}
                type="button"
                aria-label={`Select accessory ${index + 1}`}
                onClick={() => selectTopAccessory(image)}
                className={`customizer-option-button customizer-option-button--medium ${
                  config.accessoryTopImage === image ? "customizer-option-button--active" : ""
                }`}
              >
                <img src={image} alt="" className="h-10 w-10 object-contain" draggable={false} />
              </button>
            ))}
          </div>
          <div className="customizer-options-row customizer-options-row--accessories-bottom">
            {accessoryBottomOptions.map((image, index) => (
              <button
                key={image}
                type="button"
                aria-label={`Select accessory ${index + 5}`}
                onClick={() => selectBottomAccessory(image)}
                className={`customizer-option-button customizer-option-button--medium ${
                  config.accessoryBottomImage === image ? "customizer-option-button--active" : ""
                }`}
              >
                <img src={image} alt="" className="h-10 w-10 object-contain" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activePanel === "hair") {
      return (
        <div className="customizer-options-row customizer-options-row--hair">
          {hairOptions.map((image, index) => (
            <button
              key={image}
              type="button"
              aria-label={`Select hair ${index + 1}`}
              onClick={() => selectHair(image)}
              className={`customizer-option-button customizer-option-button--medium ${
                config.hairImage === image ? "customizer-option-button--active" : ""
              }`}
            >
              <img src={image} alt="" className="h-12 w-12 object-contain" draggable={false} />
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="customizer-options-row customizer-options-row--wide">
        {baseOptions.map((baseImage, index) => (
          <button
            key={baseImage}
            type="button"
            aria-label={`Select coconut ${index + 1}`}
            onClick={() => selectBase(baseImage)}
            className={`customizer-option-button customizer-option-button--large ${
              config.baseImage === baseImage ? "customizer-option-button--active" : ""
            }`}
          >
            <CoconutAvatar config={{ ...config, baseImage, accessories: [] }} size={52} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[linear-gradient(180deg,#a6e3f1_0%,#dff5fb_100%)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-5">
        <button
          type="button"
          onClick={onBackToTree}
          className="inline-flex w-fit items-center gap-3 rounded-full bg-white/72 px-6 py-3 text-[18px] font-bold text-[var(--cocoa-deep)] shadow-[0_12px_34px_rgba(79,58,41,0.06)] backdrop-blur-[10px]"
        >
          <ChevronLeft size={22} />
          Back to tree
        </button>

        <p className="pt-5 text-center text-[17px] leading-8 text-[rgba(79,58,41,0.68)]">
          This coconut will be saved to your shared CocoTree profile and appear for
          everyone.
        </p>

        <label className="block">
          <span className="mb-4 block text-[18px] font-bold text-[rgba(79,58,41,0.68)]">
            Nickname
          </span>
          <input
            value={config.label ?? ""}
            onChange={(event) => onNicknameChange(event.target.value.slice(0, 8))}
            maxLength={8}
            placeholder="My Coco"
            className="h-[58px] w-full rounded-none border-0 bg-white/45 px-5 text-[20px] text-[var(--ink)] outline-none backdrop-blur-[6px]"
          />
        </label>

        <section>
          <p className="mb-5 text-[19px] font-bold uppercase tracking-[0.18em] text-[rgba(79,58,41,0.58)]">
            {panelTitle}
          </p>

          <div className="relative px-1 py-2">
            <button
              type="button"
              aria-label="Previous coconut"
              onClick={() => cycleBase(-1)}
              className="absolute left-2 top-[47%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--cocoa-deep)]"
            >
              <ChevronLeft size={28} />
            </button>

            <button
              type="button"
              aria-label="Next coconut"
              onClick={() => cycleBase(1)}
              className="absolute right-2 top-[47%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--cocoa-deep)]"
            >
              <ChevronRight size={28} />
            </button>

            <div className="mx-auto flex min-h-[300px] w-full items-center justify-center">
              <CoconutAvatar config={config} size={236} />
            </div>

            <div className="mt-8">{renderOptions()}</div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 pt-2">
          {(["sunglasses", "skirts", "accessories", "hair"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => openPanel(item)}
              className={`h-[56px] rounded-full bg-white/44 px-4 text-[20px] font-normal text-[var(--cocoa-deep)] backdrop-blur-[8px] ${
                activePanel === item
                  ? "ring-2 ring-[rgba(89,166,100,0.20)]"
                  : ""
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={async () => {
            const saved = await onSaveCoconut();

            if (!saved) {
              setStatus("This tree is full. Delete a coconut before adding another.");
            }
          }}
          className="mt-2 inline-flex h-[58px] items-center justify-center gap-3 rounded-full bg-[#65ad6d] px-6 text-[19px] font-normal text-white shadow-[0_12px_28px_rgba(75,168,102,0.22)]"
        >
          <Save size={21} />
          Save coconut
        </button>

        <p className="pb-8 text-[17px] leading-8 text-[rgba(79,58,41,0.62)]">
          {status}
        </p>
      </div>
    </main>
  );
}
