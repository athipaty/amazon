// eBay competitor pricing box — active-listing median/lowest/count, sold avg when available,
// an estimated-price-vs-median badge, a per-listing comparison against your own selling price
// for the cheapest 5 competitors, and a manual sold-comps research link. Shared by
// AddProductPanel (inline, pre-tracking) and ProductGroupCard (inline, on tracked products).
import FadeImg from './FadeImg';

// One listing row — used for both active competitors and sold comps. Sold items from the
// Marketplace Insights API don't reliably carry a browsable web URL (itemHref is an API
// resource id, not a page), so the row only becomes a link when the url actually looks like one.
function ListingRow({ item, subtitle, estYourPrice }) {
  const diff = estYourPrice != null ? +(estYourPrice - item.price).toFixed(2) : null;
  const clickable = item.url?.startsWith('http');
  const Tag = clickable ? 'a' : 'div';
  return (
    <Tag
      {...(clickable ? { href: item.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-100 rounded-lg transition-colors ${clickable ? 'hover:border-slate-300' : ''}`}
    >
      {item.image && (
        <FadeImg src={item.image} alt="" className="w-8 h-8 object-contain rounded bg-slate-50 border border-slate-100 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-slate-700 truncate">{item.title}</p>
        <p className="text-slate-400 truncate">{subtitle}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="font-bold text-slate-900">${item.price.toFixed(2)}</p>
        {diff != null && (
          <p className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-400'}>
            {diff > 0 ? `$${diff.toFixed(2)} cheaper` : diff < 0 ? `$${Math.abs(diff).toFixed(2)} pricier` : 'same as you'}
          </p>
        )}
      </div>
    </Tag>
  );
}

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

      {/* Cheapest 5 active listings, each compared against your own estimated price */}
      {comp?.items?.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {comp.items.map((it, i) => (
            <ListingRow
              key={it.url || i}
              item={it}
              subtitle={[it.condition, it.seller].filter(Boolean).join(' · ')}
              estYourPrice={estYourPrice}
            />
          ))}
        </div>
      )}

      {/* Most recent 5 sold, when the Marketplace Insights API is available to this account */}
      {sold?.items?.length > 0 && (
        <div className="mt-2">
          <p className="text-slate-400 font-bold uppercase tracking-wide mb-1">Recently Sold</p>
          <div className="flex flex-col gap-1.5">
            {sold.items.map((it, i) => (
              <ListingRow
                key={it.url || i}
                item={it}
                subtitle={[it.condition, it.soldDate ? new Date(it.soldDate).toLocaleDateString() : null].filter(Boolean).join(' · ')}
                estYourPrice={estYourPrice}
              />
            ))}
          </div>
        </div>
      )}

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
