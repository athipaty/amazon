import { useState, useEffect } from 'react';
import ProductGroupCard from './ProductGroupCard';
import SidebarList from './SidebarList';
import { getItemKey, getItemImage, getItemTitle } from '../utils/trackerItems';

// Shared master-detail UI (sidebar photo grid + detail panel, with a full-screen
// sheet on mobile) — used by both the Tracker tab (listed items) and the Deals tab
// (items tracked but not yet listed on eBay), so this list-driving logic only lives once.
export default function ProductListDetail({
  items, emptyState, API, ebayConnected, ebayViews, ebayWatchers, blankPhotoIds,
  itemStatus, ebayFailedIds, handleCheckOne, handleDelete, handleUpdate,
  handleVariantDeleted, handlePriceMismatch,
}) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = detailOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [detailOpen]);

  // Auto-select first item; reset stale key after deletions
  const selectedItem = items.find(i => getItemKey(i) === selectedKey) || items[0] || null;
  useEffect(() => {
    if (selectedKey && items.length && !items.some(i => getItemKey(i) === selectedKey)) {
      setSelectedKey(items[0] ? getItemKey(items[0]) : null);
    }
  }, [items.map(getItemKey).join(',')]);

  if (items.length === 0) return emptyState;

  return (
    <>
      {/* ── Mobile: compact list ── */}
      <div className="flex lg:hidden flex-col">
        <SidebarList
          mobile
          items={items}
          selectedKey={selectedKey || (items[0] ? getItemKey(items[0]) : null)}
          onSelect={(key) => { setSelectedKey(key); setDetailOpen(true); }}
          getItemKey={getItemKey}
          getItemTitle={getItemTitle}
          getItemImage={getItemImage}
          getItemStatus={itemStatus}
          ebayViews={ebayViews}
          ebayWatchers={ebayWatchers}
          apiUrl={API}
          ebayConnected={ebayConnected}
          blankPhotoIds={blankPhotoIds}
        />
      </div>

      {/* ── Desktop: master-detail ── */}
      <div className="hidden lg:flex gap-4 items-start">
        {/* LEFT: compact sidebar */}
        <SidebarList
          items={items}
          selectedKey={selectedKey || getItemKey(items[0])}
          onSelect={setSelectedKey}
          getItemKey={getItemKey}
          getItemTitle={getItemTitle}
          getItemImage={getItemImage}
          getItemStatus={itemStatus}
          ebayViews={ebayViews}
          ebayWatchers={ebayWatchers}
          apiUrl={API}
          ebayConnected={ebayConnected}
          blankPhotoIds={blankPhotoIds}
        />

        {/* RIGHT: detail panel — always use GroupCard layout (1 card for singles, N for groups) */}
        <div className="flex-1 min-w-0">
          {selectedItem && (
            selectedItem.type === 'group'
              ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
              : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
          )}
        </div>
      </div>

      {/* ── Mobile detail sheet ── */}
      {detailOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-slide-in-right">
          <div className="flex items-center gap-3 px-3 py-3 bg-white/90 backdrop-blur-sm border-b border-slate-100 flex-shrink-0 shadow-soft">
            <button
              onClick={() => setDetailOpen(false)}
              className="flex items-center justify-center gap-1 w-9 h-9 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0 text-base"
              aria-label="Back to listings"
            >
              ‹
            </button>
            <p className="flex-1 text-sm font-semibold text-slate-700 truncate min-w-0">
              {selectedItem && getItemTitle(selectedItem)}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 pb-8">
            {selectedItem && (
              selectedItem.type === 'group'
                ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
                : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
