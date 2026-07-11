import DealSearchPanel from '../components/DealSearchPanel';
import AddProductPanel from '../components/AddProductPanel';
import ProductListDetail from '../components/ProductListDetail';

export default function DealsPage({ tracker }) {
  const {
    API, url, setUrl, adding, addError, preview, setPreview, previewRef,
    selectedAsins, setSelectedAsins, addingVariants, addProgress,
    handleAdd, handleTrackDeal, handleTrackSelected, toggleVariant, trackedAsins,
    ebayConnected, ebayViews, ebayWatchers, ebaySold, blankPhotoIds, itemStatus, ebayFailedIds,
    handleCheckOne, handleDeleteGroup, handleUpdate, handleVariantDeleted, handlePriceMismatch,
    renderItems,
  } = tracker;

  // Products already being tracked but not yet listed on eBay — this is the "todo"
  // list for getting a tracked item live, so it lives here next to the add flow.
  const unlistedItems = renderItems.filter(i => itemStatus(i) === 'unlisted');

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <AddProductPanel
        url={url} setUrl={setUrl} adding={adding} addError={addError} preview={preview} previewRef={previewRef}
        handleAdd={handleAdd} handleTrackSelected={handleTrackSelected}
        selectedAsins={selectedAsins} toggleVariant={toggleVariant} setSelectedAsins={setSelectedAsins}
        addingVariants={addingVariants} addProgress={addProgress}
        setPreview={setPreview}
        trackedAsins={trackedAsins}
      />

      <DealSearchPanel onTrack={handleTrackDeal} trackedAsins={trackedAsins} />

      <div className="mt-5">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Not yet listed on eBay</h2>
        <ProductListDetail
          items={unlistedItems}
          emptyState={
            <p className="text-sm text-slate-400 text-center py-8">
              Nothing waiting to be listed — everything you're tracking is already on eBay.
            </p>
          }
          API={API}
          ebayConnected={ebayConnected}
          ebayViews={ebayViews}
          ebayWatchers={ebayWatchers}
          ebaySold={ebaySold}
          blankPhotoIds={blankPhotoIds}
          itemStatus={itemStatus}
          ebayFailedIds={ebayFailedIds}
          handleCheckOne={handleCheckOne}
          handleDeleteGroup={handleDeleteGroup}
          handleUpdate={handleUpdate}
          handleVariantDeleted={handleVariantDeleted}
          handlePriceMismatch={handlePriceMismatch}
        />
      </div>
    </div>
  );
}
