"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, 950);

    const routeTimer = window.setTimeout(() => {
      router.replace("/trip/demo-summer");
    }, 1380);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(routeTimer);
    };
  }, [router]);

  return (
    <main
      className={`flex min-h-[100svh] items-center justify-center bg-white px-6 transition-opacity duration-500 ${
        isLeaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <Image
          src="/assets/loading-coco.png"
          alt="CocoTree loading coconut"
          width={420}
          height={423}
          priority
          className="h-auto w-full max-w-[320px] animate-floaty object-contain"
        />
      </div>
    </main>
  );
}
