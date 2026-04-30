"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeFilename } from "@/lib/filenames";

export function ScriptDownloadButton({ script, title }: { script: string; title: string }) {
  function handleDownload() {
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(title)}-script.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleDownload}>
      <FileText aria-hidden />
      Script
    </Button>
  );
}
