import { useState } from 'react';
import { calcEbayPrice } from '../utils/pricing';

export default function SidebarList({ items, selectedKey, onSelect, getItemKey, getItemTitle, getItemImage, getItemStatus, ebayViews = {}, ebayWatchers = {}, apiUrl = '', ebayConnected = true, mobile = false, saleMode = false, blankPhotoIds = new Set() }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? items.filter(item => getItemTitle(item).toLowerCase().includes(search.toLowerCase()))
    : items;
  return (
    <div className={mobile
      ? "flex flex-col overflow-hidden bg-white border border-slate-200/70 rounded-2xl shadow-soft"
      : "w-72 flex-shrink-0 border border-slate-200/70 rounded-2xl overflow-hidden bg-white shadow-soft sticky top-4 max-h-[calc(100vh-120px)] flex flex-col"
    }>
      {/* Header + search */}
      <div className="px-3.5 py-3 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {items.length} listing{items.length !== 1 ? 's' : ''}
          </p>
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
      {/* Items */}
      <div className={mobile ? "flex flex-col divide-y divide-slate-50" : "overflow-y-auto flex-1 scrollbar-thin divide-y divide-slate-50"}>
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No results for &ldquo;{search}&rdquo;</p>
        )}
        {filtered.map(item => {
          const key = getItemKey(item);
          const status = getItemStatus(item);
          const image = getItemImage(item);
          const title = getItemTitle(item);
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${isSelected ? 'bg-blue-50/70 border-l-[3px] border-l-blue-500' : 'border-l-[3px] border-l-transparent hover:bg-slate-50'}`}
            >
              <div className="relative flex-shrink-0">
                {image
                  ? <img src={image} alt="" className="w-11 h-11 object-contain rounded-xl bg-slate-50 border border-slate-100" />
                  : <div className="w-11 h-11 rounded-xl bg-slate-100" />
                }
                {(() => {
                  const ebayId = item.type === 'group'
                    ? item.variants.find(v => v.ebayListingId)?.ebayListingId
                    : item.product?.ebayListingId;
                  const views = ebayId != null ? ebayViews[String(ebayId)] : undefined;
                  if (!views) return null;
                  return (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-ebay text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                      {views >= 1000 ? `${(views / 1000).toFixed(1)}k` : views}
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
                    <span className="absolute -top-1.5 -left-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                      {watchers >= 1000 ? `${(watchers / 1000).toFixed(1)}k` : watchers}
                    </span>
                  );
                })()}
                {/* Amazon discount badge — % off the list/strikethrough price */}
                {(() => {
                  const rep = item.type === 'group'
                    ? item.variants.find(v => v.listPrice > v.current)
                    : (item.product?.listPrice > item.product?.current ? item.product : null);
                  if (!rep) return null;
                  const pct = Math.round((1 - rep.current / rep.listPrice) * 100);
                  if (pct <= 0) return null;
                  return (
                    <span className="absolute -bottom-1.5 -left-1.5 min-w-[28px] h-[17px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 leading-none shadow-sm ring-2 ring-white">
                      −{pct}%
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
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium leading-snug line-clamp-2 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{title}</p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    {status === 'ok'       && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" /><span className="text-[10px] text-emerald-600 font-semibold">Listed OK</span></>}
                    {status === 'price'    && <><span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" /><span className="text-[10px] text-amber-600 font-semibold">Price issue</span></>}
                    {status === 'issue'    && <><span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" /><span className="text-[10px] text-orange-500 font-semibold">Issue</span></>}
                    {status === 'unlisted' && <><span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" /><span className="text-[10px] text-slate-400">Not listed</span></>}
                    {item.type === 'group' && <span className="ml-1 text-[9px] text-slate-300 font-medium">{item.variants.length}v</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Days listed badge */}
                    {(() => {
                      const listedAt = item.type === 'group'
                        ? item.variants.find(v => v.listedAt)?.listedAt
                        : item.product?.listedAt;
                      if (!listedAt) return null;
                      const days = Math.max(0, Math.floor((Date.now() - new Date(listedAt).getTime()) / 86400000));
                      return (
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap">
                          {days}d listed
                        </span>
                      );
                    })()}
                    {/* eBay price badge */}
                    {(() => {
                      const costs = item.type === 'group'
                        ? item.variants.map(v => v.current).filter(v => v != null)
                        : [item.product.current].filter(v => v != null);
                      if (!costs.length) return null;
                      const ebayPrices = costs.map(c => calcEbayPrice(c, saleMode));
                      const lo = Math.min(...ebayPrices);
                      const hi = Math.max(...ebayPrices);
                      const label = lo.toFixed(2) === hi.toFixed(2) ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)}+`;
                      return (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none bg-blue-50 text-blue-600">
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
