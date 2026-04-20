import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base text-white transition-colors duration-150 outline-none placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-1 aria-invalid:ring-red-400/30 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
