// ProgressStrip.jsx, AudioPlayer.jsx, ErrorBox.jsx, FeedbackButtons.jsx
function ProgressStrip({ stages, current }) {
  return (
    <div className="flex items-center">
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-neutral-900" : active ? "bg-neutral-900 animate-pulse" : "bg-neutral-200"}`} />
            {i < stages.length - 1 && <span className={`flex-1 h-px ${done ? "bg-neutral-900" : "bg-neutral-200"}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ChapterChecklist({ chapters }) {
  // chapters: [{title, status: done|active|pending|failed}]
  const dot = (s) =>
    s === "done" ? "bg-neutral-900"
    : s === "active" ? "bg-neutral-400 animate-pulse"
    : s === "failed" ? "bg-red-500"
    : "bg-neutral-200";
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-medium text-neutral-600">Chapters</h3>
      <ul className="space-y-2">
        {chapters.map((c, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot(c.status)}`} />
            <span className={`text-sm ${c.status === "pending" ? "text-neutral-400" : "text-neutral-700"}`}>{c.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AudioPlayer({ duration = 1082 }) {
  const [playing, setPlaying] = React.useState(false);
  const [pos, setPos] = React.useState(348);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => Math.min(p + 1, duration)), 1000);
    return () => clearInterval(id);
  }, [playing, duration]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = (pos / duration) * 100;
  return (
    <div className="border border-neutral-100 rounded-xl p-6 bg-neutral-50/50">
      <div className="flex items-center justify-center gap-6 mb-4">
        <button onClick={() => setPos((p) => Math.max(0, p - 15))} className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">−15</button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-16 h-10 border border-neutral-200 bg-white rounded-lg flex items-center justify-center hover:border-neutral-400 transition-colors"
        >
          {playing ? (
            <svg width="10" height="12" viewBox="0 0 10 12" fill="#0A0A0A"><rect x="0" y="0" width="3" height="12"/><rect x="7" y="0" width="3" height="12"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="#0A0A0A"><path d="M2 1 L10 6 L2 11 Z"/></svg>
          )}
        </button>
        <button onClick={() => setPos((p) => Math.min(duration, p + 30))} className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">+30</button>
      </div>
      <div
        className="relative h-0.5 bg-neutral-200 rounded-full mb-2 cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos(((e.clientX - r.left) / r.width) * duration);
        }}
      >
        <div className="absolute inset-y-0 left-0 bg-neutral-900 rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 w-2.5 h-2.5 bg-neutral-900 rounded-full -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-neutral-400 tabular-nums">
        <span>{fmt(pos)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}

function ErrorBox({ stage, code, provider, providerCode, message, onResume, onReport }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-red-200 rounded-xl p-5 bg-red-50 space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-red-800">{stage} · {code}</div>
        <span className="ml-auto inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-white border border-red-200 text-red-700">
          {provider} · {providerCode}
        </span>
      </div>
      <p className="text-sm text-red-700 leading-relaxed">{message}</p>
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-red-600 hover:text-red-800 transition-colors">
        {open ? "Hide" : "Show"} technical details
      </button>
      {open && (
        <pre className="text-[11px] font-mono text-red-900 bg-white border border-red-200 rounded-lg p-3 overflow-x-auto">
{`{
  "stage": "${stage}",
  "code": "${code}",
  "provider": "${provider}",
  "provider_code": "${providerCode}",
  "retryable": true
}`}
        </pre>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={onResume}>Resume</Button>
        <Button size="sm" variant="ghost" onClick={onReport}>Report</Button>
      </div>
    </div>
  );
}

function FeedbackButtons() {
  const [picked, setPicked] = React.useState(null);
  const [note, setNote] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  if (submitted) return <p className="text-sm text-neutral-500">Thanks for the feedback.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">Was this briefing helpful?</p>
      <div className="flex gap-2">
        <Button size="sm" variant={picked === "yes" ? "primary" : "outline"} onClick={() => setPicked("yes")}>Helpful</Button>
        <Button size="sm" variant={picked === "no" ? "primary" : "outline"} onClick={() => setPicked("no")}>Not helpful</Button>
      </div>
      {picked && (
        <div className="space-y-2 animate-fade-rise">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything you'd like us to know? (optional)"
            className="w-full border border-neutral-200 rounded-lg p-3 text-sm resize-none outline-none focus:border-neutral-900 transition-colors"
          />
          <Button size="sm" onClick={() => setSubmitted(true)}>Submit</Button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProgressStrip, ChapterChecklist, AudioPlayer, ErrorBox, FeedbackButtons });
