import { ScriptDownloadButton } from "@/components/script-download-button";

export function ScriptDisplay({ script, title }: { script: string; title: string }) {
  return (
    <details className="mt-8 border-t border-white/10 pt-8">
      <summary className="cursor-pointer select-none text-sm text-white/30 transition-colors duration-150 hover:text-white">
        Read script
      </summary>
      <div className="mt-5 flex justify-end">
        <ScriptDownloadButton script={script} title={title} />
      </div>
      <div className="mt-4 whitespace-pre-wrap font-serif text-sm leading-relaxed text-white/50">
        {script}
      </div>
    </details>
  );
}
