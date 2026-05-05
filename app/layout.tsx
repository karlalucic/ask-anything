import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { PostHogIdentifier } from "@/components/posthog-identifier";
import { MobileWebVitals } from "@/features/observability/mobile-web-vitals";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ask Anything — Personal Podcasts on Any Topic",
  description: "Tell us what you'd like to understand. We'll teach you — with a personal podcast in the style and voice you pick.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <PostHogIdentifier />
        <MobileWebVitals />
        {children}
      </body>
    </html>
  );
}
