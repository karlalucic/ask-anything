import Link from "next/link";
import type { ReactNode } from "react";

import { SiteNav } from "@/components/site-nav";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const SAMPLE_BRIEFINGS = [
  { title: "The physics of fermentation", date: "Apr 12", duration: "18 min", status: "complete" },
  { title: "How central banks actually set interest rates", date: "Apr 11", duration: null, status: "drafting" },
  { title: "Who actually built the English common law", date: "Apr 9", duration: "42 min", status: "complete" },
];


export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-black text-white">
      {user ? <LoggedInHome /> : <LoggedOutLanding />}
    </main>
  );
}

function LoggedOutLanding() {
  return (
    <>
      <PageHero
        nav={
          <>
            <Link href="/login" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </>
        }
        eyebrow="Bartlett"
        title="Any topic."
        accent="Narrated in minutes."
        description="Type a subject, choose how deep to go, and receive a polished audio briefing with the shape and pace of a real editorial podcast."
        primaryHref="/signup"
        primaryLabel="Get started free"
        secondaryHref="/login"
        secondaryLabel="Sign in"
      >
        <PromptGlassPanel />
      </PageHero>
      <EditorialSection />
    </>
  );
}

function LoggedInHome() {
  return (
    <PageHero
      nav={
        <>
          <Link href="/library" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">
            Library
          </Link>
          <Link href="/new" className={cn(buttonVariants({ size: "sm" }))}>
            New briefing
          </Link>
        </>
      }
      eyebrow="Home"
      title="Any topic."
      accent="Narrated in minutes."
      hideCtas
    >
      <div className="flex flex-col gap-3">
        <Link href="/new" className={cn(buttonVariants({ size: "lg", className: "w-full" }))}>
          New briefing
        </Link>
        <Link href="/library" className={cn(buttonVariants({ variant: "outline", size: "lg", className: "w-full" }))}>
          Open library
        </Link>
      </div>
    </PageHero>
  );
}

function PageHero({
  nav,
  eyebrow,
  title,
  accent,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  hideCtas,
  children,
}: {
  nav: ReactNode;
  eyebrow: string;
  title: string;
  accent: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  hideCtas?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <HeroBackdrop />
      <div className="relative z-10">
        <SiteNav>{nav}</SiteNav>
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-center gap-12 px-6 py-14 lg:flex-row lg:items-center lg:py-20">
        <div className="flex-1 min-w-0">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.28em] text-white/40">{eyebrow}</p>
          <h1 className="max-w-4xl text-6xl font-normal leading-[1.03] tracking-tight text-white md:text-8xl">
            <span className="block">{title}</span>
            <em className="mt-2 block not-italic text-white/50">{accent}</em>
          </h1>
          {description && <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60">{description}</p>}
          {!hideCtas && primaryHref && secondaryHref && (
            <div className="mt-12 flex flex-wrap items-center gap-3">
              <Link href={primaryHref} className={cn(buttonVariants({ size: "lg" }))}>
                {primaryLabel}
              </Link>
              <Link href={secondaryHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                {secondaryLabel}
              </Link>
            </div>
          )}
        </div>
        <div className="w-full lg:w-[420px] lg:shrink-0">
          {children}
        </div>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover object-top opacity-99"
        src={HERO_VIDEO}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.75)_100%),linear-gradient(to_bottom,transparent_60%,#000_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black" />
    </div>
  );
}

function PromptGlassPanel() {
  return (
    <aside className="liquid-glass rounded-2xl p-5">
      <div className="border-b border-white/10 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/40">Briefing draft</p>
        <p className="mt-4 font-display text-3xl leading-tight text-white">
          Why the Dutch Republic became a financial superpower
        </p>
        <p className="mt-4 text-sm leading-6 text-white/50">
          A narrative briefing with scene-setting, clear context, and a dry aside where it earns one.
        </p>
      </div>
      <div className="space-y-3 pt-5">
        {SAMPLE_BRIEFINGS.map((briefing) => (
          <SampleBriefingRow key={briefing.title} briefing={briefing} href="/signup" />
        ))}
      </div>
      <Link href="/signup" className={cn(buttonVariants({ className: "mt-5 w-full" }))}>
        Create this briefing
      </Link>
    </aside>
  );
}


function EditorialSection() {
  return (
    <section className="relative bg-black px-6 pb-28 pt-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:pt-7">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-white/40">Editorial by design</p>
          <h2 className="max-w-xl font-display text-5xl leading-tight text-white md:text-6xl">
            A briefing should sound finished before it reaches your ears.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/50">
            Choose a voice, a length, and a house style. Bartlett turns the raw question into chapters, narration, and a listenable arc.
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          {SAMPLE_BRIEFINGS.map((briefing) => (
            <SampleBriefingRow key={briefing.title} briefing={briefing} href="/signup" spacious />
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleBriefingRow({
  briefing,
  href,
  spacious = false,
}: {
  briefing: (typeof SAMPLE_BRIEFINGS)[number];
  href: string;
  spacious?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-xl px-4 text-left transition-colors duration-150 hover:bg-white/5",
        spacious ? "py-5" : "py-3",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/80">{briefing.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
          <span>{briefing.date}</span>
          <span>·</span>
          {briefing.duration ? (
            <span>{briefing.duration}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-white animate-pulse" />
              in progress
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium",
          briefing.status === "complete" ? "bg-white text-black" : "border border-white/20 text-white/50",
        )}
      >
        {briefing.status}
      </span>
    </Link>
  );
}
