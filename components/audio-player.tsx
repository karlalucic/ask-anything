"use client";

import { useRef, useState, useEffect } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  src: string;
  durationSeconds?: number | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, durationSeconds }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
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
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration));
  }

  function cycleSpeed() {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  }

  return (
    <div className="liquid-glass rounded-2xl p-7">
      <audio ref={audioRef} src={src} preload="metadata" />

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
          className="liquid-glass flex h-9 w-12 items-center justify-center rounded-full text-[12px] font-medium tabular-nums text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          type="button"
        >
          {speed}x
        </button>

        <div className="flex items-center gap-5">
          <button
            onClick={() => skip(-15)}
            className="text-white/70 transition-colors duration-150 hover:text-white"
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
            className="text-white/70 transition-colors duration-150 hover:text-white"
            title="Forward 15s"
            type="button"
            aria-label="Forward 15 seconds"
          >
            +15
          </button>
        </div>

        <div className="h-9 w-12" />
      </div>
    </div>
  );
}
