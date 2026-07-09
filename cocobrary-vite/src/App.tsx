import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";

type AppView = "loading" | "nickname" | "tree" | "customize" | "album";

function getAlbumIdFromPath() {
  const match = window.location.pathname.match(/^\/album\/([^/]+)$/);

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [view, setView] = useState<AppView>("loading");
  const [albumId, setAlbumId] = useState<string | null>(getAlbumIdFromPath);

  useEffect(() => {
    function syncRoute() {
      const nextAlbumId = getAlbumIdFromPath();

      setAlbumId(nextAlbumId);
      setView(nextAlbumId ? "album" : "tree");
    }

    window.addEventListener("popstate", syncRoute);

    const timer = window.setTimeout(() => {
      const nextAlbumId = getAlbumIdFromPath();

      setAlbumId(nextAlbumId);
      setView(nextAlbumId ? "album" : "nickname");
    }, 900);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  function goToTree() {
    window.history.pushState(null, "", "/");
    setAlbumId(null);
    setView("tree");
  }

  function openAlbum(nextAlbumId: string) {
    window.history.pushState(null, "", `/album/${encodeURIComponent(nextAlbumId)}`);
    setAlbumId(nextAlbumId);
    setView("album");
  }

  return (
    <HomePage
      view={view}
      albumId={albumId}
      onEnterTree={goToTree}
      onOpenCustomizer={() => setView("customize")}
      onOpenAlbum={openAlbum}
      onBackToTree={goToTree}
    />
  );
}
