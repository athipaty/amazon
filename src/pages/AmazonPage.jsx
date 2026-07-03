import TrackerBanners from '../components/TrackerBanners';
import ProductListDetail from '../components/ProductListDetail';

export default function AmazonPage({ tracker }) {
  const {
    API, products, statusMsg,
    ebayConnected, ebayTokenDaysLeft, ebayFailedIds, ebayViews, ebayWatchers,
    blankPhotoIds, sellingLimits,
    handleDelete, handleUpdate, handlePriceMismatch, handleCheckOne,
    handleVariantDeleted, itemStatus, hasIssue, renderItems,
  } = tracker;

  // Items not yet listed on eBay live on the Deals tab instead — this tab is just
  // the active, eBay-listed catalog you're monitoring.
  const listedItems = renderItems.filter(i => itemStatus(i) !== 'unlisted');

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <TrackerBanners
        apiUrl={API}
        ebayConnected={ebayConnected} ebayTokenDaysLeft={ebayTokenDaysLeft}
        statusMsg={statusMsg}
      />

      <ProductListDetail
        items={listedItems}
        emptyState={
          <div className="text-center mt-16 md:mt-24">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-soft border border-slate-100 text-3xl mb-4">🔍</div>
            <p className="text-base font-bold text-slate-700">
              {products.length === 0 ? 'No products tracked yet' : 'No active eBay listings yet'}
            </p>
            <p className="text-sm mt-1 text-slate-400">
              {products.length === 0
                ? 'Head to the Deals tab to paste an Amazon URL or find items on sale.'
                : 'Products you track show up here once they’re listed on eBay — check the Deals tab.'}
            </p>
          </div>
        }
        API={API}
        ebayConnected={ebayConnected}
        ebayViews={ebayViews}
        ebayWatchers={ebayWatchers}
        blankPhotoIds={blankPhotoIds}
        itemStatus={itemStatus}
        hasIssue={hasIssue}
        sellingLimits={sellingLimits}
        ebayFailedIds={ebayFailedIds}
        handleCheckOne={handleCheckOne}
        handleDelete={handleDelete}
        handleUpdate={handleUpdate}
        handleVariantDeleted={handleVariantDeleted}
        handlePriceMismatch={handlePriceMismatch}
      />
    </div>
  );
}
