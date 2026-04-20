// Pill.jsx, Badge.jsx — small inline display elements
function Pill({ selected, children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-4 rounded-lg border text-sm transition-all duration-150 ${
        selected
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ variant = "active", children }) {
  const styles = {
    complete: "bg-neutral-900 text-white",
    active: "border border-neutral-200 text-neutral-600 bg-white",
    failed: "bg-red-50 text-red-800 border border-red-200",
    canceled: "border border-neutral-200 text-neutral-400 bg-white",
  };
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

Object.assign(window, { Pill, Badge });
