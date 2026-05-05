"use client";

import { useEffect, useState } from "react";

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

function shouldPlayHeroVideo(): boolean {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrowScreen = window.matchMedia("(max-width: 767px)").matches;
  const connection = (navigator as NavigatorWithConnection).connection;
  const constrainedConnection = Boolean(
    connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? ""),
  );

  return !reducedMotion && !constrainedConnection && !(coarsePointer && narrowScreen);
}

export function HeroBackdrop() {
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlayVideo(shouldPlayHeroVideo()));

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPlayVideo(shouldPlayHeroVideo());
    media.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0" aria-hidden data-testid="hero-backdrop">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.08),transparent_30%),linear-gradient(145deg,#171717_0%,#050505_48%,#000_100%)]" />
      {playVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="h-full w-full object-cover object-top opacity-95"
          src={HERO_VIDEO}
          data-testid="hero-video"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.75)_100%),linear-gradient(to_bottom,transparent_60%,#000_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black" />
    </div>
  );
}
