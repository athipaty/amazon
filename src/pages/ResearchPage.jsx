// Standalone "should I list this?" lookup — paste any Amazon URL and see eBay competitor
// pricing before deciding whether it's even worth tracking. Read-only: unlike AddProductPanel,
// nothing here gets saved — it just calls the same /preview endpoint to pull title/price/UPC.
//
// Flow: paste a link -> see how many variants it has -> pick one from the sidebar -> deep-research
// that single variant on the right. Competitor data is only ever fetched for the selected variant,
// never for all of them at once, so a 20-variant listing doesn't hammer eBay's rate limits.
import { useState } from 'react';
import axios from 'axios';
import FadeImg from '../components/FadeImg';
import CompetitorPriceCheck from '../components/CompetitorPriceCheck';
import useCompetitorCheck from '../hooks/useCompetitorCheck';
import { calcEbayPrice } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResearchPage() {
  const [url, setUrl] = useState('');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null); // { title, price, currency, image, upc, isPrime, variants }
  const [showVariants, setShowVariants] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const variants = product?.variants || [];
  const hasVariants = variants.length > 1;
  // What's being researched right now: the selected variant, or the base product itself
  // when the listing has no real variants to choose between.
  const active = hasVariants
    ? variants[selectedIndex]
    : product ? { label: product.title, price: product.price, image: product.image } : null;

  const activeTitle = showVariants && active
    ? (hasVariants
        ? [product.title.split(' ').slice(0, 4).join(' '), active.label].filter(Boolean).join(' ')
        : product.title)
    : null;
  const activeUpc = showVariants && !hasVariants ? product?.upc : null;

  const { comp, sold, compLoading } = useCompetitorCheck(activeTitle, activeUpc);
  // Amazon frequently doesn't expose a price for every combination in a large variant matrix
  // (confirmed live: a 37-variant listing came back with price:null on every single variant) —
  // fall back to the anchor listing's own price as a same-ballpark estimate rather than letting
  // the whole comparison go silent for products like this.
  const activePriceIsEstimate = hasVariants && active?.price == null && product?.price != null;
  const activePrice = active?.price ?? (hasVariants ? product?.price ?? null : null);
  const estYourPrice = activePrice != null ? calcEbayPrice(activePrice) : null;

  async function handleLookup(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || looking) return;
    setLooking(true);
    setError('');
    setProduct(null);
    setShowVariants(false);
    setSelectedIndex(0);
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      setProduct(data);
      // Nothing to pick between for a single-variant listing — skip straight to research.
      if ((data.variants?.length || 0) <= 1) setShowVariants(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not fetch that product.');
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Research</h1>
      <p className="text-sm text-slate-400 mb-4">Check eBay competitor pricing before you commit to tracking or listing a product.</p>

      <form className="flex gap-2 mb-5" onSubmit={handleLookup}>
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
          <input
            type="text"
            placeholder="Paste an Amazon product URL to research…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={looking}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 placeholder:text-slate-400 shadow-soft"
          />
        </div>
        <button
          type="submit"
          disabled={looking || !url.trim()}
          className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
        >
          {looking ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <p className="text-red-500 text-sm mb-4 px-1">{error}</p>}

      {product && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up">
          {/* Step 1: summary — image, title, price range, variant count */}
          <div className="flex items-start gap-3">
            {product.image && (
              <FadeImg src={product.image} alt={product.title} className="w-14 h-14 object-contain rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">
                  {hasVariants ? `${variants.length} variants found` : (product.price != null ? `${product.currency}${product.price.toLocaleString()}` : 'Price varies')}
                </p>
                {product.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{product.title}</p>
            </div>
          </div>

          {/* Step 2 gate: only shown for multi-variant listings — nothing to pick otherwise */}
          {hasVariants && !showVariants && (
            <button
              onClick={() => setShowVariants(true)}
              className="mt-3 px-4 py-2 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] transition-all shadow-soft"
            >
              View All Variants →
            </button>
          )}

          {/* Step 3: sidebar (variant picker) + right-hand deep-research panel */}
          {showVariants && (
            <div className={`mt-4 grid gap-4 ${hasVariants ? 'md:grid-cols-[260px_1fr]' : 'grid-cols-1'}`}>
              {hasVariants && (
                <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin border-r border-slate-100 md:pr-3">
                  {variants.map((v, i) => (
                    <button
                      key={v.asin || i}
                      onClick={() => setSelectedIndex(i)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        i === selectedIndex ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      {v.image && (
                        <FadeImg src={v.image} alt={v.label} className="w-8 h-8 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                      )}
                      <span className="text-xs text-slate-700 flex-1 truncate">{v.label}</span>
                      {v.price != null
                        ? <span className="text-xs font-bold text-slate-900 flex-shrink-0">{product.currency}{v.price.toLocaleString()}</span>
                        : <span className="text-xs text-slate-300 flex-shrink-0">price varies</span>
                      }
                    </button>
                  ))}
                </div>
              )}

              <div>
                {active && (
                  <div className="flex items-center gap-3 mb-3">
                    {active.image && (
                      <FadeImg src={active.image} alt={active.label} className="w-12 h-12 object-contain rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{active.label}</p>
                      {activePrice != null && (
                        <p className="text-xs text-slate-400">
                          {product.currency}{activePrice.toLocaleString()} on Amazon
                          {activePriceIsEstimate && ' (base listing price — this variant\'s own price isn\'t available)'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <CompetitorPriceCheck title={activeTitle} comp={comp} sold={sold} compLoading={compLoading} estYourPrice={estYourPrice} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
