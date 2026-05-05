import Link from "next/link";

import { HeroBackdrop } from "@/components/hero-backdrop";
import { IntroModal } from "@/components/intro-modal";
import { SiteNav } from "@/components/site-nav";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const SAMPLE_PODCASTS = [
  { title: "How my mortgage actually works", date: "Apr 12", duration: "22 min", status: "complete" },
  { title: "What tariffs really do to prices", date: "Apr 11", duration: null, status: "drafting" },
  { title: "How careers will change in the age of AI", date: "Apr 9", duration: "31 min", status: "complete" },
  { title: "The science of getting better sleep", date: "Apr 7", duration: "18 min", status: "complete" },
];

const HOW_IT_WORKS = [
  {
    title: "Tell us what you want to understand.",
    body: "Type any subject. Pick how long, and how much you already know.",
  },
  {
    title: "Pick how it should sound.",
    body: "Choose a voice. Choose a writing style — like The New Yorker or a friend explaining over coffee.",
  },
  {
    title: "Listen.",
    body: "We turn it into a personal podcast — written, narrated, ready to play. Five to sixty minutes, your call.",
  },
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white">
        <LoggedOutLanding />
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_seen_intro")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-black text-white">
      <LoggedInHome />
      <IntroModal initiallyOpen={!profile?.has_seen_intro} />
    </main>
  );
}

function LoggedOutLanding() {
  return (
    <>
      <HeroSection />
      <EditorialSection />
    </>
  );
}

function LoggedInHome() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <HeroBackdrop />
      <div className="relative z-10">
        <SiteNav>
          <>
            <Link href="/library" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">
              Library
            </Link>
            <Link href="/account" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">
              Account
            </Link>
            <Link href="/new" className={cn(buttonVariants({ size: "sm" }))}>
              New podcast
            </Link>
          </>
        </SiteNav>
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-center gap-12 px-6 py-14 lg:flex-row lg:items-center lg:py-20">
        <div className="flex-1 min-w-0">
          <h1 className="max-w-4xl text-6xl font-normal leading-[1.03] tracking-tight text-white md:text-8xl">
            <span className="block">Ask anything.</span>
            <em className="mt-2 block not-italic text-white/50">Know everything.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/50">
            What do you want to understand today?
          </p>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
              New podcast
            </Link>
            <Link href="/library" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Open library
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <HeroBackdrop />
      <div className="relative z-10">
        <SiteNav>
          <>
            <Link href="/login" className="text-sm text-white/70 transition-colors duration-150 hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </>
        </SiteNav>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-center gap-12 px-6 py-14 lg:flex-row lg:items-center lg:py-20">
        {/* Left: headline + CTAs */}
        <div className="flex-1 min-w-0">
          <h1 className="max-w-4xl text-6xl font-normal leading-[1.03] tracking-tight text-white md:text-8xl">
            <span className="block">Ask anything.</span>
            <em className="mt-2 block not-italic text-white/50">Know everything.</em>
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/50">
            Tell us what you&rsquo;d like to understand. We&rsquo;ll teach you &mdash; with a personal podcast in the style and voice you pick.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
              Get started
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Sign in
            </Link>
          </div>
        </div>

        {/* Right: glass preview panel */}
        <div className="w-full lg:w-[420px] lg:shrink-0">
          <PromptGlassPanel />
        </div>
      </div>
    </section>
  );
}

function PromptGlassPanel() {
  return (
    <aside className="liquid-glass rounded-2xl p-5">
      <div className="border-b border-white/10 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/40">Podcast draft</p>
        <p className="mt-4 font-display text-3xl leading-tight text-white">
          How Steve Jobs built his empire
        </p>
        <p className="mt-4 text-sm leading-6 text-white/50">
          Twenty-five minutes on how vision, timing, and stubbornness compound &mdash; narrated in the voice of your choice.
        </p>
      </div>
      <div className="space-y-3 pt-5">
        {SAMPLE_PODCASTS.slice(0, 3).map((podcast) => (
          <SamplePodcastRow key={podcast.title} podcast={podcast} href="/new" />
        ))}
      </div>
      <Link href="/new" className={cn(buttonVariants({ className: "mt-5 w-full" }))}>
        Create this podcast
      </Link>
    </aside>
  );
}

function EditorialSection() {
  return (
    <section className="relative bg-black px-6 pb-28 pt-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:pt-7">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-white/40">How it works</p>
          <ol className="space-y-7">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span className="font-display text-3xl leading-none text-white/30">{i + 1}</span>
                <div>
                  <p className="font-display text-2xl leading-tight text-white md:text-3xl">{step.title}</p>
                  <p className="mt-2 max-w-md text-base leading-relaxed text-white/50">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          {SAMPLE_PODCASTS.map((podcast) => (
            <SamplePodcastRow key={podcast.title} podcast={podcast} href="/new" spacious />
          ))}
        </div>
      </div>
    </section>
  );
}

function SamplePodcastRow({
  podcast,
  href,
  spacious = false,
}: {
  podcast: (typeof SAMPLE_PODCASTS)[number];
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
        <p className="truncate text-sm font-medium text-white/80">{podcast.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
          <span>{podcast.date}</span>
          <span>·</span>
          {podcast.duration ? (
            <span>{podcast.duration}</span>
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
          podcast.status === "complete" ? "bg-white text-black" : "border border-white/20 text-white/50",
        )}
      >
        {podcast.status}
      </span>
    </Link>
  );
}
