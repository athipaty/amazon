import { fmtKey, fmtVal, SKIP_SPEC_KEYS } from '../utils/productGroupHelpers';

// Expandable specs grid for the active variant — UPC plus any non-skip spec keys.
export default function SpecsPanel({ active, activeIdx }) {
  const specEntries = active.specs
    ? Object.entries(active.specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];

  return (
    <div className="border-t border-slate-100 pt-3 animate-fade-in">
      <p className="text-xs font-bold text-slate-500 mb-2.5">Specs — {active.variant || `Variant ${activeIdx + 1}`}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5">
        {active.upc && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">UPC</span>
            <span className="text-xs text-slate-700 font-mono">{active.upc}</span>
          </div>
        )}
        {specEntries.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{fmtKey(k)}</span>
            <span className="text-xs text-slate-700 break-words">{fmtVal(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
