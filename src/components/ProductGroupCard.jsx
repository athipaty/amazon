import { useState } from 'react';
import ListGroupOnEbayModal from './ListGroupOnEbayModal';

function PriceHistory({ history, currency }) {
  if (!history?.length) return null;
  const recent = [...history].reverse().slice(0, 3);
  return (
    <div className="flex gap-4 flex-shrink-0">
      {recent.map((entry, i) => {
        const older = recent[i + 1];
        const dir = older
          ? entry.price < older.price ? 'down'
          : entry.price > older.price ? 'up'
          : null : null;
        return (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
              <span className={`font-mono text-xs font-semibold ${dir === 'down' ? 'text-green-600' : dir === 'up' ? 'text-red-500' : 'text-gray-700'}`}>
                {currency}{entry.price.toLocaleString()}
              </span>
              {dir === 'down' && <span className="text-green-500 text-[10px]">↓</span>}
              {dir === 'up' && <span className="text-red-400 text-[10px]">↑</span>}
            </div>
            <span className="text-[10px] text-gray-400 leading-tight">
              {new Date(entry.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SKIP_SPEC_KEYS = new Set(['asin']);
function fmtKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val != null).map(([k, val]) => `${fmtKey(k)}: ${val}`).join(' · ');
  return String(v);
}

export default function ProductGroupCard({ variants, onCheck, onDelete }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const active = variants[activeIdx];
  const prices = variants.map(v => v.current).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = minPrice === maxPrice
    ? `${active.currency}${minPrice.toLocaleString()}`
    : `${active.currency}${minPrice.toLocaleString()} – ${active.currency}${maxPrice.toLocaleString()}`;

  const isAtLowest = active.current <= active.lowest;
  const firstPrice = active.history?.[0]?.price;
  const hasDrop = firstPrice && active.current < firstPrice;
  const dropPct = hasDrop ? Math.round(((firstPrice - active.current) / firstPrice) * 100) : 0;

  function confirmDeleteAll() {
    if (window.confirm(`Stop tracking all ${variants.length} variants of "${active.title}"?`)) {
      variants.forEach(v => onDelete(v._id));
    }
  }

  const specEntries = active.specs
    ? Object.entries(active.specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-sm flex flex-col gap-3 p-4 ${isAtLowest ? 'border-green-400' : 'border-gray-200'}`}>

      {/* ── Group header row ── */}
      <div className="flex items-start gap-3 min-w-0">
        {active.image
          ? <img src={active.image} alt={active.title} className="w-12 h-12 object-contain rounded-lg bg-gray-50 flex-shrink-0" />
          : <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={active.title}>{active.title}</p>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
            {variants.length} variants
          </span>
        </div>
        <button onClick={confirmDeleteAll} title="Stop tracking all variants"
          className="text-gray-300 hover:text-red-500 transition-colors text-sm flex-shrink-0">✕</button>
      </div>

      {/* ── Variant swatches ── */}
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v, i) => {
          const label = v.variant || `Variant ${i + 1}`;
          return (
            <button
              key={v._id}
              onClick={() => setActiveIdx(i)}
              title={label}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-colors ${
                i === activeIdx
                  ? 'border-[#e53238] bg-[#e53238]/8 text-[#e53238] font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {v.image && (
                <img src={v.image} alt={label} className="w-5 h-5 object-contain rounded flex-shrink-0" />
              )}
              <span className="max-w-[100px] truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active variant price + history ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span className={`text-xl font-black tracking-tight ${isAtLowest ? 'text-green-700' : 'text-gray-900'}`}>
            {active.currency}{active.current.toLocaleString()}
          </span>
          {hasDrop && (
            <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">▼{dropPct}%</span>
          )}
        </div>
        {variants.length > 1 && (
          <span className="text-xs text-gray-400">Range: {priceRange}</span>
        )}
        <span className="text-xs text-gray-400 flex-shrink-0">
          {isAtLowest ? '✅ Lowest ever' : `Low: ${active.currency}${active.lowest.toLocaleString()}`}
        </span>
        <PriceHistory history={active.history} currency={active.currency} />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <a href={active.url?.startsWith('http') ? active.url : `https://${active.url}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline whitespace-nowrap">
          Amazon →
        </a>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(active.upc || active.title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs font-semibold text-[#e53238] hover:underline whitespace-nowrap">
          eBay →
        </a>
        <button onClick={() => setShowModal(true)}
          className="text-xs font-semibold text-[#e53238] bg-[#e53238]/10 hover:bg-[#e53238]/20 px-2 py-0.5 rounded transition-colors whitespace-nowrap">
          + List Group
        </button>
        <button
          onClick={async () => { for (const v of variants) await onCheck(v._id); }}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors" title="Check all variants">
          🔄
        </button>
        <button onClick={() => setShowSpecs(s => !s)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">
          {showSpecs ? '▲ specs' : '▼ specs'}
        </button>
      </div>

      {/* ── Specs panel (active variant) ── */}
      {showSpecs && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Specs — {active.variant || `Variant ${activeIdx + 1}`}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            {active.upc && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">UPC</span>
                <span className="text-xs text-gray-700 font-mono">{active.upc}</span>
              </div>
            )}
            {specEntries.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{fmtKey(k)}</span>
                <span className="text-xs text-gray-700 break-words">{fmtVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ListGroupOnEbayModal variants={variants} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
