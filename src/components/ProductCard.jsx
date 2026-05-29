import { useState, useEffect } from 'react';

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

function AmazonPrimeBadge() {
  return (
    <span className="inline-flex flex-col items-center leading-none select-none" title="Amazon Prime">
      {/* "prime" wordmark on blue pill */}
      <span
        style={{ background: '#00A8E0', fontFamily: 'Georgia, serif' }}
        className="text-white text-[9px] font-extrabold italic tracking-widest px-2 pt-[3px] pb-[1px] rounded-t-sm"
      >
        prime
      </span>
      {/* Amazon smile arrow */}
      <svg
        viewBox="0 0 40 8"
        className="w-8"
        style={{ display: 'block', marginTop: '-1px' }}
        aria-hidden="true"
      >
        <path
          d="M2 2 Q10 7 20 5 Q30 3 38 6"
          fill="none"
          stroke="#FF9900"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <polygon points="35,3 39,6 35.5,8" fill="#FF9900" />
      </svg>
    </span>
  );
}

function PrimeVariantBadges({ isPrime, variant, upc }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Prime + UPC row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isPrime
          ? <AmazonPrimeBadge />
          : <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded leading-none">no prime</span>
        }
        {upc && (
          <span className="text-[10px] text-gray-400 font-mono">UPC: {upc}</span>
        )}
      </div>
      {/* Size — prominent pill */}
      {variant && (
        <span
          className="inline-block self-start text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full leading-tight"
          title={variant}
        >
          📦 {variant}
        </span>
      )}
    </div>
  );
}

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
            <span className="text-[10px] text-gray-400 leading-tight">
              {new Date(entry.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SKIP_SPEC_KEYS = new Set(['asin', 'upc']);

function fmtKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') {
    return Object.entries(v)
      .filter(([, val]) => val != null)
      .map(([k, val]) => `${fmtKey(k)}: ${val}`)
      .join(' · ');
  }
  return String(v);
}

