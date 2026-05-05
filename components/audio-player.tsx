"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AudioUrlResponse, PlaybackPosition } from "@/lib/types";

export interface ChapterMark {
  idx: number;
  title: string;
  startSeconds: number;
}

interface Props {
  src: string;
  expiresAt?: string | null;
  refreshUrl?: string;
  playbackPositionUrl?: string;
  localStorageKey?: string;
  durationSeconds?: number | null;
  chapters?: ChapterMark[];
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isAudioUrlResponse(value: unknown): value is AudioUrlResponse {
  const data = value as Partial<AudioUrlResponse>;
  return typeof data.audioUrl === "string" && typeof data.expiresAt === "string";
}

function isPlaybackPosition(value: unknown): value is PlaybackPosition {
  const data = value as Partial<PlaybackPosition>;
  return typeof data.positionSeconds === "number";
}

export function AudioPlayer({
  src,
  expiresAt,
  refreshUrl,
  playbackPositionUrl,
  localStorageKey,
  durationSeconds,
  chapters,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isRefreshingRef = useRef(false);
  const lastPersistedAtRef = useRef(0);
  const hasRestoredPositionRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingAutoplayRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState(1);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [currentExpiresAt, setCurrentExpiresAt] = useState(expiresAt ?? null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const applyPendingSeek = useCallback(() => {
    const audio = audioRef.current;
    const pendingSeek = pendingSeekRef.current;
    if (!audio || pendingSeek === null || audio.readyState < 1) return;

    pendingSeekRef.current = null;
    const maxTime = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.max(0, audio.duration - 1)
      : pendingSeek;
    audio.currentTime = Math.max(0, Math.min(pendingSeek, maxTime));
    setCurrentTime(audio.currentTime);

    const shouldPlay = pendingAutoplayRef.current;
    pendingAutoplayRef.current = false;
    if (shouldPlay) {
      void audio.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, []);

  const queueSeek = useCallback((seconds: number, shouldPlay = false) => {
    if (!Number.isFinite(seconds) || seconds <= 2) return;
    pendingSeekRef.current = seconds;
    pendingAutoplayRef.current = shouldPlay;
    applyPendingSeek();
  }, [applyPendingSeek]);

  const persistPlaybackPosition = useCallback(async (seconds?: number) => {
    const audio = audioRef.current;
    const positionSeconds = Math.max(0, Math.round(seconds ?? audio?.currentTime ?? currentTime));
    if (!Number.isFinite(positionSeconds) || positionSeconds < 2) return;

    const rawDuration = audio && Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : duration || durationSeconds || null;
    const durationValue = rawDuration == null ? null : Math.round(rawDuration);

    if (playbackPositionUrl) {
      try {
        await fetch(playbackPositionUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionSeconds,
            durationSeconds: durationValue,
          }),
          keepalive: true,
        });
      } catch {
        // Resume state is useful, but playback should never fail because it
        // could not be persisted.
      }
      return;
    }

    if (!localStorageKey) return;
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify({
        positionSeconds,
        durationSeconds: durationValue,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      // Ignore unavailable storage in private/restricted browsing modes.
    }
  }, [currentTime, duration, durationSeconds, localStorageKey, playbackPositionUrl]);

  const refreshAudioUrl = useCallback(async (options?: { resumeAt?: number; shouldPlay?: boolean }) => {
    if (!refreshUrl || isRefreshingRef.current) return false;

    const audio = audioRef.current;
    const resumeAt = options?.resumeAt ?? audio?.currentTime ?? currentTime;
    const shouldPlay = options?.shouldPlay ?? Boolean(audio && !audio.paused && !audio.ended);
    isRefreshingRef.current = true;

    try {
      const response = await fetch(refreshUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Audio refresh failed");
      const data: unknown = await response.json();
      if (!isAudioUrlResponse(data)) throw new Error("Invalid audio refresh response");

      pendingSeekRef.current = resumeAt;
      pendingAutoplayRef.current = shouldPlay;
      setCurrentExpiresAt(data.expiresAt);
      setCurrentSrc(data.audioUrl);
      setPlaybackError(null);
      return true;
    } catch {
      audio?.pause();
      setPlaying(false);
      setPlaybackError("Playback needs a refresh. Retry to resume from the same spot.");
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [currentTime, refreshUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const now = Date.now();
      if (now - lastPersistedAtRef.current > 10000) {
        lastPersistedAtRef.current = now;
        void persistPlaybackPosition(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      void persistPlaybackPosition(audio.currentTime);
    };
    const onLoadedMetadata = () => applyPendingSeek();
    const onError = () => {
      if (refreshUrl) {
        void refreshAudioUrl({ resumeAt: audio.currentTime, shouldPlay: !audio.paused && !audio.ended });
      } else {
        setPlaybackError("Playback could not start. Try reloading this page.");
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
    };
  }, [applyPendingSeek, persistPlaybackPosition, refreshAudioUrl, refreshUrl]);

  useEffect(() => {
    applyPendingSeek();
  }, [applyPendingSeek, currentSrc]);

  useEffect(() => {
    if (!currentExpiresAt || !refreshUrl) return;
    const refreshInMs = Date.parse(currentExpiresAt) - Date.now() - 90_000;
    const timer = window.setTimeout(() => {
      void refreshAudioUrl();
    }, Math.max(5000, refreshInMs));

    return () => window.clearTimeout(timer);
  }, [currentExpiresAt, refreshAudioUrl, refreshUrl]);

  useEffect(() => {
    if (hasRestoredPositionRef.current) return;
    hasRestoredPositionRef.current = true;

    async function restorePosition() {
      if (playbackPositionUrl) {
        try {
          const response = await fetch(playbackPositionUrl, { cache: "no-store" });
          if (!response.ok) return;
          const data: unknown = await response.json();
          if (isPlaybackPosition(data)) queueSeek(data.positionSeconds);
        } catch {
          // Resume is best-effort.
        }
        return;
      }

      if (!localStorageKey) return;
      try {
        const raw = window.localStorage.getItem(localStorageKey);
        if (!raw) return;
        const data: unknown = JSON.parse(raw);
        if (isPlaybackPosition(data)) queueSeek(data.positionSeconds);
      } catch {
        // Ignore malformed or unavailable local resume state.
      }
    }

    void restorePosition();
  }, [localStorageKey, playbackPositionUrl, queueSeek]);

  useEffect(() => {
    const save = () => void persistPlaybackPosition();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persistPlaybackPosition]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play()
        .then(() => {
          setPlaying(true);
          setPlaybackError(null);
        })
        .catch(() => refreshAudioUrl({ resumeAt: audio.currentTime, shouldPlay: true }));
    }
  }

  function handleSeek(value: number | readonly number[]) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Array.isArray(value) ? (value as number[])[0] : (value as number);
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const maxTime = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration || audio.currentTime;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, maxTime));
  }

  function cycleSpeed() {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  }

  function jumpToChapter(startSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = startSeconds;
    setCurrentTime(startSeconds);
    if (!playing) {
      void audio.play()
        .then(() => setPlaying(true))
        .catch(() => refreshAudioUrl({ resumeAt: startSeconds, shouldPlay: true }));
    }
  }

  // Find which chapter the current playhead is in (last one whose start <= currentTime).
  const activeChapterIdx = (() => {
    if (!chapters || chapters.length === 0) return -1;
    let active = chapters[0].idx;
    for (const c of chapters) {
      if (c.startSeconds <= currentTime) active = c.idx;
      else break;
    }
    return active;
  })();

  return (
    <div className="liquid-glass rounded-2xl p-5 sm:p-7">
      <audio ref={audioRef} src={currentSrc} preload="metadata" />

      {playbackError && (
        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{playbackError}</span>
            {refreshUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => refreshAudioUrl({ resumeAt: currentTime, shouldPlay: false })}
              >
                Retry playback
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={1}
          onValueChange={handleSeek}
          className="w-full"
        />
        <div className="mb-6 flex justify-between text-[11px] tabular-nums text-white/40">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={cycleSpeed}
          className="liquid-glass flex h-11 w-14 items-center justify-center rounded-full text-[12px] font-medium tabular-nums text-white/80 transition-colors hover:bg-white/5 hover:text-white sm:h-9 sm:w-12"
          type="button"
        >
          {speed}x
        </button>

        <div className="flex items-center gap-5">
          <button
            onClick={() => skip(-15)}
            className="h-11 min-w-12 rounded-full text-white/70 transition-colors duration-150 hover:text-white"
            title="Back 15s"
            type="button"
            aria-label="Back 15 seconds"
          >
            -15
          </button>
          <Button
            size="icon"
            onClick={togglePlay}
            className="size-14 shadow-[0_0_0_6px_rgba(255,255,255,0.06)]"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon className="size-4 fill-black" /> : <PlayIcon className="size-4 fill-black" />}
          </Button>
          <button
            onClick={() => skip(15)}
            className="h-11 min-w-12 rounded-full text-white/70 transition-colors duration-150 hover:text-white"
            title="Forward 15s"
            type="button"
            aria-label="Forward 15 seconds"
          >
            +15
          </button>
        </div>

        <div className="h-9 w-12" />
      </div>

      {chapters && chapters.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="mb-3 px-2 text-xs font-medium uppercase tracking-wide text-white/40">Chapters</h3>
          <ol className="space-y-1">
            {chapters.map((c) => {
            const isActive = c.idx === activeChapterIdx;
            return (
              <li key={c.idx}>
                <button
                  type="button"
                  onClick={() => jumpToChapter(c.startSeconds)}
                  className={`group flex min-h-11 w-full items-baseline gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-white/5 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="w-10 shrink-0 tabular-nums text-xs text-white/40 group-hover:text-white/60">
                    {formatTime(c.startSeconds)}
                  </span>
                  <span className="truncate">{c.title}</span>
                </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
