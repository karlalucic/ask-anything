
// ===== Button.jsx =====
const BtnBase = "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";
const BtnSizes = {
  sm: "h-8 px-4 text-[13px] rounded-full",
  base: "h-10 px-5 text-sm rounded-full",
  lg: "h-12 px-10 text-base rounded-full",
};
const BtnVariants = {
  primary: "bg-white text-black hover:bg-white/90",
  outline: "liquid-glass text-white hover:bg-white/5",
  ghost: "bg-transparent text-white/60 hover:text-white",
  danger: "bg-red-500 text-white hover:bg-red-600",
};
function Button({ variant = "primary", size = "base", className = "", full = false, children, ...rest }) {
  return (
    <button {...rest} className={`${BtnBase} ${BtnSizes[size]} ${BtnVariants[variant]} ${full ? "w-full" : ""} ${className}`}>
      {children}
    </button>
  );
}
Object.assign(window, { Button, BtnBase, BtnSizes, BtnVariants });

// ===== Nav.jsx =====
function Nav({ variant = "marketing", onNavigate }) {
  const go = (p) => (e) => { e.preventDefault(); onNavigate?.(p); };
  return (
    <header className="pt-6 px-6">
      <div className="liquid-glass rounded-full max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="#" onClick={go("/")} className="text-xl tracking-tight text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Bartlett
        </a>
        {variant === "marketing" && (
          <div className="flex items-center gap-4">
            <a href="#" onClick={go("/login")} className="text-sm text-white/70 hover:text-white transition-colors">Sign in</a>
            <button onClick={() => onNavigate?.("/signup")} className="bg-white text-black rounded-full px-5 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors">Get started</button>
          </div>
        )}
        {variant === "app" && (
          <div className="flex items-center gap-4">
            <a href="#" onClick={go("/library")} className="text-sm text-white/70 hover:text-white transition-colors">Library</a>
            <button onClick={() => onNavigate?.("/new")} className="bg-white text-black rounded-full px-5 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors">New briefing</button>
          </div>
        )}
        {variant === "listen" && (
          <div className="flex items-center gap-4">
            <a href="#" onClick={go("/library")} className="text-sm text-white/70 hover:text-white transition-colors">Library</a>
            <button className="liquid-glass rounded-full px-5 py-1.5 text-sm text-white hover:bg-white/5 transition-colors">Share</button>
          </div>
        )}
        {variant === "minimal" && <span className="text-xs text-white/30">·</span>}
      </div>
    </header>
  );
}
Object.assign(window, { Nav });

