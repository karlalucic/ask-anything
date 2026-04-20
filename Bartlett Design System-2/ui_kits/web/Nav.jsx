// Nav.jsx — marketing / app / minimal variants
function Nav({ variant = "marketing", onNavigate }) {
  const go = (p) => (e) => { e.preventDefault(); onNavigate?.(p); };
  return (
    <header className="border-b border-neutral-100">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#" onClick={go("/")} className="font-display text-xl tracking-tight text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Bartlett
        </a>
        {variant === "marketing" && (
          <div className="flex items-center gap-3">
            <a href="#" onClick={go("/login")} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">Sign in</a>
            <Button size="sm" onClick={() => onNavigate?.("/signup")}>Get started</Button>
          </div>
        )}
        {variant === "app" && (
          <div className="flex items-center gap-4">
            <a href="#" onClick={go("/library")} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">Library</a>
            <Button size="sm" onClick={() => onNavigate?.("/new")}>New briefing</Button>
          </div>
        )}
        {variant === "listen" && (
          <div className="flex items-center gap-4">
            <a href="#" onClick={go("/library")} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">Library</a>
            <Button size="sm" variant="outline">Share</Button>
          </div>
        )}
        {variant === "minimal" && <span className="text-xs text-neutral-400">·</span>}
      </div>
    </header>
  );
}

Object.assign(window, { Nav });
