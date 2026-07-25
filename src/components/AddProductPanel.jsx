// URL input + the "N variants found — select which to track" preview panel shown
// after pasting a multi-variant Amazon listing URL.
import { useMemo, useState } from 'react';
import FadeImg from './FadeImg';
import CompetitorPriceCheck from './CompetitorPriceCheck';
import useCompetitorCheck from '../hooks/useCompetitorCheck';
import { calcEbayPrice } from '../utils/pricing';

export default function AddProductPanel({
  url, setUrl, adding, addError, preview, previewRef,
  handleAdd, handleTrackSelected,
  selectedAsins, toggleVariant, setSelectedAsins,
  addingVariants, addProgress,
  setPreview, trackedAsins,
  relatedCheck, setRelatedCheck, onTrackRelated,
}) {
  const [relatedTrackingAsin, setRelatedTrackingAsin] = useState(null);
  const [copiedAsin, setCopiedAsin] = useState(null);

  async function handleTrackRelatedItem(deal) {
    setRelatedTrackingAsin(deal.asin);
    try {
      await onTrackRelated(deal.url);
    } finally {
      setRelatedTrackingAsin(null);
    }
  }

  async function handleCopyRelatedUrl(deal) {
    try {
      await navigator.clipboard.writeText(deal.url);
      setCopiedAsin(deal.asin);
      setTimeout(() => setCopiedAsin(null), 1500);
    } catch { /* clipboard unavailable — no-op */ }
  }

  // Extract unique dimensions (e.g. Color, Size) from variant attributes
  const dimensions = useMemo(() => {
    if (!preview?.variants?.length) return [];
    const seen = new Set();
    const dims = [];
    for (const v of preview.variants) {
      for (const a of (v.attributes || [])) {
        if (a.dimension && !seen.has(a.dimension)) { seen.add(a.dimension); dims.push(a.dimension); }
      }
    }
    return dims;
  }, [preview]);

  // Price range across preview variants (for header display)
  const priceRange = useMemo(() => {
    if (!preview?.variants?.length) return null;
    const prices = preview.variants.map(v => v.price).filter(p => p != null);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const c = preview.currency || '$';
    return min === max ? `${c}${min.toLocaleString()}` : `${c}${min.toLocaleString()}–${c}${max.toLocaleString()}`;
  }, [preview]);

  // Estimated eBay listing price if we track this at today's Amazon price (cost-plus formula)
  const estYourPrice = useMemo(() => {
    if (!preview?.variants?.length) return null;
    const prices = preview.variants.map(v => v.price).filter(p => p != null);
    if (!prices.length) return null;
    const avgAmazon = prices.reduce((a, b) => a + b, 0) / prices.length;
    return calcEbayPrice(avgAmazon);
  }, [preview]);

  // Competitor pricing check — opt-in via the toggle below, so pasting a URL to track doesn't
  // fire an eBay call before you've actually decided you want to look.
  const [showResearch, setShowResearch] = useState(false);
  const { comp, sold, compLoading } = useCompetitorCheck(showResearch ? preview?.title : null, showResearch ? preview?.upc : null);

  // Ordered unique values per dimension
  const dimValues = useMemo(() => {
    const map = {};
    for (const dim of dimensions) {
      const seen = new Set();
      map[dim] = [];
      for (const v of (preview?.variants || [])) {
        const val = v.attributes?.find(a => a.dimension === dim)?.value;
        if (val && !seen.has(val)) { seen.add(val); map[dim].push(val); }
      }
    }
    return map;
  }, [dimensions, preview]);

  function toggleByDimension(dim, val) {
    const matching = (preview?.variants || [])
      .filter(v => !trackedAsins?.has(v.asin) && v.attributes?.some(a => a.dimension === dim && a.value === val))
      .map(v => v.asin);
    const allSel = matching.length > 0 && matching.every(a => selectedAsins.has(a));
    const next = new Set(selectedAsins);
    matching.forEach(a => allSel ? next.delete(a) : next.add(a));
    setSelectedAsins(next);
  }

  const isMultiDim = dimensions.length >= 2;

  return (
    <>
      <div className="mb-4">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
            <input
              type="text"
              placeholder="Paste an Amazon product URL to track…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onPaste={e => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted && !adding && !preview) {
                  e.preventDefault();
                  setUrl(pasted);
                  handleAdd({ preventDefault: () => {} }, pasted);
                }
              }}
              disabled={adding || !!preview}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 placeholder:text-slate-400 shadow-soft"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !url.trim() || !!preview}
            className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
          >
            {adding ? 'Loading…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2 px-1">{addError}</p>}
      </div>

      {relatedCheck && (
        <div className="mb-5 bg-white border border-slate-100 rounded-2xl p-4 shadow-soft animate-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Related items on this product's page
              <span className="ml-2 font-normal normal-case text-slate-300">under $30</span>
            </p>
            <button
              onClick={() => setRelatedCheck(null)}
              className="text-slate-300 hover:text-slate-500 text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          {relatedCheck.loading && (
            <p className="text-sm text-slate-400 mt-2">Checking… (live page fetch, can take up to 30s)</p>
          )}
          {relatedCheck.error && <p className="text-sm text-red-500 mt-2">{relatedCheck.error}</p>}
          {relatedCheck.deals && (
            relatedCheck.deals.length === 0 ? (
              <p className="text-sm text-slate-400 mt-2">No under-$30 matches in that carousel.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left pb-1.5 pr-2">Item</th>
                      <th className="text-right pb-1.5 px-2">Price</th>
                      <th className="text-right pb-1.5 px-2">Rating</th>
                      <th className="text-left pb-1.5 px-2">Qty options</th>
                      <th className="pb-1.5 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedCheck.deals.map(deal => {
                      const alreadyTracked = trackedAsins?.has(deal.asin);
                      return (
                      <tr key={deal.asin} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-2">
                          <a href={deal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
                            {deal.image && (
                              <FadeImg src={deal.image} alt={deal.title} className="w-10 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                            )}
                            <span className="text-xs text-slate-700 font-medium leading-snug line-clamp-2 min-w-0">{deal.title}</span>
                            {deal.hasAmazonChoice && (
                              <span className="flex-shrink-0 inline-flex items-center bg-purple-50 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">Choice</span>
                            )}
                          </a>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900 whitespace-nowrap">{deal.currency}{deal.price.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          {deal.rating ? (
                            <span className="text-slate-500">★ {deal.rating} <span className="text-slate-300">({deal.reviewCount?.toLocaleString()})</span></span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {deal.qtyVariants?.length > 0 ? (
                            <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{deal.qtyVariants.join(', ')} pcs</span>
                          ) : (
                            <span className="text-slate-300 text-xs">single</span>
                          )}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => handleCopyRelatedUrl(deal)}
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-lg hover:bg-slate-200 active:scale-[0.98] transition-all whitespace-nowrap"
                            >
                              {copiedAsin === deal.asin ? '✓ Copied' : '🔗 Copy URL'}
                            </button>
                            <button
                              onClick={() => handleTrackRelatedItem(deal)}
                              disabled={alreadyTracked || relatedTrackingAsin === deal.asin}
                              className="px-2.5 py-1.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-[11px] rounded-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                            >
                              {alreadyTracked ? '✓ Tracked' : relatedTrackingAsin === deal.asin ? 'Adding…' : 'Track Price'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {preview && (
        <div ref={previewRef} className="mb-5 bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up">
          <div className="flex justify-between items-start mb-1">
            {preview.image && (
              <FadeImg src={preview.image} alt={preview.title} className="w-14 h-14 object-contain rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0 mr-3" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">
                  {preview.variants.length} variants found
                  {priceRange && <span className="text-slate-500 font-normal ml-1.5">· {priceRange}</span>}
                  {trackedAsins && preview.variants.filter(v => trackedAsins.has(v.asin)).length > 0 && (
                    <span className="text-slate-400 font-normal ml-1">
                      ({preview.variants.filter(v => trackedAsins.has(v.asin)).length} already tracking)
                    </span>
                  )}
                </p>
                {preview.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
                {preview.fulfillment?.isAmazonFulfilled === true && (
                  <span
                    title={`Ships from: ${preview.fulfillment.shipsFrom?.trim() || 'Amazon'} · Sold by: ${preview.fulfillment.soldBy || 'unknown'}. eBay can't validate Amazon Logistics (TBA…) tracking numbers, so orders for this item are likely to hurt your "tracking uploaded and validated" rate.`}
                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ring-amber-200 cursor-help"
                  >
                    ⚠️ Amazon-fulfilled
                  </span>
                )}
                {preview.fulfillment?.isAmazonFulfilled === false && (
                  <span
                    title={`Ships from and sold by ${preview.fulfillment.soldBy || 'the seller'} — real carrier tracking, should validate fine on eBay.`}
                    className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200 cursor-help"
                  >
                    ✓ Ships from seller
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{preview.title}</p>
            </div>
            <button
              onClick={() => { setPreview(null); setSelectedAsins(new Set()); setShowResearch(false); }}
              className="text-slate-300 hover:text-slate-500 text-xl leading-none ml-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          {/* eBay competitor pricing check — opt-in, doesn't fetch until you ask for it */}
          <div className="mt-2 mb-1">
            <button onClick={() => setShowResearch(s => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap px-2.5 py-1 rounded-full hover:bg-slate-100">
              <span className="text-[10px]">{showResearch ? '▲' : '▼'}</span> 🔎 Research
            </button>
            {showResearch && (
              <div className="mt-1.5">
                <CompetitorPriceCheck title={preview.title} comp={comp} sold={sold} compLoading={compLoading} estYourPrice={estYourPrice} />
              </div>
            )}
          </div>

          {/* Dimension filter buttons — only shown when product has 2+ dimensions (e.g. Color + Size) */}
          {isMultiDim && (
            <div className="mt-3 mb-2 space-y-2 border-b border-slate-100 pb-3">
              {dimensions.map(dim => (
                <div key={dim} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-10 flex-shrink-0">{dim}</span>
                  {dimValues[dim].map(val => {
                    const matching = (preview.variants || [])
                      .filter(v => !trackedAsins?.has(v.asin) && v.attributes?.some(a => a.dimension === dim && a.value === val))
                      .map(v => v.asin);
                    const allSel = matching.length > 0 && matching.every(a => selectedAsins.has(a));
                    const someSel = !allSel && matching.some(a => selectedAsins.has(a));
                    return (
                      <button
                        key={val}
                        onClick={() => toggleByDimension(dim, val)}
                        disabled={addingVariants || matching.length === 0}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                          allSel
                            ? 'bg-amazon border-amazon text-white font-bold shadow-sm'
                            : someSel
                            ? 'bg-amber-50 border-amber-400 text-slate-800 font-medium'
                            : matching.length === 0
                            ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {preview.variants.map(v => {
              const alreadyTracked = trackedAsins?.has(v.asin);
              return (
              <label
                key={v.asin}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${alreadyTracked ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAsins.has(v.asin)}
                  onChange={e => toggleVariant(v.asin, e.target.checked)}
                  disabled={alreadyTracked}
                  className="w-4 h-4 accent-amazon flex-shrink-0"
                />
                {v.image && (
                  <FadeImg src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                )}
                <span className="text-sm text-slate-700 flex-1">{v.label}</span>
                {alreadyTracked && (
                  <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200 flex-shrink-0">✓ Tracking</span>
                )}
                {preview.isPrime && !alreadyTracked && (
                  <span className="inline-flex items-center gap-0.5 bg-[#00A8E0] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">✓ Prime</span>
                )}
                {v.price != null
                  ? <span className="text-sm font-bold text-slate-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                  : <span className="text-xs text-slate-400 flex-shrink-0">price varies</span>
                }
              </label>
            );})}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {selectedAsins.size === 0 && !addingVariants && (
              <p className="text-sm text-amber-600 font-medium">Select at least one variant to track</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleTrackSelected}
                disabled={addingVariants || selectedAsins.size === 0}
                className="px-4 py-2 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft"
              >
                {addingVariants ? addProgress : selectedAsins.size === 0 ? 'Track Selected' : `Track Selected (${selectedAsins.size})`}
              </button>
              <button
                onClick={() => setSelectedAsins(new Set(preview.variants.filter(v => !trackedAsins?.has(v.asin)).map(v => v.asin)))}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAsins(new Set())}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
