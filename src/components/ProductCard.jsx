import { useState, useEffect } from 'react';
import axios from 'axios';

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

function PrimeVariantBadges({ isPrime, variant, upc }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {isPrime
        ? <span className="text-[10px] font-extrabold italic tracking-wide text-white bg-[#00A8E0] px-1.5 py-0.5 rounded leading-none">prime</span>
        : <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded leading-none">no prime</span>
      }
      {variant && (
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded leading-none truncate max-w-[80px]" title={variant}>
          {variant}
        </span>
      )}
      {upc && (
        <span className="text-[10px] text-gray-400 font-mono">UPC: {upc}</span>
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

// Finds any item_dimensions_* key dynamically — Amazon uses many naming variations
function getDimensions(s) {
  if (!s) return null;
  const key = Object.keys(s).find(k => k.startsWith('item_dimensions') || k === 'product_dimensions');
  return key ? s[key] : null;
}

const EBAY_FIELDS = [
  ['Brand',             s => s?.brand_name],
  ['Type',              s => s?.item_type_name || s?.type],
  ['Material',          s => s?.material || s?.material_type],
  ['Color',             s => s?.color],
  ['Style',             s => s?.style],
  ['Shape',             s => s?.shape],
  ['Pattern',           s => s?.pattern],
  ['Size',              s => s?.size],
  ['Dimensions',        s => getDimensions(s)],
  ['Making Method',     s => s?.making_method],
  ['Country of Origin', s => s?.country_of_origin || s?.country_of_manufacture],
  ['No. of Items',      s => s?.number_of_items_in_set || s?.number_of_packs || s?.unit_count],
  ['MPN',               s => s?.model_number || s?.part_number],
  ['Item Weight',       s => s?.item_weight],
  ['Wattage',           s => s?.wattage],
  ['Voltage',           s => s?.voltage],
];

export default function ProductCard({ product, index = 0, onCheck, onDelete }) {
  const [checking, setChecking] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [ebay, setEbay] = useState(null);
  const [ebayLoading, setEbayLoading] = useState(true);
  const { _id, title, url, currency, current, lowest, history } = product;

  useEffect(() => {
    const q = product.upc || title;
    if (!q) return;
    const delay = index * 1200; // 1.2s between each card to avoid rate limits
    const timer = setTimeout(() => {
      axios.get(`${API}/api/ebay/sold`, { params: { q } })
        .then(({ data }) => { if (data.count > 0) setEbay(data); })
        .catch(() => {})
        .finally(() => setEbayLoading(false));
    }, delay);
    return () => clearTimeout(timer);
  }, [_id]);

  const countdown = useCountdown(product.nextCheck);
  const isAtLowest = current <= lowest;
  const firstPrice = history?.[0]?.price;
  const hasDrop = firstPrice && current < firstPrice;
  const dropPct = hasDrop ? Math.round(((firstPrice - current) / firstPrice) * 100) : 0;

  function confirmDelete() {
    if (window.confirm(`Stop tracking "${title}"?`)) onDelete(_id);
  }

  const lowestText = isAtLowest ? '✅ Lowest ever' : `Low: ${currency}${lowest.toLocaleString()}`;

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-sm flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-4 lg:px-4 lg:py-3 ${isAtLowest ? 'border-green-400' : 'border-gray-200'}`}>

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
        {/* Delete — mobile only, top-right */}
        <button onClick={confirmDelete} title="Stop tracking"
          className="lg:hidden text-gray-300 hover:text-red-500 transition-colors text-sm flex-shrink-0">
          ✕
        </button>
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

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <a href={url?.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline whitespace-nowrap">
          Amazon →
        </a>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product.upc || title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs font-semibold text-[#e53238] hover:underline whitespace-nowrap">
          eBay →
        </a>
        <button onClick={async () => { setChecking(true); await onCheck(_id); setChecking(false); }}
          disabled={checking}
          className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
          title="Check price now">
          {checking ? '⏳' : '🔄'}
        </button>
        <button onClick={() => setShowSpecs(s => !s)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">
          {showSpecs ? '▲ specs' : '▼ specs'}
        </button>
        {/* Delete — desktop only */}
        <button onClick={confirmDelete} title="Stop tracking"
          className="hidden lg:block text-gray-300 hover:text-red-500 transition-colors text-sm">
          ✕
        </button>
      </div>

      {/* ── eBay Profit Strip ── */}
      {ebayLoading && !ebay && (
        <div className="w-full border-t border-gray-100 pt-2 mt-1">
          <span className="text-[10px] text-gray-300">fetching eBay sold price…</span>
        </div>
      )}
      {ebay && (() => {
        const profit = ebay.avg - current;
        const pct = Math.round((profit / current) * 100);
        const pos = profit > 0;
        return (
          <div className="w-full border-t border-gray-100 pt-2 mt-1 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">eBay sold</span>
            <span className="text-xs font-bold text-gray-700">{currency}{ebay.avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pos ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
              {pos ? '+' : ''}{currency}{profit.toFixed(2)} ({pos ? '+' : ''}{pct}%)
            </span>
            <span className="text-[10px] text-gray-300">{ebay.count} recent sales</span>
          </div>
        );
      })()}

      {/* ── eBay Specs Panel ── */}
      {showSpecs && (
        <div className="w-full border-t border-gray-100 pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">eBay listing specs</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">UPC</span>
              <span className="text-xs text-gray-700 font-mono">{product.upc || 'N/A'}</span>
            </div>
            {EBAY_FIELDS.map(([label, getter]) => {
              const val = getter(product.specs);
              return (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
                  <span className="text-xs text-gray-700">{val || 'N/A'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
