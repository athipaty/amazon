import { useState, useEffect } from 'react';
import ProductGroupCard from '../components/ProductGroupCard';
import SidebarList from '../components/SidebarList';
import TrackerHeader from '../components/TrackerHeader';
import TrackerBanners from '../components/TrackerBanners';
import AddProductPanel from '../components/AddProductPanel';
import { getItemKey, getItemImage, getItemTitle } from '../utils/trackerItems';

export default function AmazonPage({ tracker }) {
  const {
    API, products, url, setUrl, adding, addError, statusMsg, checking,
    preview, setPreview, selectedAsins, setSelectedAsins, addingVariants, addProgress,
    ebayConnected, ebayTokenDaysLeft, ebayFailedIds, ebayViews, ebayWatchers,
    blankPhotoIds, sellingLimits, cleaningOrphans, orphanResult, retrying, retryProgress,
    previewRef, handleAdd, handleTrackSelected, toggleVariant, handleDelete,
    handleVariantDeleted, handleUpdate, handlePriceMismatch, handleCheckOne, handleCheckNow,
    handleCleanOrphans, handleRetryErrors, itemStatus, renderItems, trackedAsins,
  } = tracker;

  const [selectedKey, setSelectedKey] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = detailOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [detailOpen]);

  // Auto-select first item; reset stale key after deletions
  const selectedItem = renderItems.find(i => getItemKey(i) === selectedKey) || renderItems[0] || null;
  useEffect(() => {
    if (selectedKey && renderItems.length && !renderItems.some(i => getItemKey(i) === selectedKey)) {
      setSelectedKey(renderItems[0] ? getItemKey(renderItems[0]) : null);
    }
  }, [renderItems.map(getItemKey).join(',')]);

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <TrackerHeader
        sellingLimits={sellingLimits}
        checking={checking} handleCheckNow={handleCheckNow}
        products={products}
        retrying={retrying} retryProgress={retryProgress} handleRetryErrors={handleRetryErrors}
        cleaningOrphans={cleaningOrphans} orphanResult={orphanResult} handleCleanOrphans={handleCleanOrphans}
      />

      <AddProductPanel
        url={url} setUrl={setUrl} adding={adding} addError={addError} preview={preview} previewRef={previewRef}
        handleAdd={handleAdd} handleTrackSelected={handleTrackSelected}
        selectedAsins={selectedAsins} toggleVariant={toggleVariant} setSelectedAsins={setSelectedAsins}
        addingVariants={addingVariants} addProgress={addProgress}
        setPreview={setPreview}
        trackedAsins={trackedAsins}
      />

      <TrackerBanners
        apiUrl={API}
        ebayConnected={ebayConnected} ebayTokenDaysLeft={ebayTokenDaysLeft}
        statusMsg={statusMsg}
      />

      {products.length === 0 ? (
        <div className="text-center mt-16 md:mt-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-soft border border-slate-100 text-3xl mb-4">🔍</div>
          <p className="text-base font-bold text-slate-700">No products tracked yet</p>
          <p className="text-sm mt-1 text-slate-400">Paste an Amazon URL above to start tracking prices.</p>
        </div>
      ) : (
        <>
          {/* ── Mobile: compact list ── */}
          <div className="flex lg:hidden flex-col">
            <SidebarList
              mobile
              items={renderItems}
              selectedKey={selectedKey || (renderItems[0] ? getItemKey(renderItems[0]) : null)}
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
              items={renderItems}
              selectedKey={selectedKey || getItemKey(renderItems[0])}
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
        </>
      )}

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

    </div>
  );
}
