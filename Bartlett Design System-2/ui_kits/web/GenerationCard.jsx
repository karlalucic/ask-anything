// GenerationCard.jsx
function GenerationCard({ title, date, duration, status, onClick }) {
  const active = status !== "complete" && status !== "failed" && status !== "canceled";
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-neutral-100 rounded-xl px-5 py-4 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all duration-150 cursor-pointer flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 truncate">{title}</div>
        <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1.5">
          <span>{date}</span>
          {status === "complete" && <><span>·</span><span>{duration}</span></>}
          {active && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-neutral-900 animate-pulse" />
                In progress
              </span>
            </>
          )}
        </div>
      </div>
      <Badge variant={status === "complete" ? "complete" : status === "failed" ? "failed" : status === "canceled" ? "canceled" : "active"}>
        {status}
      </Badge>
    </button>
  );
}

Object.assign(window, { GenerationCard });
