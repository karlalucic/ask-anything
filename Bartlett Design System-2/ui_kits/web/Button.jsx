// Button.jsx — primary, outline, ghost; three sizes.
const BtnBase = "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";
const BtnSizes = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  base: "h-10 px-4 text-sm rounded-lg",
  lg: "h-11 px-8 text-base rounded-lg",
};
const BtnVariants = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800",
  outline: "bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/50",
  ghost: "bg-transparent text-neutral-500 hover:text-neutral-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

function Button({ variant = "primary", size = "base", className = "", full = false, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`${BtnBase} ${BtnSizes[size]} ${BtnVariants[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

Object.assign(window, { Button, BtnBase, BtnSizes, BtnVariants });