// ===== Pill.jsx =====
function Pill({ selected, children, onClick, className = "" }) {
  return (
    <button onClick={onClick} className={`h-9 px-4 rounded-lg border text-sm transition-all duration-150 ${
      selected
        ? "bg-white text-black border-white"
        : "bg-transparent text-white/50 border-white/15 hover:border-white/40 hover:text-white/80"
    } ${className}`}>
      {children}
    </button>
  );
}
function Badge({ variant = "active", children }) {
  const styles = {
    complete: "bg-white text-black",
    active: "border border-white/20 text-white/50",
    failed: "border border-red-500/40 text-red-400",
    canceled: "border border-white/10 text-white/30",
  };
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
Object.assign(window, { Pill, Badge });

// ===== GenerationCard.jsx =====
function GenerationCard({ title, date, duration, status, onClick }) {
  const active = status !== "complete" && status !== "failed" && status !== "canceled";
  return (
    <button onClick={onClick} className="w-full text-left liquid-glass rounded-xl px-5 py-4 hover:bg-white/5 transition-all duration-150 cursor-pointer flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white/80 truncate">{title}</div>
        <div className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
          <span>{date}</span>
          {status === "complete" && <><span>·</span><span>{duration}</span></>}
          {active && (<><span>·</span><span className="inline-flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-white animate-pulse" />In progress</span></>)}
        </div>
      </div>
      <Badge variant={status === "complete" ? "complete" : status === "failed" ? "failed" : status === "canceled" ? "canceled" : "active"}>{status}</Badge>
    </button>
  );
}
Object.assign(window, { GenerationCard });

// ===== WizardParts.jsx =====
const WIZARD_STEPS = ["Topic", "Style", "Sources", "Voice", "Review"];
function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      {WIZARD_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <span className={i === current ? "text-white font-medium" : "text-white/30"}>{s}</span>
          {i < WIZARD_STEPS.length - 1 && <span className="text-white/10">›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
function StyleCard({ opening, structure, rhythm, signature }) {
  const rows = [["Opening", opening], ["Structure", structure], ["Rhythm", rhythm], ["Signature moves", signature]];
  return (
    <div className="liquid-glass rounded-xl p-4 space-y-3">
      <div className="text-xs font-medium text-white/40 uppercase tracking-wide">Style card</div>
      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="font-medium text-white/50">{k}. </span>
            <span className="text-white/80">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function VoiceRow({ name, description, selected, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ${
      selected ? "bg-white/10 border-white text-white" : "bg-transparent border-white/10 text-white/60 hover:border-white/30"
    }`}>
      <span className="text-sm font-medium">{name}</span>
      <span className={`text-sm ${selected ? "text-white/70" : "text-white/40"}`}>{description}</span>
    </button>
  );
}
Object.assign(window, { StepIndicator, StyleCard, VoiceRow, WIZARD_STEPS });

// ===== ListenParts.jsx =====
function ProgressStrip({ stages, current }) {
  return (
    <div className="flex items-center">
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-white" : active ? "bg-white animate-pulse" : "bg-white/20"}`} />
            {i < stages.length - 1 && <span className={`flex-1 h-px ${done ? "bg-white/60" : "bg-white/10"}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
function ChapterChecklist({ chapters }) {
  const dot = (s) => s === "done" ? "bg-white" : s === "active" ? "bg-white/60 animate-pulse" : s === "failed" ? "bg-red-500" : "bg-white/20";
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-medium text-white/50">Chapters</h3>
      <ul className="space-y-2">
        {chapters.map((c, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot(c.status)}`} />
            <span className={`text-sm ${c.status === "pending" ? "text-white/30" : "text-white/70"}`}>{c.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function AudioPlayer({ duration = 1082 }) {
  const [playing, setPlaying] = React.useState(false);
  const [pos, setPos] = React.useState(348);
  const [speed, setSpeed] = React.useState(1);
  const speeds = [0.75, 1, 1.25, 1.5, 2];
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => Math.min(p + speed, duration)), 1000);
    return () => clearInterval(id);
  }, [playing, duration, speed]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = (pos / duration) * 100;
  const cycleSpeed = () => setSpeed((x) => speeds[(speeds.indexOf(x) + 1) % speeds.length]);
  return (
    <div className="liquid-glass rounded-2xl p-7">
      <div className="relative h-1 bg-white/15 rounded-full mb-3 cursor-pointer group" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos(((e.clientX - r.left) / r.width) * duration);
      }}>
        <div className="absolute inset-y-0 left-0 bg-white rounded-full transition-[width] duration-200" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 w-3 h-3 bg-white rounded-full -translate-y-1/2 -translate-x-1/2 shadow-[0_0_0_4px_rgba(255,255,255,0.15)] opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/40 tabular-nums mb-6">
        <span>{fmt(pos)}</span><span>−{fmt(duration - pos)}</span>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={cycleSpeed} className="liquid-glass rounded-full h-9 w-12 flex items-center justify-center text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors tabular-nums">
          {speed}×
        </button>
        <div className="flex items-center gap-5">
          <button onClick={() => setPos((p) => Math.max(0, p - 15))} aria-label="Back 15 seconds" className="group flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 6 A8 8 0 1 0 22 14" />
              <path d="M14 3 L10 6 L14 9" />
              <text x="14" y="17" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="'Inter',sans-serif" fontWeight="600">15</text>
            </svg>
          </button>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:bg-white/90 active:scale-95 transition-all shadow-[0_0_0_6px_rgba(255,255,255,0.06)]">
            {playing
              ? <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><rect x="1" y="0" width="4" height="16" rx="1"/><rect x="9" y="0" width="4" height="16" rx="1"/></svg>
              : <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><path d="M2 1 L13 8 L2 15 Z"/></svg>}
          </button>
          <button onClick={() => setPos((p) => Math.min(duration, p + 15))} aria-label="Forward 15 seconds" className="group flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 6 A8 8 0 1 1 6 14" />
              <path d="M14 3 L18 6 L14 9" />
              <text x="14" y="17" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="'Inter',sans-serif" fontWeight="600">15</text>
            </svg>
          </button>
        </div>
        <div className="h-9 w-12" />
      </div>
    </div>
  );
}
function ErrorBox({ stage, code, provider, providerCode, message, onResume, onReport }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-red-300">{stage} · {code}</div>
        <span className="ml-auto inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium border border-red-500/30 text-red-400">{provider} · {providerCode}</span>
      </div>
      <p className="text-sm text-red-400 leading-relaxed">{message}</p>
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
        {open ? "Hide" : "Show"} technical details
      </button>
      {open && (
        <pre className="text-[11px] font-mono text-red-300 bg-black/40 border border-red-500/20 rounded-lg p-3 overflow-x-auto">
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
  if (submitted) return <p className="text-sm text-white/30">Thanks for the feedback.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/40">Was this briefing helpful?</p>
      <div className="flex gap-2">
        <button onClick={() => setPicked("yes")} className={`liquid-glass rounded-full px-5 py-2 text-sm transition-colors ${picked === "yes" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>Helpful</button>
        <button onClick={() => setPicked("no")} className={`liquid-glass rounded-full px-5 py-2 text-sm transition-colors ${picked === "no" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>Not helpful</button>
      </div>
      {picked && (
        <div className="space-y-2 animate-fade-rise">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything you'd like us to know? (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-white/20 resize-none outline-none focus:border-white/40 transition-colors" />
          <Button size="sm" onClick={() => setSubmitted(true)}>Submit</Button>
        </div>
      )}
    </div>
  );
}
Object.assign(window, { ProgressStrip, ChapterChecklist, AudioPlayer, ErrorBox, FeedbackButtons });

// ===== Screens.jsx =====
const SAMPLE_GENERATIONS = [
  { id: "g1", title: "The physics of fermentation", date: "Apr 12", duration: "18 min", status: "complete" },
  { id: "g2", title: "How central banks actually set interest rates", date: "Apr 11", duration: null, status: "drafting" },
  { id: "g3", title: "Who actually built the English common law", date: "Apr 9", duration: "42 min", status: "complete" },
  { id: "g4", title: "A short history of the container ship", date: "Apr 5", duration: "22 min", status: "complete" },
  { id: "g5", title: "Sourdough — the microbiology", date: "Apr 2", duration: null, status: "failed" },
];

// ---------- Landing (logged-out) — unchanged dark hero ----------
function LandingOut({ go }) {
  const HERO_VIDEO = "https://videos.pexels.com/video-files/7989706/7989706-uhd_2560_1440_25fps.mp4";
  return (
    <div className="bg-black">
      <section className="relative flex flex-col min-h-screen overflow-hidden bg-black">
        <video autoPlay loop muted playsInline preload="auto"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-80" src={HERO_VIDEO} />
        <div className="absolute inset-0 bg-black/30 z-[1]" />
        <div className="relative z-10"><Nav variant="marketing" onNavigate={go} /></div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <h1 className="font-normal tracking-tight leading-[1.05] text-center animate-fade-rise text-white text-6xl md:text-8xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
            <span className="block">Any topic.</span>
            <em className="not-italic block text-white/50 mt-2">Narrated in minutes.</em>
          </h1>
          <p className="animate-fade-rise-delay text-lg text-white/50 mt-8 leading-relaxed text-center max-w-2xl">
            Type a subject. Choose how deep to go. Receive a polished, narrated audio briefing — structured like a real podcast, written in any style you want.
          </p>
          <div className="animate-fade-rise-delay-2 mt-12">
            <button onClick={() => go("/signup")} className="bg-white text-black rounded-full px-10 py-3 text-base font-medium hover:bg-white/90 transition-colors">Get started free</button>
          </div>
        </div>
      </section>
      <section className="bg-black pt-24 pb-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl text-white leading-tight tracking-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>Editorial by design.</h2>
            <p className="text-lg text-white/50 mt-4 leading-relaxed max-w-xl mx-auto">
              Bartlett reads like a magazine, not a robot. Pick a voice, a length, and a house style — get back something you'd actually listen to.
            </p>
          </div>
          <div className="space-y-3">
            {SAMPLE_GENERATIONS.slice(0, 3).map((g) => (
              <GenerationCard key={g.id} {...g} onClick={() => go("/signup")} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- Landing (logged-in) ----------
function LandingIn({ go }) {
  const recent = SAMPLE_GENERATIONS.slice(0, 3);
  return (
    <div className="bg-black min-h-screen">
      <Nav variant="app" onNavigate={go} />
      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>Recent briefings</h2>
          <button onClick={() => go("/new")} className="bg-white text-black rounded-full px-5 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors">New briefing</button>
        </div>
        {recent.length === 0 ? (
          <div className="liquid-glass rounded-xl py-20 text-center">
            <p className="text-sm text-white/30 mb-4">You haven't generated any briefings yet.</p>
            <Button onClick={() => go("/new")}>Start your first</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((g) => (<GenerationCard key={g.id} {...g} onClick={() => go("/listen/" + g.id)} />))}
          </div>
        )}
        <div className="mt-6 text-center">
          <a href="#" onClick={(e) => { e.preventDefault(); go("/library"); }} className="text-sm text-white/30 hover:text-white transition-colors">View all →</a>
        </div>
      </main>
    </div>
  );
}

// ---------- Wizard ----------
function Wizard({ go }) {
  const [step, setStep] = React.useState(0);
  const [topic, setTopic] = React.useState("");
  const [length, setLength] = React.useState("20");
  const [familiarity, setFamiliarity] = React.useState("Intermediate");
  const [intent, setIntent] = React.useState("Just curious");
  const [styleInput, setStyleInput] = React.useState("");
  const [analyzed, setAnalyzed] = React.useState(false);
  const [sources, setSources] = React.useState({ web: true, academic: false });
  const [recency, setRecency] = React.useState("Any time");
  const [voice, setVoice] = React.useState("Eve");

  const voices = [
    { name: "Eve", description: "Energetic, upbeat" },
    { name: "Mercer", description: "Warm, measured baritone" },
    { name: "Harlow", description: "Clear, journalistic" },
    { name: "Ada", description: "Soft, contemplative" },
    { name: "Corbin", description: "Dry, wry, British" },
  ];

  const Section = ({ children }) => <div className="space-y-5">{children}</div>;
  const FieldLabel = ({ children }) => <div className="text-base font-medium text-white">{children}</div>;
  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg p-3 text-base text-white placeholder:text-white/20 resize-none outline-none focus:border-white/40 transition-colors";
  const inputSm = "w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-white/40 transition-colors";

  return (
    <div className="bg-black min-h-screen">
      <Nav variant="minimal" onNavigate={go} />
      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-10"><StepIndicator current={step} /></div>
        {step === 0 && (
          <Section>
            <FieldLabel>What do you want to learn about?</FieldLabel>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="e.g. Why the Dutch Republic became a financial superpower" className={inputCls} />
            <div className="space-y-3">
              <div className="text-sm text-white/50">Length</div>
              <div className="flex gap-2">{["5","20","60"].map((l) => (<Pill key={l} selected={length === l} onClick={() => setLength(l)}>{l} min</Pill>))}</div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white/50">Familiarity</div>
              <div className="flex gap-2">{["Beginner","Intermediate","Advanced"].map((f) => (<Pill key={f} selected={familiarity === f} onClick={() => setFamiliarity(f)}>{f}</Pill>))}</div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white/50">Intent</div>
              <div className="grid grid-cols-2 gap-2">{["Just curious","For work","Comparing options","Deep dive"].map((i) => (<Pill key={i} selected={intent === i} onClick={() => setIntent(i)}>{i}</Pill>))}</div>
            </div>
            <Button full onClick={() => setStep(1)}>Continue</Button>
          </Section>
        )}
        {step === 1 && (
          <Section>
            <div>
              <FieldLabel>Writing style</FieldLabel>
              <p className="text-sm text-white/50 mt-1">Name an author, publication, or describe a style.</p>
            </div>
            <div className="flex gap-2">
              <input value={styleInput} onChange={(e) => setStyleInput(e.target.value)} placeholder="e.g. The New Yorker, Michael Lewis, dryly funny" className={`flex-1 ${inputSm}`} />
              <Button variant="outline" onClick={() => setAnalyzed(true)}>Analyze</Button>
            </div>
            {analyzed && (
              <div className="animate-fade-rise space-y-4">
                <StyleCard opening="Drop the reader in the middle of a scene." structure="Three-act — scene, context, implication." rhythm="Short declarative sentences punctuated by long digressive ones." signature="A named character; a small specific number; a dry aside." />
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm text-white/50">How formal should it feel?</label>
                    <input className={inputSm} placeholder="Answer (optional)" />
                  </div>
                  <Button size="sm" variant="outline">Refine style card</Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)} className="flex-1">Continue</Button>
            </div>
          </Section>
        )}
        {step === 2 && (
          <Section>
            <FieldLabel>Sources</FieldLabel>
            <div className="space-y-3">
              {[["web","Web"],["academic","Academic papers"]].map(([key,label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <span onClick={() => setSources((s) => ({...s,[key]:!s[key]}))} className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${sources[key] ? "bg-white border-white" : "border-white/30 group-hover:border-white/60"}`}>
                    {sources[key] && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5 L4 7 L8 3" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className="text-sm text-white/80">{label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white/50">Recency</div>
              <div className="flex gap-2 flex-wrap">{["Any time","Past year","Past month","Past week"].map((r) => (<Pill key={r} selected={recency === r} onClick={() => setRecency(r)}>{r}</Pill>))}</div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Continue</Button>
            </div>
          </Section>
        )}
        {step === 3 && (
          <Section>
            <FieldLabel>Voice</FieldLabel>
            <div className="space-y-2">{voices.map((v) => (<VoiceRow key={v.name} {...v} selected={voice === v.name} onClick={() => setVoice(v.name)} />))}</div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">Continue</Button>
            </div>
          </Section>
        )}
        {step === 4 && (
          <Section>
            <FieldLabel>Review</FieldLabel>
            <div className="liquid-glass rounded-xl divide-y divide-white/10">
              {[
                ["Topic", topic || "—"],
                ["Length", length + " min"],
                ["Familiarity", familiarity],
                ["Intent", intent],
                ["Style", styleInput || "Default editorial"],
                ["Voice", voice],
                ["Sources", Object.entries(sources).filter(([,v]) => v).map(([k]) => k).join(", ") + " · " + recency],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-white/40">{k}</span>
                  <span className="text-sm text-white/80 text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>
            <Button full onClick={() => go("/listen/new")}>Generate briefing</Button>
            <Button variant="outline" full onClick={() => setStep(3)}>Back</Button>
          </Section>
        )}
      </main>
    </div>
  );
}

// ---------- Listen ----------
function Listen({ go, id, shared = false }) {
  const isNew = id === "new";
  const [stageIdx, setStageIdx] = React.useState(isNew ? 1 : 4);
  const [complete, setComplete] = React.useState(!isNew);
  React.useEffect(() => {
    if (!isNew) return;
    const ticks = [[1500, () => setStageIdx(2)], [3000, () => setStageIdx(3)], [5000, () => setComplete(true)]];
    const timers = ticks.map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
  }, [isNew]);
  const stages = ["Outlining", "Researching", "Drafting", "Narrating", "Complete"];
  const chapters = [
    { title: "A brief prehistory", status: complete ? "done" : stageIdx >= 2 ? "done" : "active" },
    { title: "The VOC as a joint-stock experiment", status: complete ? "done" : stageIdx >= 3 ? "done" : stageIdx === 2 ? "active" : "pending" },
    { title: "Amsterdam's bourse", status: complete ? "done" : stageIdx >= 3 ? "active" : "pending" },
    { title: "Tulip mania in context", status: complete ? "done" : "pending" },
    { title: "Why it ended", status: complete ? "done" : "pending" },
  ];
  return (
    <div className="bg-black min-h-screen">
      <Nav variant={shared ? "minimal" : "listen"} onNavigate={go} />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Why the Dutch Republic became a financial superpower
          </h1>
          <p className="text-sm text-white/40 mt-1">18 min · Intermediate · Just curious</p>
        </header>
        {!complete ? (
          <div className="space-y-10">
            <div className="space-y-3">
              <ProgressStrip stages={stages} current={stageIdx} />
              <p className="text-sm text-white/50">{stages[stageIdx]} <span className="text-white/30">· {Math.min(stageIdx + 1, 5)}/5 stages</span></p>
            </div>
            <ChapterChecklist chapters={chapters} />
          </div>
        ) : (
          <div className="space-y-10">
            <AudioPlayer duration={1082} />
            <div>
              <h3 className="text-sm font-medium text-white/50 mb-3">Chapters</h3>
              <ol className="space-y-2">
                {chapters.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/60">
                    <span className="text-white/20 tabular-nums w-4 shrink-0">{i + 1}</span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ol>
            </div>
            <details className="group">
              <summary className="text-sm text-white/30 hover:text-white cursor-pointer transition-colors list-none flex items-center gap-1.5">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>Read script
              </summary>
              <div className="mt-4 text-sm text-white/50 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Instrument Serif', serif", fontSize: "15px" }}>
{`In 1602 a handful of Amsterdam merchants did something unusual. They pooled their money, not for a single voyage, but for everything — every ship, every warehouse, every contract for as long as the company existed.

They called it the Vereenigde Oostindische Compagnie. The initials, VOC, would become the most valuable four letters in seventeenth-century finance...`}
              </div>
            </details>
            {shared && (<div className="pt-6 border-t border-white/10"><FeedbackButtons /></div>)}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Library ----------
function Library({ go }) {
  return (
    <div className="bg-black min-h-screen">
      <Nav variant="app" onNavigate={go} />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl mb-8 text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>Your library</h1>
        <div className="space-y-3">
          {SAMPLE_GENERATIONS.map((g) => (<GenerationCard key={g.id} {...g} onClick={() => go("/listen/" + g.id)} />))}
        </div>
      </main>
    </div>
  );
}

// ---------- Auth ----------
function AuthPage({ mode, go }) {
  const isLogin = mode === "login";
  const inputSm = "mt-1 w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-white/40 transition-colors";
  return (
    <div className="bg-black min-h-screen flex flex-col">
      <Nav variant="minimal" onNavigate={go} />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="liquid-glass rounded-2xl p-10 max-w-sm w-full mx-auto">
          <div className="text-center mb-8">
            <div className="text-4xl text-white mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>Bartlett</div>
            <p className="text-sm text-white/40">{isLogin ? "Welcome back." : "Create your account."}</p>
          </div>
          <div className="space-y-4">
            <button className="liquid-glass rounded-full w-full py-3 text-sm text-white/80 font-medium hover:bg-white/5 transition-colors">
              <span className="mr-2">G</span>Continue with Google
            </button>
            <div className="flex items-center gap-3 text-xs text-white/20">
              <div className="flex-1 h-px bg-white/10" /><span>or</span><div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50">Email</label>
                <input type="email" className={inputSm} />
              </div>
              <div>
                <label className="text-sm text-white/50">Password</label>
                <input type="password" className={inputSm} />
              </div>
            </div>
            <button onClick={() => go("/in")} className="bg-white text-black rounded-full w-full py-3 text-sm font-medium hover:bg-white/90 transition-colors">
              {isLogin ? "Sign in" : "Create account"}
            </button>
            <p className="text-sm text-white/30 text-center">
              {isLogin ? "No account? " : "Already have an account? "}
              <a href="#" onClick={(e) => { e.preventDefault(); go(isLogin ? "/signup" : "/login"); }} className="underline text-white/60">
                {isLogin ? "Sign up" : "Sign in"}
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { LandingOut, LandingIn, Wizard, Listen, Library, AuthPage, SAMPLE_GENERATIONS });
