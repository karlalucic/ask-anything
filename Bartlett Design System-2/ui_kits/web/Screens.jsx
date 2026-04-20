// Screens — Landing, Wizard, Listen, Library, Auth, Shared
// Uses components registered on window: Nav, Button, Pill, Badge, GenerationCard,
// StepIndicator, StyleCard, VoiceRow, ProgressStrip, ChapterChecklist, AudioPlayer,
// ErrorBox, FeedbackButtons.

const SAMPLE_GENERATIONS = [
  { id: "g1", title: "The physics of fermentation", date: "Apr 12", duration: "18 min", status: "complete" },
  { id: "g2", title: "How central banks actually set interest rates", date: "Apr 11", duration: null, status: "drafting" },
  { id: "g3", title: "Who actually built the English common law", date: "Apr 9", duration: "42 min", status: "complete" },
  { id: "g4", title: "A short history of the container ship", date: "Apr 5", duration: "22 min", status: "complete" },
  { id: "g5", title: "Sourdough — the microbiology", date: "Apr 2", duration: null, status: "failed" },
];

// ---------- Landing (logged-out) ----------
function LandingOut({ go }) {
  return (
    <div>
      <Nav variant="marketing" onNavigate={go} />
      <main className="max-w-2xl mx-auto px-6 py-32 text-center">
        <h1 className="animate-fade-rise font-display font-normal text-5xl leading-[1.05] tracking-tight text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Any topic. Narrated in minutes.
        </h1>
        <p className="animate-fade-rise-delay text-lg text-neutral-500 mt-6 leading-relaxed">
          Type a subject. Choose how deep to go. Receive a polished, narrated audio briefing — structured like a real podcast, written in any style you want.
        </p>
        <div className="animate-fade-rise-delay-2 mt-10">
          <Button size="lg" onClick={() => go("/signup")}>Get started free</Button>
        </div>
      </main>
    </div>
  );
}

