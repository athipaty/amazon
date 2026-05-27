import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AmazonPrimeBadge() {
  return (
    <span className="inline-flex flex-col items-center leading-none select-none" title="Amazon Prime">
      <span
        style={{ background: '#00A8E0', fontFamily: 'Georgia, serif' }}
        className="text-white text-[9px] font-extrabold italic tracking-widest px-2 pt-[3px] pb-[1px] rounded-t-sm"
      >
        prime
      </span>
      <svg viewBox="0 0 40 8" className="w-8" style={{ display: 'block', marginTop: '-1px' }} aria-hidden="true">
        <path d="M2 2 Q10 7 20 5 Q30 3 38 6" fill="none" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" />
        <polygon points="35,3 39,6 35.5,8" fill="#FF9900" />
      </svg>
    </span>
  );
}

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
  const [allExpanded, setAllExpanded] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);

  function toggleExpand(idx) {
    setAllExpanded(prev => !prev);
    setActiveIdx(idx);
  }
  const [editingEbay, setEditingEbay] = useState(false);
  const [ebayInput, setEbayInput] = useState('');
  const [savingEbay, setSavingEbay] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [refreshResults, setRefreshResults] = useState({}); // id -> 'ok' | 'fail'
  const [ebayPushResults, setEbayPushResults] = useState({}); // id -> 'ok' | 'fail'
  const [linkStatus, setLinkStatus] = useState(''); // '' | 'pushing' | 'ok' | 'fail'
  const [ebayListingTitle, setEbayListingTitle] = useState(null);
  const [generatedEbayTitle, setGeneratedEbayTitle] = useState(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  const groupEbayId = variants.find(v => v.ebayListingId)?.ebayListingId || null;
  const anySyncFailed = ebayFailedIds && variants.some(v => ebayFailedIds.has(String(v._id)));
  const [ebayLivePrices, setEbayLivePrices] = useState(null);
  const [autoSyncErrors, setAutoSyncErrors] = useState({}); // variantId -> error string
  const autoSyncDone = useRef(false);

  useEffect(() => {
    if (!groupEbayId) { setEbayListingTitle(null); return; }
    fetch(`${API}/api/ebay/all-active-listings`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const match = data.find(l => String(l.listingId) === String(groupEbayId));
          setEbayListingTitle(match?.title || null);
        }
      })
      .catch(() => {});
  }, [groupEbayId]);

  async function fetchEbayPrices() {
    if (!groupEbayId) return;
    try {
      const r = await fetch(`${API}/api/ebay/listing/${groupEbayId}/prices`);
      const d = await r.json();
      setEbayLivePrices(d);
    } catch {}
  }

  useEffect(() => {
    fetchEbayPrices();
  }, [groupEbayId]);

  // Auto-fix mismatched eBay prices as soon as live prices are fetched
  useEffect(() => {
    if (!ebayLivePrices || !groupEbayId || autoSyncDone.current) return;
    autoSyncDone.current = true;

    const mismatches = variants.filter(v => {
      const calcPrice = Math.floor(v.current * 1.45) + 0.99;
      const livePrice = getLivePrice(v.variant || '');
      return livePrice != null && Math.abs(livePrice - calcPrice) >= 0.02;
    });
    if (!mismatches.length) return;

    const ids = new Set(mismatches.map(v => v._id));
    setRefreshingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setAutoSyncErrors({});

    Promise.all(mismatches.map(async v => {
      const calcPrice = Math.floor(v.current * 1.45) + 0.99;
      try {
        const r = await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: groupEbayId, price: calcPrice, variantLabel: v.variant || '' }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setAutoSyncErrors(prev => ({ ...prev, [v._id]: body.error || `HTTP ${r.status}` }));
        }
      } catch (e) {
        setAutoSyncErrors(prev => ({ ...prev, [v._id]: e.message || 'Network error' }));
      }
    })).finally(() => {
      setRefreshingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      // Re-fetch actual eBay prices to confirm what really changed (don't trust optimistic update)
      setTimeout(fetchEbayPrices, 4000);
    });
  }, [ebayLivePrices]); // autoSyncDone ref prevents looping when fetchEbayPrices re-sets ebayLivePrices

  async function handleCheckOne(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const updated = await onCheck(id);
      if (updated?.current != null && groupEbayId) {
        const newCalcPrice = Math.floor(updated.current * 1.45) + 0.99;
        const variantLabel = variants.find(v => v._id === id)?.variant || '';
        const r = await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: groupEbayId, price: newCalcPrice, variantLabel }),
        });
        if (r.ok) {
          setEbayPushResults(prev => ({ ...prev, [id]: 'ok' }));
          // eBay has propagation delay — update display state optimistically
          const label = variantLabel.toLowerCase();
          setEbayLivePrices(prev => {
            if (!prev) return prev;
            if (prev.variations?.length) {
              return {
                ...prev,
                variations: prev.variations.map(v => {
                  const hit = Object.values(v.specs).some(val =>
                    val === label || label.includes(val) || val.includes(label)
                  );
                  return hit ? { ...v, price: newCalcPrice } : v;
                }),
              };
            }
            return { ...prev, base: newCalcPrice };
          });
        } else {
          setEbayPushResults(prev => ({ ...prev, [id]: 'fail' }));
          await fetchEbayPrices();
        }
      }
      setRefreshResults(prev => ({ ...prev, [id]: 'ok' }));
    } catch {
      setRefreshResults(prev => ({ ...prev, [id]: 'fail' }));
    } finally {
      setRefreshingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setTimeout(() => {
        setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
        setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
      }, 6000);
    }
  }

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

  async function openEbayEdit(prefill) {
    setEbayInput(prefill || '');
    setEditingEbay(true);
    try {
      const r = await fetch(`${API}/api/ebay/all-active-listings`);
      const data = await r.json();
      setMyListings(Array.isArray(data) ? data : []);
    } catch { setMyListings([]); }
  }

  async function saveEbayListing() {
    setSavingEbay(true);
    setLinkStatus('');
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
      if (id) {
        setLinkStatus('pushing');
        let anyFail = false;
        for (const v of variants) {
          const calcPrice = Math.floor(v.current * 1.45) + 0.99;
          const r = await fetch(`${API}/api/ebay/listing/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId: id, price: calcPrice, variantLabel: v.variant || '' }),
          });
          if (!r.ok) anyFail = true;
        }
        setLinkStatus(anyFail ? 'fail' : 'ok');
        setTimeout(() => setLinkStatus(''), 5000);
      }
    } finally { setSavingEbay(false); }
  }

  async function generateEbayTitle() {
    setGeneratingTitle(true);
    setGeneratedEbayTitle(null);
    setCopiedTitle(false);
    try {
      const r = await fetch(`${API}/api/tracker/ebay-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, specs: active.specs, variant: active.variant, upc: active.upc }),
      });
      const data = await r.json();
      setGeneratedEbayTitle(data.title || null);
    } catch {
      setGeneratedEbayTitle(null);
    } finally {
      setGeneratingTitle(false);
    }
  }

  function copyTitle() {
    if (!generatedEbayTitle) return;
    navigator.clipboard.writeText(generatedEbayTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
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

  const allUnavailable = variants.every(v => v.status === 'unavailable');
  const allOOS = variants.every(v => v.status === 'out_of_stock');
  const someIssue = variants.some(v => v.status && v.status !== 'active');
  const groupStatus = allUnavailable ? 'unavailable' : allOOS ? 'out_of_stock' : someIssue ? 'partial' : 'active';

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
          {ebayListingTitle && (
            <p
              className={`text-xs mt-0.5 truncate ${ebayListingTitle.length > 80 ? 'text-red-500' : 'text-gray-500'}`}
              title={`${ebayListingTitle} (${ebayListingTitle.length}/80)`}
            >
              <span className="font-semibold text-[#e53238] mr-1">eBay</span>
              {ebayListingTitle.length > 80
                ? <>{ebayListingTitle.slice(0, 80)}<span className="text-red-400"> +{ebayListingTitle.length - 80} over</span></>
                : ebayListingTitle}
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
              {variants.length} variants
            </span>
            {variants.some(v => v.isPrime) && <AmazonPrimeBadge />}
            <button
              onClick={generateEbayTitle}
              disabled={generatingTitle}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {generatingTitle ? '⏳' : '✨'} eBay Title
            </button>
          </div>
        </div>
        <button onClick={confirmDeleteAll} title="Stop tracking all variants"
          className="text-gray-300 hover:text-red-500 transition-colors text-sm flex-shrink-0">✕</button>
      </div>

      {/* ── Product status banner ── */}
      {groupStatus === 'unavailable' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>🔴</span>
          <span className="font-medium">Product unavailable</span>
          <span className="text-red-400 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'out_of_stock' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
          <span>🟡</span>
          <span className="font-medium">Out of stock on Amazon</span>
          <span className="text-amber-500 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'partial' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
          <span>⚠️</span>
          <span className="font-medium">Some variants unavailable</span>
        </div>
      )}

      {/* ── eBay sync failure warning ── */}
      {anySyncFailed && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>⚠️ eBay price sync failed</span>
          <a
            href={`${API}/api/ebay/auth/login`}
            className="font-semibold underline whitespace-nowrap hover:text-red-800"
          >
            Reconnect eBay →
          </a>
        </div>
      )}

      {/* ── Variant swatches ── */}
      <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1">
        {variants.map((v, i) => {
          const label = v.variant || `Variant ${i + 1}`;
          const calcPrice = Math.floor(v.current * 1.45) + 0.99;
          const livePrice = getLivePrice(v.variant || label);
          const synced = livePrice != null && Math.abs(livePrice - calcPrice) < 0.02;
          const isRefreshing = refreshingIds.has(v._id);
          const result = refreshResults[v._id];
          const ebayPush = ebayPushResults[v._id];
          const isActive = i === activeIdx;

          return (
            <div
              key={v._id}
              onClick={() => toggleExpand(i)}
              title={label}
              className={`relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#e53238] bg-[#fff5f5]'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {/* ── Sync indicator — always visible top-right ── */}
              {livePrice != null && (
                <span className={`absolute top-0.5 right-0.5 text-[8px] font-bold leading-none ${synced ? 'text-green-500' : 'text-red-500'}`}>
                  {synced ? '✓' : '✗'}
                </span>
              )}

              {/* ── Collapsed: image + label only ── */}
              {v.image && (
                <img src={v.image} alt={label} className="w-5 h-5 object-contain rounded flex-shrink-0" />
              )}
              <span className={`font-medium truncate max-w-[60px] text-[10px] text-center ${isActive ? 'text-[#e53238]' : 'text-gray-700'}`}>
                {label}
              </span>

              {/* ── Expanded details ── */}
              {allExpanded && (
                <>
                  {v.status === 'out_of_stock' && (
                    <span className="text-[8px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-0.5 leading-tight">OOS</span>
                  )}
                  {(v.status === 'unavailable' || v.status === 'error') && (
                    <span className="text-[8px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-0.5 leading-tight">N/A</span>
                  )}
                  <span className="text-[9px] text-gray-400 font-mono">{v.currency}{v.current.toFixed(2)}</span>
                  <span className={`text-[9px] font-mono font-semibold ${isActive ? 'text-[#e53238]' : 'text-gray-600'}`}>
                    {v.currency}{calcPrice.toFixed(2)}
                  </span>
                  {isRefreshing ? (
                    <span className="text-[9px] font-mono text-yellow-500">…</span>
                  ) : livePrice != null ? (
                    <span className={`text-[9px] font-mono ${synced ? 'text-green-600' : 'text-red-500'}`}>
                      {v.currency}{livePrice.toFixed(2)}
                    </span>
                  ) : null}
                  {autoSyncErrors[v._id] && (
                    <span className="text-[8px] text-red-600 bg-red-50 border border-red-200 rounded px-0.5 leading-tight">⚠ err</span>
                  )}
                  {v.nextCheck && (
                    <span className="text-[9px] text-gray-400 font-mono">⏱{countdowns[i] || '…'}</span>
                  )}
                  {ebayPush === 'fail' && (
                    <a href={`${API}/api/ebay/auth/login`} onClick={e => e.stopPropagation()}
                      className="text-[9px] text-yellow-700 underline whitespace-nowrap">
                      Reconnect →
                    </a>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                    disabled={isRefreshing}
                    title={`Refresh ${label}`}
                    className={`mt-0.5 self-stretch flex items-center justify-center rounded text-[10px] py-0.5 transition-all ${
                      isRefreshing ? 'bg-blue-100 text-blue-600 border border-blue-300 cursor-not-allowed'
                      : result === 'ok' && ebayPush === 'ok' ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                      : result === 'ok' && ebayPush === 'fail' ? 'bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100'
                      : result === 'fail' ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200 hover:text-gray-600'
                    }`}
                  >
                    <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
                      {result === 'ok' && ebayPush === 'ok' ? '✓'
                        : result === 'ok' && ebayPush === 'fail' ? '⚠'
                        : result === 'fail' ? '✗'
                        : '🔄'}
                    </span>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <a href={active.url?.startsWith('http') ? active.url : `https://${active.url}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
          Amazon ↗
        </a>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(active.upc || active.title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-[#e53238] border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
          eBay ↗
        </a>
        {editingEbay ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            {myListings.length > 0 && (
              <select
                autoFocus
                className="w-52 px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#e53238] bg-white"
                value={ebayInput}
                onChange={e => setEbayInput(e.target.value)}
                disabled={savingEbay}
              >
                <option value="">— pick a listing —</option>
                {myListings.map(l => (
                  <option key={l.listingId} value={l.listingId}>
                    {l.listingId} · {(l.title || '').slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="or paste ID / URL"
                value={ebayInput}
                onChange={e => setEbayInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEbayListing(); if (e.key === 'Escape') setEditingEbay(false); }}
                className="w-52 px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#e53238]"
                disabled={savingEbay}
              />
              <button onClick={saveEbayListing} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#e53238] text-white text-xs hover:bg-red-700 disabled:opacity-40 transition-colors">✓</button>
              <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs hover:bg-gray-200 transition-colors">✕</button>
            </div>
          </div>
        ) : groupEbayId ? (
          <div className="inline-flex items-center gap-1.5">
            <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[#e53238] text-white hover:bg-red-700 transition-colors whitespace-nowrap">
              My Listing ↗
            </a>
            <button onClick={() => openEbayEdit(groupEbayId)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-[13px] transition-colors" title="Edit eBay listing">✏️</button>
          </div>
        ) : (
          <button onClick={() => openEbayEdit('')}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-[#e53238] hover:text-[#e53238] transition-colors whitespace-nowrap">
            + Link My Listing
          </button>
        )}
        {linkStatus === 'pushing' && (
          <span className="text-xs text-blue-500 whitespace-nowrap">Pushing prices…</span>
        )}
        {linkStatus === 'ok' && (
          <span className="text-xs text-green-600 whitespace-nowrap">Prices updated ✓</span>
        )}
        {linkStatus === 'fail' && (
          <span className="text-xs text-red-500 whitespace-nowrap">Price push failed ⚠</span>
        )}
        <button onClick={() => setShowSpecs(s => !s)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap px-2 py-1 rounded-full hover:bg-gray-100">
          <span className="text-[10px]">{showSpecs ? '▲' : '▼'}</span> specs
        </button>
      </div>

      {/* ── Generated eBay title ── */}
      {generatedEbayTitle && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wide mb-0.5">
              eBay Title · <span className={generatedEbayTitle.length > 80 ? 'text-red-500' : 'text-violet-500'}>{generatedEbayTitle.length}/80</span>
            </p>
            <p className="text-xs text-gray-800 break-words">{generatedEbayTitle}</p>
          </div>
          <button
            onClick={copyTitle}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
              copiedTitle
                ? 'bg-green-100 text-green-600 border border-green-200'
                : 'bg-violet-100 text-violet-600 border border-violet-300 hover:bg-violet-200'
            }`}
          >
            {copiedTitle ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      )}

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
