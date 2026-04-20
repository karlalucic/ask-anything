// StepIndicator.jsx, StyleCard.jsx, VoiceRow.jsx
const WIZARD_STEPS = ["Topic", "Style", "Sources", "Voice", "Review"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      {WIZARD_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <span className={i === current ? "text-neutral-900 font-medium" : "text-neutral-400"}>{s}</span>
          {i < WIZARD_STEPS.length - 1 && <span className="text-neutral-200">›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function StyleCard({ opening, structure, rhythm, signature }) {
  const rows = [
    ["Opening", opening],
    ["Structure", structure],
    ["Rhythm", rhythm],
    ["Signature moves", signature],
  ];
  return (
    <div className="border border-neutral-100 rounded-xl p-5 bg-neutral-50 space-y-3">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Style card</div>
      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="font-medium text-neutral-900">{k}. </span>
            <span className="text-neutral-600">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoiceRow({ name, description, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ${
        selected
          ? "bg-neutral-900 border-neutral-900 text-white"
          : "bg-white border-neutral-200 hover:border-neutral-400"
      }`}
    >
      <span className="text-sm font-medium">{name}</span>
      <span className={`text-sm ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{description}</span>
    </button>
  );
}

Object.assign(window, { StepIndicator, StyleCard, VoiceRow, WIZARD_STEPS });
