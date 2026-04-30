import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "podcast";
}

export function DownloadButton({ audioUrl, title }: { audioUrl: string; title: string }) {
  const filename = `${sanitizeFilename(title)}.mp3`;
  const separator = audioUrl.includes("?") ? "&" : "?";
  const href = `${audioUrl}${separator}download=${encodeURIComponent(filename)}`;

  return (
    <a href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      Download
    </a>
  );
}
