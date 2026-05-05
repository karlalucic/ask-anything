import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-white transition-colors duration-150 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/20 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-1 aria-invalid:ring-red-400/30 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
