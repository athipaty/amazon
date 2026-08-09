import { useState } from 'react';
import FadeImg from './FadeImg';

// Earliest listedAt across the group's variants (or the single product) — stays stable
// across relists since the automated relist-unsold cron never touches listedAt. null if
// never listed.
function getDaysListed(item) {
  const listedTimes = (item.type === 'group' ? item.variants : [item.product])
    .map(v => v?.listedAt).filter(Boolean).map(d => new Date(d).getTime());
  return listedTimes.length ? Math.max(0, Math.floor((Date.now() - Math.min(...listedTimes)) / 86400000)) : null;
}

function getEbayId(item) {
  return item.type === 'group'
    ? item.variants.find(v => v.ebayListingId)?.ebayListingId
    : item.product?.ebayListingId;
}

function fmtCompact(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// Bar length as % of the largest value currently in its bucket — so length is directly
// comparable row-to-row within that bucket, the point of a meter. Math.max floor keeps
// small-but-real values visible instead of shrinking to an invisible sliver; a true 0/null
// stays at 0 width.
function barPct(value, max) {
  if (!value || !max) return 0;
  return Math.max(4, Math.min(100, (value / max) * 100));
}

// Splits a list into 10-day-listed bands (0–9, 10–19, ...; never-listed items get their own
// band) so each band's bar meters scale to THAT band's own max instead of the whole list's —
// a handful of long-running listings were flattening every shorter one's bar to a sliver.
function bucketByDays(items) {
  const buckets = new Map(); // bucketStart (or null) -> items[]
  for (const item of items) {
    const days = getDaysListed(item);
    const start = days == null ? null : Math.floor(days / 10) * 10;
    if (!buckets.has(start)) buckets.set(start, []);
    buckets.get(start).push(item);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (b ?? -1) - (a ?? -1)) // longest band first; never-listed last
    .map(([start, bucketItems]) => ({
      label: start == null ? 'Not listed' : `${start}–${start + 9} days`,
      items: bucketItems,
    }));
}

export default function SidebarList({ items, selectedKey, onSelect, getItemKey, getItemTitle, getItemImage, getItemStatus, hasIssue, sellingLimits, ebayViews = {}, ebayWatchers = {}, ebaySold = {}, apiUrl = '', ebayConnected = true, mobile = false, blankPhotoIds = new Set() }) {
  const [search, setSearch] = useState('');
  const filtered = (search.trim()
    ? items.filter(item => getItemTitle(item).toLowerCase().includes(search.toLowerCase()))
    : items
  // Longest-listed first; never-listed items (null) sort last.
  ).slice().sort((a, b) => (getDaysListed(b) ?? -1) - (getDaysListed(a) ?? -1));

  // When `hasIssue` is provided, split into two labeled sections so problems are
  // easy to spot instead of buried among everything that's fine.
  const groups = hasIssue
    ? [
        { label: '⚠ Needs attention', items: filtered.filter(hasIssue) },
        { label: '✓ All good', items: filtered.filter(i => !hasIssue(i)) },
      ].filter(g => g.items.length)
    : [{ label: null, items: filtered }];

  function renderItem(item, maxDays, maxViews) {
    const key = getItemKey(item);
    const image = getItemImage(item);
    const title = getItemTitle(item);
    const isSelected = selectedKey === key;
    const ebayId = getEbayId(item);
    const views = ebayId != null ? ebayViews[String(ebayId)] : undefined;
    const watchers = ebayId != null ? ebayWatchers[String(ebayId)] : undefined;
    const sold = ebayId != null ? ebaySold[String(ebayId)] : undefined;
    const daysListed = getDaysListed(item);
    const hasPhotoWarning = ebayId && blankPhotoIds.has(String(ebayId));

    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        title={`${title} — ${daysListed != null ? `${daysListed}d listed` : 'not listed'}, ${views != null ? `${views} views` : 'no view data'}`}
        className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg transition-colors text-left ${isSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-400' : 'hover:bg-slate-50'}`}
      >
        <div className="relative flex-shrink-0 w-9 h-9">
          {image
            ? <FadeImg src={image} alt="" className="w-full h-full object-contain rounded-lg bg-slate-50 border border-slate-100" />
            : <div className="w-full h-full rounded-lg bg-slate-100" />
          }
          {hasPhotoWarning && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 flex items-center justify-center bg-orange-500 text-white text-[8px] rounded-full ring-2 ring-white" title="No photos on eBay listing">
              📷
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate">{title}</p>
          {(sold != null || watchers != null) && (
            <div className="flex items-center gap-2 mt-0.5">
              {sold != null && <span className="text-[9px] font-bold text-emerald-600">{fmtCompact(sold)} sold</span>}
              {watchers != null && <span className="text-[9px] font-bold text-amber-600">{fmtCompact(watchers)} watching</span>}
            </div>
          )}
        </div>

        {/* Two per-row meters — days listed (blue) and eBay views (teal) — each scaled to
            the max within this item's 10-day bucket (see bucketByDays) so lengths are
            directly comparable to its actual neighbors, not flattened by outliers. */}
        <div className="flex flex-col gap-1 w-28 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] flex-shrink-0" aria-hidden="true">📅</span>
            <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${barPct(daysListed, maxDays)}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 tabular-nums w-6 text-right flex-shrink-0">{daysListed ?? '–'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] flex-shrink-0" aria-hidden="true">👁</span>
            <div className="flex-1 h-1.5 rounded-full bg-teal-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal-600" style={{ width: `${barPct(views, maxViews)}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 tabular-nums w-6 text-right flex-shrink-0">{views != null ? fmtCompact(views) : '–'}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={mobile
      ? "flex flex-col overflow-hidden bg-white border border-slate-200/70 rounded-2xl shadow-soft"
      : "w-full sm:w-96 md:w-[30rem] lg:w-[36rem] flex-shrink-0 border border-slate-200/70 rounded-2xl overflow-hidden bg-white shadow-soft sticky top-4 max-h-[calc(100vh-120px)] flex flex-col"
    }>
      {/* Header + search */}
      <div className="px-3.5 py-3 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {items.length} listing{items.length !== 1 ? 's' : ''}
            </p>
            {sellingLimits && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ring-1 ring-inset ${
                sellingLimits.remaining <= 10 ? 'bg-red-50 text-red-600 ring-red-200' :
                sellingLimits.remaining <= 30 ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                'bg-emerald-50 text-emerald-700 ring-emerald-200'
              }`}>
                {sellingLimits.used}/{sellingLimits.limit}
              </span>
            )}
          </div>
          {ebayConnected
            ? <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-200 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
              </span>
            : <a
                href={`${apiUrl}/api/ebay/auth/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-bold text-ebay hover:text-ebay-dark bg-red-50 hover:bg-red-100 ring-1 ring-inset ring-red-200 px-1.5 py-0.5 rounded-full leading-none transition-colors whitespace-nowrap"
              >
                Reconnect eBay
              </a>
          }
        </div>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none">⌕</span>
          <input
            type="text"
            placeholder="Search listings…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 bg-white placeholder-slate-400 transition-all"
          />
        </div>
      </div>
      {/* Items — one product per row, sorted by days listed (longest first) */}
      <div className={mobile ? "p-2" : "overflow-y-auto flex-1 scrollbar-thin p-2"}>
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No results for &ldquo;{search}&rdquo;</p>
        )}
        {groups.map((group, gi) => (
          <div key={group.label || gi} className={gi > 0 ? 'mt-3' : ''}>
            {group.label && (
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 px-0.5 ${group.label.startsWith('⚠') ? 'text-amber-600' : 'text-emerald-600'}`}>
                {group.label} ({group.items.length})
              </p>
            )}
            {bucketByDays(group.items).map((bucket, bi) => {
              const maxDays = Math.max(1, ...bucket.items.map(i => getDaysListed(i) || 0));
              const maxViews = Math.max(1, ...bucket.items.map(i => {
                const id = getEbayId(i);
                return id != null ? (ebayViews[String(id)] || 0) : 0;
              }));
              return (
                <div key={bucket.label} className={bi > 0 ? 'mt-2' : ''}>
                  <p className="text-[9px] font-semibold text-slate-400 px-0.5 mb-0.5">
                    {bucket.label} ({bucket.items.length})
                  </p>
                  <div className="flex flex-col divide-y divide-slate-50">
                    {bucket.items.map(item => renderItem(item, maxDays, maxViews))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
