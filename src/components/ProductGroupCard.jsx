import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function useCountdown(target) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function update() {
      const diff = new Date(target) - new Date();
      if (diff <= 0) { setRemaining('soon'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

const SKIP_SPEC_KEYS = new Set(['asin']);
function fmtKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val != null).map(([k, val]) => `${fmtKey(k)}: ${val}`).join(' · ');
  return String(v);
}

export default function ProductGroupCard({ variants, onCheck, onDelete, onUpdate, ebayFailedIds }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSpecs, setShowSpecs] = useState(false);
  const [editingEbay, setEditingEbay] = useState(false);
  const [ebayInput, setEbayInput] = useState('');
  const [savingEbay, setSavingEbay] = useState(false);

  const groupEbayId = variants.find(v => v.ebayListingId)?.ebayListingId || null;
  const anySyncFailed = ebayFailedIds && variants.some(v => ebayFailedIds.has(String(v._id)));
  const [ebayLivePrices, setEbayLivePrices] = useState(null);

  useEffect(() => {
    if (!groupEbayId) { setEbayLivePrices(null); return; }
    fetch(`${API}/api/ebay/listing/${groupEbayId}/prices`)
      .then(r => r.json())
      .then(d => setEbayLivePrices(d))
      .catch(() => {});
  }, [groupEbayId]);

  function getLivePrice(variantLabel) {
    if (!ebayLivePrices) return null;
    const label = (variantLabel || '').toLowerCase();
    if (ebayLivePrices.variations?.length) {
      const match = ebayLivePrices.variations.find(v =>
        Object.values(v.specs).some(val => val === label || label.includes(val) || val.includes(label))
      );
      if (match) return match.price;
    }
    return ebayLivePrices.base || null;
  }

  async function saveEbayListing() {
    setSavingEbay(true);
    try {
      const id = ebayInput.trim().replace(/.*\/itm\/(\d+).*/,'$1');
      for (const v of variants) {
        const res = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ebayListingId: id || null }),
        });
        const updated = await res.json();
        onUpdate?.(updated);
      }
      setEditingEbay(false);
    } finally { setSavingEbay(false); }
  }

  const countdowns = [
    useCountdown(variants[0]?.nextCheck),
    useCountdown(variants[1]?.nextCheck),
    useCountdown(variants[2]?.nextCheck),
    useCountdown(variants[3]?.nextCheck),
    useCountdown(variants[4]?.nextCheck),
    useCountdown(variants[5]?.nextCheck),
    useCountdown(variants[6]?.nextCheck),
    useCountdown(variants[7]?.nextCheck),
    useCountdown(variants[8]?.nextCheck),
    useCountdown(variants[9]?.nextCheck),
  ];

  const active = variants[activeIdx];

  function confirmDeleteAll() {
    if (window.confirm(`Stop tracking all ${variants.length} variants of "${active.title}"?`)) {
      variants.forEach(v => onDelete(v._id));
    }
  }

  const specEntries = active.specs
    ? Object.entries(active.specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 transition-shadow hover:shadow-sm flex flex-col gap-3 p-4">

      {/* ── Group header ── */}
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

      {/* ── eBay sync failure warning ── */}
      {anySyncFailed && (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>⚠️</span> eBay price sync failed — check your listing or reconnect eBay.
        </div>
      )}

      {/* ── Variant swatches ── */}
      <div className="flex flex-wrap gap-2">
        {variants.map((v, i) => {
          const label = v.variant || `Variant ${i + 1}`;
          const calcPrice = Math.floor(v.current * 1.45) + 0.99;
          const livePrice = getLivePrice(v.variant || label);
          const synced = livePrice != null && Math.abs(livePrice - calcPrice) < 0.02;

          return (
            <button
              key={v._id}
              onClick={() => setActiveIdx(i)}
              title={label}
              className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg border text-xs transition-colors min-w-[80px] ${
                i === activeIdx
                  ? 'border-[#e53238] bg-[#fff5f5]'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {v.image && (
                <img src={v.image} alt={label} className="w-8 h-8 object-contain rounded self-center mb-0.5 flex-shrink-0" />
              )}
              {/* Line 1: color name */}
              <span className={`font-medium truncate max-w-[90px] ${i === activeIdx ? 'text-[#e53238]' : 'text-gray-700'}`}>
                {label}
              </span>
              {/* Line 2: Amazon price */}
              <span className="text-[10px] text-gray-400 font-mono">
                Amazon {v.currency}{v.current.toFixed(2)}
              </span>
              {/* Line 3: calculated eBay price */}
              <span className={`text-[10px] font-mono font-semibold ${i === activeIdx ? 'text-[#e53238]' : 'text-gray-600'}`}>
                Calc {v.currency}{calcPrice.toFixed(2)}
              </span>
              {/* Line 4: live eBay price + match indicator */}
              {livePrice != null && (
                <span className={`text-[10px] font-mono flex items-center gap-0.5 ${synced ? 'text-green-600' : 'text-red-500'}`}>
                  eBay {v.currency}{livePrice.toFixed(2)} {synced ? '✓' : '✗'}
                </span>
              )}
              {/* Line 5: next check countdown */}
              {v.nextCheck && (
                <span className="text-[10px] text-gray-500 font-mono">
                  ⏱ {countdowns[i] || 'soon'}
                </span>
              )}
            </button>
          );
        })}
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
        {editingEbay ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              placeholder="Listing ID or URL"
              value={ebayInput}
              onChange={e => setEbayInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEbayListing(); if (e.key === 'Escape') setEditingEbay(false); }}
              className="w-36 px-2 py-0.5 border border-gray-300 rounded text-xs outline-none focus:border-[#e53238]"
              disabled={savingEbay}
            />
            <button onClick={saveEbayListing} disabled={savingEbay}
              className="text-xs text-[#e53238] hover:text-red-700 disabled:opacity-40">✓</button>
            <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
              className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : groupEbayId ? (
          <div className="flex items-center gap-1">
            <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-[#e53238] hover:underline whitespace-nowrap">
              My Listing →
            </a>
            <button onClick={() => { setEbayInput(groupEbayId); setEditingEbay(true); }}
              className="text-gray-300 hover:text-gray-500 text-[10px]" title="Edit eBay listing">✏️</button>
          </div>
        ) : (
          <button onClick={() => { setEbayInput(''); setEditingEbay(true); }}
            className="text-xs text-gray-400 hover:text-[#e53238] whitespace-nowrap" title="Link your eBay listing">
            + My Listing
          </button>
        )}
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

      {/* ── Specs panel ── */}
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

    </div>
  );
}