function SpecsGrid({ specs, upc }) {
  if (!specs && !upc) return null;
  const entries = specs
    ? Object.entries(specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
      {upc && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">UPC</span>
          <span className="text-xs text-gray-700 font-mono">{upc}</span>
        </div>
      )}
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">{fmtKey(k)}</span>
          <span className="text-xs text-gray-700 break-words">{fmtVal(v)}</span>
        </div>
      ))}
      {!upc && entries.length === 0 && (
        <span className="text-xs text-gray-400 col-span-full">No spec data available.</span>
      )}
    </div>
  );
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ProductCard({ product, onCheck, onDelete, onUpdate, ebayFailed }) {
  const [checking, setChecking] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [editingEbay, setEditingEbay] = useState(false);
  const [ebayInput, setEbayInput] = useState('');
  const [savingEbay, setSavingEbay] = useState(false);
  const [linkStatus, setLinkStatus] = useState(''); // '' | 'pushing' | 'ok' | 'fail'
  const [autoListing, setAutoListing] = useState(false);
  const [autoListStep, setAutoListStep] = useState(''); // 'title' | 'listing' | 'saving'
  const [autoListError, setAutoListError] = useState('');
  const { _id, title, url, currency, current, lowest, history } = product;

  const countdown = useCountdown(product.nextCheck);
  const isAtLowest = current <= lowest;
  const firstPrice = history?.[0]?.price;
  const hasDrop = firstPrice && current < firstPrice;
  const dropPct = hasDrop ? Math.round(((firstPrice - current) / firstPrice) * 100) : 0;

  function confirmDelete() {
    if (window.confirm(`Stop tracking "${title}"?`)) onDelete(_id);
  }

  async function saveEbayListing() {
    setSavingEbay(true);
    setLinkStatus('');
    try {
      const id = ebayInput.trim().replace(/.*\/itm\/(\d+).*/,'$1');
      const res = await fetch(`${API}/api/tracker/${_id}/ebay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebayListingId: id || null }),
      });
      const updated = await res.json();
      onUpdate?.(updated);
      setEditingEbay(false);
      if (id) {
        setLinkStatus('pushing');
        const calcPrice = Math.floor(current * 1.45) + 0.99;
        const r = await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: id, price: calcPrice, variantLabel: product.variant || '' }),
        });
        setLinkStatus(r.ok ? 'ok' : 'fail');
        setTimeout(() => setLinkStatus(''), 5000);
      }
    } finally { setSavingEbay(false); }
  }

  async function autoListOnEbay() {
    setAutoListing(true);
    setAutoListError('');
    setLinkStatus('');
    try {
      // Step 1: Generate SEO title
      setAutoListStep('title');
      const titleRes = await fetch(`${API}/api/ebay/seo-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, specs: product.specs }),
      });
      const titleData = await titleRes.json();
      const ebayTitle = titleData.title || title;

      // Step 2: Upload images to Cloudinary so eBay can access them
      setAutoListStep('images');
      const rawImages = [...new Set([
        ...(product.images || []),
        ...(product.image ? [product.image] : []),
      ])].slice(0, 6);
      let cloudinaryUrls = [];
      if (rawImages.length) {
        const slug = (product.specs?.asin || String(_id).slice(-8)).toLowerCase().replace(/[^a-z0-9]/g, '');
        const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrls: rawImages, slug }),
        });
        const uploadData = await uploadRes.json();
        cloudinaryUrls = uploadData.cloudinaryUrls || [];
      }

      // Step 3: Create eBay listing via Trading API
      setAutoListStep('listing');
      const calcPrice = (Math.floor(current * 1.45) + 0.99).toFixed(2);
      const listRes = await fetch(`${API}/api/ebay/trading-create-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ebayTitle,
          price: calcPrice,
          imageUrls: cloudinaryUrls,
          upc: product.upc,
          specs: product.specs || {},
        }),
      });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error || 'eBay listing failed');

      // Step 4: Save listing ID back to product
      setAutoListStep('saving');
      const saveRes = await fetch(`${API}/api/tracker/${_id}/ebay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebayListingId: listData.listingId }),
      });
      const updated = await saveRes.json();
      onUpdate?.(updated);
    } catch (e) {
      setAutoListError(e.message.slice(0, 300));
    } finally {
      setAutoListing(false);
      setAutoListStep('');
    }
  }

  const lowestText = isAtLowest ? '✅ Lowest ever' : `Low: ${currency}${lowest.toLocaleString()}`;

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-sm flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 p-3 lg:px-4 lg:py-3 ${isAtLowest ? 'border-green-400' : 'border-gray-200'}`}>

      {/* ── Image + Title + Badges ── */}
      <div className="flex items-start gap-3 min-w-0">
        {product.image
          ? <img src={product.image} alt={title} className="w-12 h-12 object-contain rounded-lg bg-gray-50 flex-shrink-0" />
          : <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
        }
        <div className="flex-1 lg:w-56 lg:flex-none min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={title}>{title}</p>
          <div className="mt-0.5">
            <PrimeVariantBadges isPrime={product.isPrime} variant={product.variant} upc={product.upc} />
          </div>
        </div>
      </div>

      {/* ── Price + drop badge + lowest (mobile inline) ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span className={`text-xl font-black tracking-tight ${isAtLowest ? 'text-green-700' : 'text-gray-900'}`}>
            {currency}{current.toLocaleString()}
          </span>
          {hasDrop && (
            <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">▼{dropPct}%</span>
          )}
        </div>
        <p className="lg:hidden text-xs text-gray-400">{lowestText}</p>
      </div>

      {/* ── Price history ── */}
      <PriceHistory history={history} currency={currency} />

      {/* ── Lowest + countdown — desktop only ── */}
      <p className="hidden lg:block text-xs text-gray-400 flex-shrink-0 w-28 text-right">{lowestText}</p>
      {product.nextCheck && (
        <p className="hidden lg:block text-xs text-gray-300 flex-shrink-0 w-16 text-right font-mono">
          {countdown || 'soon'}
        </p>
      )}

      {/* ── Countdown — mobile only ── */}
      {product.nextCheck && (
        <p className="lg:hidden text-xs text-gray-300 font-mono">Next: {countdown || 'soon'}</p>
      )}

      {/* ── eBay sync failure warning ── */}
      {ebayFailed && (
        <div className="w-full flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>⚠️</span> eBay price sync failed — check your listing or reconnect eBay.
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-col gap-2 w-full lg:w-48 lg:flex-shrink-0">

        {/* Row 1: External links */}
        <div className="grid grid-cols-2 gap-2">
          <a href={url?.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center py-2 rounded-lg border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-600 active:bg-orange-100">
            🛒 Amazon
          </a>
          <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product.upc || title)}&_sop=15`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-[#e53238] active:bg-red-100">
            🏷️ eBay
          </a>
        </div>

        {/* Row 2: My eBay listing */}
        {editingEbay ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus type="text" placeholder="Listing ID or URL"
              value={ebayInput}
              onChange={e => setEbayInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEbayListing(); if (e.key === 'Escape') setEditingEbay(false); }}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#e53238]"
              disabled={savingEbay}
            />
            <button onClick={saveEbayListing} disabled={savingEbay}
              className="p-2.5 bg-[#e53238] text-white rounded-lg disabled:opacity-40">✓</button>
            <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
              className="p-2.5 bg-gray-100 text-gray-500 rounded-lg">✕</button>
          </div>
        ) : product.ebayListingId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e53238]/20 bg-[#fff5f5]">
            <a href={`https://www.ebay.com/itm/${product.ebayListingId}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-xs font-semibold text-[#e53238]">
              My eBay Listing →
            </a>
            <button onClick={() => { setEbayInput(product.ebayListingId); setEditingEbay(true); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg" title="Change listing">✏️</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button onClick={autoListOnEbay} disabled={autoListing || !product.isPrime}
              title={!product.isPrime ? 'Prime required to list on eBay' : undefined}
              className="w-full py-2 rounded-lg bg-[#e53238] text-xs font-semibold text-white hover:bg-[#c0272d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
              {autoListing
                ? (autoListStep === 'title' ? '✍️ Generating title…'
                  : autoListStep === 'images' ? '📸 Uploading images…'
                  : autoListStep === 'listing' ? '📤 Creating listing…'
                  : '💾 Saving…')
                : !product.isPrime ? '🚫 No Prime — Cannot List' : '🚀 Auto-List on eBay'}
            </button>
            <button onClick={() => { setEbayInput(''); setEditingEbay(true); }}
              className="text-[10px] text-gray-400 text-center hover:text-[#e53238] transition-colors py-0.5">
              + link existing listing
            </button>
            {autoListError && (
              <p className="text-[10px] text-red-500 leading-tight break-words">{autoListError}</p>
            )}
          </div>
        )}

        {linkStatus === 'pushing' && <p className="text-xs text-blue-500 text-center">Pushing price…</p>}
        {linkStatus === 'ok' && <p className="text-xs text-green-600 text-center">Price updated ✓</p>}
        {linkStatus === 'fail' && <p className="text-xs text-red-500 text-center">Price push failed ⚠</p>}

        {/* Row 3: Utilities */}
        <div className="flex items-center gap-2">
          <button onClick={async () => { setChecking(true); await onCheck(_id); setChecking(false); }}
            disabled={checking}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors">
            {checking ? '⏳' : '🔄'} {checking ? 'Checking…' : 'Refresh'}
          </button>
          <button onClick={() => setShowSpecs(s => !s)}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
            {showSpecs ? '▲' : '▼'} Specs
          </button>
          <button onClick={confirmDelete} title="Stop tracking"
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            ✕
          </button>
        </div>

      </div>

      {/* ── Amazon Specs Panel ── */}
      {showSpecs && (
        <div className="w-full border-t border-gray-100 pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">Product Specs</p>
          <SpecsGrid specs={product.specs} upc={product.upc} />
        </div>
      )}

    </div>
  );
}