// ---------- Landing (logged-in) ----------
function LandingIn({ go }) {
  const recent = SAMPLE_GENERATIONS.slice(0, 3);
  return (
    <div>
      <Nav variant="app" onNavigate={go} />
      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif" }}>Recent briefings</h2>
          <Button size="sm" onClick={() => go("/new")}>New briefing</Button>
        </div>
        {recent.length === 0 ? (
          <div className="border border-neutral-100 rounded-xl py-20 text-center">
            <p className="text-sm text-neutral-500 mb-4">You haven't generated any briefings yet.</p>
            <Button onClick={() => go("/new")}>Start your first</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((g) => (
              <GenerationCard key={g.id} {...g} onClick={() => go("/listen/" + g.id)} />
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <a href="#" onClick={(e) => { e.preventDefault(); go("/library"); }} className="text-sm text-neutral-400 hover:text-neutral-900 transition-colors">
            View all →
          </a>
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
  const FieldLabel = ({ children }) => <div className="text-base font-medium text-neutral-900">{children}</div>;

  return (
    <div>
      <Nav variant="minimal" onNavigate={go} />
      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-10"><StepIndicator current={step} /></div>

        {step === 0 && (
          <Section>
            <FieldLabel>What do you want to learn about?</FieldLabel>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="e.g. Why the Dutch Republic became a financial superpower"
              className="w-full border border-neutral-200 rounded-lg p-3 text-base resize-none outline-none focus:border-neutral-900 transition-colors"
            />
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">Length</div>
              <div className="flex gap-2">
                {["5", "20", "60"].map((l) => (
                  <Pill key={l} selected={length === l} onClick={() => setLength(l)}>{l} min</Pill>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">Familiarity</div>
              <div className="flex gap-2">
                {["Beginner", "Intermediate", "Advanced"].map((f) => (
                  <Pill key={f} selected={familiarity === f} onClick={() => setFamiliarity(f)}>{f}</Pill>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">Intent</div>
              <div className="grid grid-cols-2 gap-2">
                {["Just curious", "For work", "Comparing options", "Deep dive"].map((i) => (
                  <Pill key={i} selected={intent === i} onClick={() => setIntent(i)}>{i}</Pill>
                ))}
              </div>
            </div>
            <Button full onClick={() => setStep(1)}>Continue</Button>
          </Section>
        )}

        {step === 1 && (
          <Section>
            <div>
              <FieldLabel>Writing style</FieldLabel>
              <p className="text-sm text-neutral-500 mt-1">Name an author, publication, or describe a style.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                placeholder="e.g. The New Yorker, Michael Lewis, dryly funny"
                className="flex-1 h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-900 transition-colors"
              />
              <Button variant="outline" onClick={() => setAnalyzed(true)}>Analyze</Button>
            </div>
            {analyzed && (
              <div className="animate-fade-rise space-y-4">
                <StyleCard
                  opening="Drop the reader in the middle of a scene."
                  structure="Three-act — scene, context, implication."
                  rhythm="Short declarative sentences punctuated by long digressive ones."
                  signature="A named character; a small specific number; a dry aside."
                />
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm text-neutral-700">How formal should it feel?</label>
                    <input className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-900 transition-colors" placeholder="Answer (optional)" />
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
              {[
                ["web", "Web"],
                ["academic", "Academic papers"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <span
                    onClick={() => setSources((s) => ({ ...s, [key]: !s[key] }))}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      sources[key] ? "bg-neutral-900 border-neutral-900" : "border-neutral-300 group-hover:border-neutral-500"
                    }`}
                  >
                    {sources[key] && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className="text-sm text-neutral-900">{label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">Recency</div>
              <div className="flex gap-2 flex-wrap">
                {["Any time", "Past year", "Past month", "Past week"].map((r) => (
                  <Pill key={r} selected={recency === r} onClick={() => setRecency(r)}>{r}</Pill>
                ))}
              </div>
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
            <div className="space-y-2">
              {voices.map((v) => (
                <VoiceRow key={v.name} {...v} selected={voice === v.name} onClick={() => setVoice(v.name)} />
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">Continue</Button>
            </div>
          </Section>
        )}

        {step === 4 && (
          <Section>
            <FieldLabel>Review</FieldLabel>
            <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
              {[
                ["Topic", topic || "—"],
                ["Length", length + " min"],
                ["Familiarity", familiarity],
                ["Intent", intent],
                ["Style", styleInput || "Default editorial"],
                ["Voice", voice],
                ["Sources", Object.entries(sources).filter(([,v]) => v).map(([k]) => k).join(", ") + " · " + recency],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-neutral-500">{k}</span>
                  <span className="text-sm text-neutral-900 text-right max-w-[60%] truncate">{v}</span>
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
  // 'new' id starts in progress and auto-advances
  const isNew = id === "new";
  const [stageIdx, setStageIdx] = React.useState(isNew ? 1 : 4);
  const [complete, setComplete] = React.useState(!isNew);

  React.useEffect(() => {
    if (!isNew) return;
    const ticks = [
      [1500, () => setStageIdx(2)],
      [3000, () => setStageIdx(3)],
      [5000, () => setComplete(true)],
    ];
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
    <div>
      <Nav variant={shared ? "minimal" : "listen"} onNavigate={go} />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-normal leading-snug text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Why the Dutch Republic became a financial superpower
          </h1>
          <p className="text-sm text-neutral-400 mt-1">18 min · Intermediate · Just curious</p>
        </header>

        {!complete ? (
          <div className="space-y-10">
            <div className="space-y-3">
              <ProgressStrip stages={stages} current={stageIdx} />
              <p className="text-sm text-neutral-500">
                {stages[stageIdx]} <span className="text-neutral-400">· {Math.min(stageIdx + 1, 5)}/5 stages</span>
              </p>
            </div>
            <ChapterChecklist chapters={chapters} />
          </div>
        ) : (
          <div className="space-y-10">
            <AudioPlayer duration={1082} />
            <div>
              <h3 className="text-sm font-medium text-neutral-600 mb-3">Chapters</h3>
              <ol className="space-y-2">
                {chapters.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm text-neutral-700">
                    <span className="text-neutral-300 tabular-nums w-4 shrink-0">{i + 1}</span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ol>
            </div>
            <details className="group">
              <summary className="text-sm text-neutral-400 hover:text-neutral-900 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                Read script
              </summary>
              <div className="mt-4 text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Instrument Serif', serif", fontSize: "15px" }}>
{`In 1602 a handful of Amsterdam merchants did something unusual. They pooled their money, not for a single voyage, but for everything — every ship, every warehouse, every contract for as long as the company existed.

They called it the Vereenigde Oostindische Compagnie. The initials, VOC, would become the most valuable four letters in seventeenth-century finance...`}
              </div>
            </details>
            {shared && (
              <div className="pt-6 border-t border-neutral-100">
                <FeedbackButtons />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Library ----------
function Library({ go }) {
  return (
    <div>
      <Nav variant="app" onNavigate={go} />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl mb-8 text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif" }}>Your library</h1>
        <div className="space-y-3">
          {SAMPLE_GENERATIONS.map((g) => (
            <GenerationCard key={g.id} {...g} onClick={() => go("/listen/" + g.id)} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ---------- Auth ----------
function AuthPage({ mode, go }) {
  const isLogin = mode === "login";
  return (
    <div>
      <Nav variant="minimal" onNavigate={go} />
      <main className="max-w-sm mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <div className="text-4xl text-neutral-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>Bartlett</div>
          <p className="text-sm text-neutral-500">{isLogin ? "Welcome back." : "Create your account."}</p>
        </div>
        <div className="space-y-4">
          <Button variant="outline" full>
            <span className="mr-2">G</span> Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <div className="flex-1 h-px bg-neutral-200" />
            <span>or</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-neutral-700">Email</label>
              <input type="email" className="mt-1 w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-900 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-neutral-700">Password</label>
              <input type="password" className="mt-1 w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none focus:border-neutral-900 transition-colors" />
            </div>
          </div>
          <Button full onClick={() => go("/in")}>{isLogin ? "Sign in" : "Create account"}</Button>
          <p className="text-sm text-neutral-500 text-center">
            {isLogin ? "No account? " : "Already have an account? "}
            <a href="#" onClick={(e) => { e.preventDefault(); go(isLogin ? "/signup" : "/login"); }} className="underline text-neutral-900">
              {isLogin ? "Sign up" : "Sign in"}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { LandingOut, LandingIn, Wizard, Listen, Library, AuthPage, SAMPLE_GENERATIONS });
