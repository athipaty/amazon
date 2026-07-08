import { useState } from 'react';
import FadeImg from './FadeImg';

export default function SidebarList({ items, selectedKey, onSelect, getItemKey, getItemTitle, getItemImage, getItemStatus, hasIssue, sellingLimits, ebayViews = {}, ebayWatchers = {}, ebaySold = {}, apiUrl = '', ebayConnected = true, mobile = false, blankPhotoIds = new Set() }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? items.filter(item => getItemTitle(item).toLowerCase().includes(search.toLowerCase()))
    : items;

  // When `hasIssue` is provided, split into two labeled sections so problems are
  // easy to spot instead of buried among everything that's fine.
  const groups = hasIssue
    ? [
        { label: '⚠ Needs attention', items: filtered.filter(hasIssue) },
        { label: '✓ All good', items: filtered.filter(i => !hasIssue(i)) },
      ].filter(g => g.items.length)
    : [{ label: null, items: filtered }];

  function renderItem(item) {
    const key = getItemKey(item);
    const image = getItemImage(item);
    const title = getItemTitle(item);
    const isSelected = selectedKey === key;
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        title={title}
        className={`flex items-center justify-center p-1.5 rounded-xl transition-colors ${isSelected ? 'bg-blue-50/70 ring-2 ring-blue-500' : 'ring-1 ring-transparent hover:bg-slate-50'}`}
      >
        <div className="relative flex-shrink-0">
          {image
            ? <FadeImg src={image} alt="" className="w-16 h-16 object-contain rounded-xl bg-slate-50 border border-slate-100" />
            : <div className="w-16 h-16 rounded-xl bg-slate-100" />
          }
          {(() => {
            const ebayId = item.type === 'group'
              ? item.variants.find(v => v.ebayListingId)?.ebayListingId
              : item.product?.ebayListingId;
            const sold = ebayId != null ? ebaySold[String(ebayId)] : undefined;
            if (!sold) return null;
            return (
              <span className="absolute -top-1.5 -left-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-emerald-600 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                {sold >= 1000 ? `${(sold / 1000).toFixed(1)}k` : sold}
              </span>
            );
          })()}
          {(() => {
            const ebayId = item.type === 'group'
              ? item.variants.find(v => v.ebayListingId)?.ebayListingId
              : item.product?.ebayListingId;
            const watchers = ebayId != null ? ebayWatchers[String(ebayId)] : undefined;
            if (!watchers) return null;
            return (
              <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                {watchers >= 1000 ? `${(watchers / 1000).toFixed(1)}k` : watchers}
              </span>
            );
          })()}
          {/* Blank eBay photo warning badge */}
          {(() => {
            const ebayId = item.type === 'group'
              ? item.variants.find(v => v.ebayListingId)?.ebayListingId
              : item.product?.ebayListingId;
            if (!ebayId || !blankPhotoIds.has(String(ebayId))) return null;
            return (
              <span className="absolute -bottom-1.5 -right-1.5 w-[17px] h-[17px] flex items-center justify-center bg-orange-500 text-white text-[9px] font-bold rounded-full leading-none shadow-sm ring-2 ring-white" title="No photos on eBay listing">
                📷
              </span>
            );
          })()}
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
      {/* Items — responsive photo grid: more columns as the screen gets wider */}
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
            <div className={mobile ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"}>
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
