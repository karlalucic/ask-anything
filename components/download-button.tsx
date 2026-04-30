import { buttonVariants } from "@/components/ui/button";
import { sanitizeFilename } from "@/lib/filenames";
import { cn } from "@/lib/utils";

export function DownloadButton({ audioUrl, title, label = "Download" }: { audioUrl: string; title: string; label?: string }) {
  const filename = `${sanitizeFilename(title)}.mp3`;
  const separator = audioUrl.includes("?") ? "&" : "?";
  const href = `${audioUrl}${separator}download=${encodeURIComponent(filename)}`;

  return (
    <a href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      {label}
    </a>
  );
}
