// eBay competitor pricing box — active-listing median/lowest/count, sold avg when available,
// an estimated-price-vs-median badge, and a manual sold-comps research link. Shared by
// AddProductPanel (inline, pre-tracking) and ResearchPage (standalone lookup).
export default function CompetitorPriceCheck({ title, comp, sold, compLoading, estYourPrice }) {
  return (
    <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs">
      {compLoading ? (
        <span className="text-slate-400">Checking eBay competitor prices…</span>
      ) : comp && comp.count > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-600">
            eBay active: <span className="font-bold text-slate-900">${comp.median}</span> median
            <span className="text-slate-400"> (${comp.lowest}–lowest, {comp.count} listings)</span>
          </span>
          {sold && sold.count > 0 && (
            <span className="text-slate-600">
              · Sold avg <span className="font-bold text-slate-900">${sold.avg}</span> ({sold.count} recently)
            </span>
          )}
          {estYourPrice != null && (
            estYourPrice > comp.median ? (
              <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ring-red-200">
                ⚠ your est. ${estYourPrice.toFixed(2)} is above median
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200">
                ✓ your est. ${estYourPrice.toFixed(2)} beats median
              </span>
            )
          )}
        </div>
      ) : comp && comp.count === 0 ? (
        <span className="text-slate-400">No comparable active eBay listings found — could be a low-competition niche, or low demand.</span>
      ) : null}

      {/* eBay's sold-comps API requires limited-release approval we don't have — link out to
          eBay's own sold/completed search so sold-price research stays a one-click manual step. */}
      {title && (
        <div className="mt-1.5">
          <a
            href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title.split(' ').slice(0, 6).join(' '))}&LH_Sold=1&LH_Complete=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amazon hover:underline font-medium"
          >
            🔍 Research sold prices on eBay ↗
          </a>
        </div>
      )}
    </div>
  );
}
