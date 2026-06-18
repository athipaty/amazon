import { calcEbayPrice, calcEbayFee, trueCost } from '../utils/pricing';
import Countdown from './Countdown';

// Grid of per-variant tiles on a group card: a full price/profit/sync
// breakdown per tile in detail mode, or a compact swatch grid (with an
// expandable info row per tile) in the sidebar/list view.
export default function VariantSwatchGrid({
  variants, detailMode, activeIdx, toggleExpand, allExpanded,
  refreshingIds, refreshResults, ebayPushResults, autoSyncErrors,
  getLivePrice, handleCheckOne, saleMode, apiUrl,
  onDeleteVariant, deletingVariantId,
  groupEbayId, ebayPricesFetched, onAddVariantToEbay, addingToEbayId, addToEbayErrors,
}) {
  return (
    <div className={`grid gap-2 ${detailMode ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1'}`}>
      {variants.map((v, i) => {
        const label     = v.variant || `Variant ${i + 1}`;
        const calcPrice = calcEbayPrice(v.current, saleMode);
        const ebayFee   = calcEbayFee(calcPrice);
        const profit    = +(calcPrice - trueCost(v.current) - ebayFee).toFixed(2);
        const marginPct = ((profit / calcPrice) * 100).toFixed(1);
        const livePrice = getLivePrice(v.variant || label);
        const synced    = livePrice != null && Math.abs(livePrice - calcPrice) < 0.02;
        const isRefreshing = refreshingIds.has(v._id);
        const result = refreshResults[v._id];
        const ebayPush = ebayPushResults[v._id];
        const isActive = i === activeIdx;
        const isDeleting = deletingVariantId === v._id;

        // ── DETAIL MODE: full card with labeled price rows ──────────
        if (detailMode) return (
          <div
            key={v._id}
            onClick={() => toggleExpand(i)}
            className={`relative flex flex-col rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
              isDeleting ? 'border-red-300 opacity-50' :
              isActive ? 'border-ebay shadow-card' : 'border-slate-200 hover:border-slate-300 hover:shadow-soft'
            }`}
          >
            {/* Delete X button */}
            {onDeleteVariant && (
              <button
                onClick={e => { e.stopPropagation(); onDeleteVariant(v._id); }}
                disabled={!!deletingVariantId}
                title="Remove this variant"
                className="absolute top-1 left-1 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white/80 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors text-[10px] leading-none shadow-sm"
              >
                {isDeleting ? (
                  <svg className="animate-spin w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                ) : '✕'}
              </button>
            )}
            {/* Image */}
            <div className={`flex items-center justify-center p-2.5 ${isActive ? 'bg-red-50/60' : 'bg-slate-50'}`}>
              {v.image
                ? <img src={v.image} alt={label} className="w-16 h-16 object-contain" />
                : <div className="w-16 h-16 bg-slate-100 rounded-xl" />
              }
            </div>

            {/* Label */}
            <div className={`px-2 py-1.5 text-center border-b ${isActive ? 'bg-red-50/60 border-red-100' : 'bg-white border-slate-100'}`}>
              <span className={`text-xs font-bold ${isActive ? 'text-ebay' : 'text-slate-800'}`}>{label}</span>
              {v.status === 'out_of_stock' && <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded px-1">OOS</span>}
              {(v.status === 'unavailable' || v.status === 'error') && <span className="ml-1 text-[9px] font-bold text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-1">N/A</span>}
              {groupEbayId && ebayPricesFetched && (
                livePrice != null
                  ? <span className="ml-1 text-[9px] font-bold text-ebay bg-red-50 ring-1 ring-inset ring-ebay/30 rounded px-1">eBay ✓</span>
                  : <span className="ml-1 text-[9px] font-semibold text-slate-400 bg-slate-50 ring-1 ring-inset ring-slate-200 rounded px-1">Not listed</span>
              )}
            </div>

            {/* Price rows */}
            <div className="px-2.5 py-2.5 flex flex-col gap-1 bg-white">
              {/* Amazon */}
              <div className="flex items-center justify-end lg:justify-between gap-1">
                <span className="hidden lg:inline text-[9px] font-bold text-amazon-dark bg-orange-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">Amazon</span>
                <span className="text-sm font-bold text-slate-900">{v.currency}{v.current != null ? v.current.toFixed(2) : '—'}</span>
              </div>


              {/* Live eBay price */}
              {isRefreshing ? (
                <div className="flex items-center justify-end lg:justify-between gap-1">
                  <span className="hidden lg:inline text-[9px] font-bold text-ebay bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                  <span className="text-xs text-amber-500">…</span>
                </div>
              ) : livePrice != null ? (
                <div className="flex items-center justify-end lg:justify-between gap-1">
                  <span className="hidden lg:inline text-[9px] font-bold text-ebay bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                  <span className={`text-sm font-bold ${synced ? 'text-emerald-600' : 'text-red-500'}`}>
                    {v.currency}{livePrice.toFixed(2)}
                  </span>
                </div>
              ) : null}

              {/* Profit row */}
              <div className={`flex items-center justify-end lg:justify-between px-1.5 py-1.5 rounded-lg mt-1 ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className={`hidden lg:inline text-[9px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>{marginPct}%</span>
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-black ${profit >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{v.currency}{profit.toFixed(2)}
                  </span>
                  <span className={`lg:hidden text-[9px] font-semibold ${profit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{marginPct}%</span>
                </div>
              </div>

              {/* Countdown + refresh */}
              <div className="flex flex-col gap-1.5 mt-0.5 pt-1.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  {v.nextCheck
                    ? <span className="text-[10px] text-slate-400 font-mono">⏱ <Countdown target={v.nextCheck} /></span>
                    : <span />
                  }
                  {autoSyncErrors[v._id] && (
                    <span className="text-[9px] text-orange-500">⚠</span>
                  )}
                  {ebayPush === 'fail' && (
                    <a href={`${apiUrl}/api/ebay/auth/login`} onClick={e => e.stopPropagation()}
                      className="text-[9px] text-amber-700 underline font-medium">Reconnect</a>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                  disabled={isRefreshing}
                  className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                    isRefreshing ? 'text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 cursor-not-allowed'
                    : result === 'ok' && ebayPush === 'ok' ? 'text-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
                    : result === 'ok' && ebayPush === 'fail' ? 'text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-300'
                    : result === 'fail' ? 'text-red-500 bg-red-50 ring-1 ring-inset ring-red-200'
                    : 'text-slate-400 bg-slate-100 ring-1 ring-inset ring-slate-200 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
                    {result === 'ok' && ebayPush === 'ok' ? '✓' : result === 'ok' && ebayPush === 'fail' ? '⚠' : result === 'fail' ? '✗' : '🔄'}
                  </span>
                </button>
                {groupEbayId && ebayPricesFetched && livePrice === null && onAddVariantToEbay && (
                  <button
                    onClick={e => { e.stopPropagation(); onAddVariantToEbay(v._id); }}
                    disabled={addingToEbayId === v._id}
                    title="Add this variant to the eBay listing"
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all bg-ebay/10 text-ebay ring-1 ring-inset ring-ebay/30 hover:bg-ebay/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingToEbayId === v._id ? 'Adding…' : '+ Add to eBay'}
                  </button>
                )}
                {addToEbayErrors?.[v._id] && (
                  <p className="text-[9px] text-red-500 text-center leading-tight">{addToEbayErrors[v._id]}</p>
                )}
              </div>
            </div>
          </div>
        );

        // ── COMPACT MODE: original tiny grid tile ──────────────────
        return (
          <div
            key={v._id}
            onClick={() => toggleExpand(i)}
            title={label}
            className={`relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg border transition-colors cursor-pointer ${
              isDeleting ? 'border-red-300 opacity-50' :
              isActive ? 'border-ebay bg-red-50/60' : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            {groupEbayId && ebayPricesFetched && (
              livePrice != null
                ? <span className={`absolute top-0.5 right-0.5 text-[8px] font-bold leading-none ${synced ? 'text-emerald-500' : 'text-red-500'}`}>{synced ? '✓' : '✗'}</span>
                : <span className="absolute top-0.5 right-0.5 text-[8px] font-bold leading-none text-slate-300">○</span>
            )}
            {v.image && <img src={v.image} alt={label} className="w-5 h-5 object-contain rounded flex-shrink-0" />}
            <span className={`font-medium truncate max-w-[60px] text-[10px] text-center ${isActive ? 'text-ebay' : 'text-slate-700'}`}>{label}</span>
            {allExpanded && (
              <>
                {v.status === 'out_of_stock' && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded px-0.5 leading-tight">OOS</span>}
                {(v.status === 'unavailable' || v.status === 'error') && <span className="text-[8px] font-bold text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-0.5 leading-tight">N/A</span>}
                <span className="text-[9px] text-slate-400 font-mono">{v.currency}{v.current != null ? v.current.toFixed(2) : '—'}</span>
                {isRefreshing ? <span className="text-[9px] font-mono text-amber-500">…</span>
                  : livePrice != null ? <span className={`text-[9px] font-mono ${synced ? 'text-emerald-600' : 'text-red-500'}`}>{v.currency}{livePrice.toFixed(2)}</span>
                  : null}
                {autoSyncErrors[v._id] && <span className="text-[8px] text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-0.5 leading-tight">⚠ err</span>}
                {v.nextCheck && <span className="text-[9px] text-slate-400 font-mono">⏱<Countdown target={v.nextCheck} /></span>}
                {ebayPush === 'fail' && (
                  <a href={`${apiUrl}/api/ebay/auth/login`} onClick={e => e.stopPropagation()} className="text-[9px] text-amber-700 underline whitespace-nowrap font-medium">Reconnect →</a>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                  disabled={isRefreshing}
                  className={`mt-0.5 self-stretch flex items-center justify-center rounded text-[10px] py-0.5 transition-all ring-1 ring-inset ${
                    isRefreshing ? 'bg-blue-100 text-blue-600 ring-blue-300 cursor-not-allowed'
                    : result === 'ok' && ebayPush === 'ok' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200 hover:bg-emerald-100'
                    : result === 'ok' && ebayPush === 'fail' ? 'bg-amber-50 text-amber-700 ring-amber-300 hover:bg-amber-100'
                    : result === 'fail' ? 'bg-red-50 text-red-500 ring-red-200 hover:bg-red-100'
                    : 'bg-slate-100 text-slate-400 ring-slate-200 hover:bg-slate-200 hover:text-slate-600'
                  }`}
                >
                  <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
                    {result === 'ok' && ebayPush === 'ok' ? '✓' : result === 'ok' && ebayPush === 'fail' ? '⚠' : result === 'fail' ? '✗' : '🔄'}
                  </span>
                </button>
                {onDeleteVariant && (
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteVariant(v._id); }}
                    disabled={!!deletingVariantId}
                    title="Remove this variant"
                    className="mt-0.5 self-stretch flex items-center justify-center rounded text-[10px] py-0.5 transition-all ring-1 ring-inset bg-slate-50 text-slate-300 ring-slate-200 hover:bg-red-50 hover:text-red-500 hover:ring-red-200"
                  >
                    {isDeleting ? (
                      <svg className="animate-spin w-2.5 h-2.5 text-red-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    ) : '✕'}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
