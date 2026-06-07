// Shared helpers for the master-detail item list on AmazonPage: turning the flat
// `products` array into single/group render items, and deriving each item's
// display key/title/image/status from tracker + eBay sync state.

export function getItemKey(item) {
  return item.type === 'group' ? `group-${item.groupId}` : `single-${item.product._id}`;
}

export function getItemImage(item) {
  if (item.type === 'group') return item.variants.find(v => v.image)?.image || null;
  return item.product.image || null;
}

export function getItemTitle(item) {
  if (item.type === 'group') return item.variants[0]?.title || 'Group Listing';
  return item.product.title || 'Product';
}

export function getItemStatus(item, ebayFailedIds, priceMismatchIds) {
  if (item.type === 'group') {
    const ebayId     = item.variants.find(v => v.ebayListingId)?.ebayListingId;
    const hasListing = !!ebayId;
    const hasFail    = item.variants.some(v => ebayFailedIds.has(String(v._id)));
    const hasOOS     = item.variants.some(v => v.status === 'out_of_stock' || v.status === 'unavailable');
    const hasPrice   = hasListing && priceMismatchIds.has(String(ebayId));
    if (!hasListing) return 'unlisted';
    if (hasFail || hasOOS) return 'issue';
    if (hasPrice) return 'price';
    return 'ok';
  }
  const p = item.product;
  const hasFail  = ebayFailedIds.has(String(p._id));
  const hasOOS   = p.status === 'out_of_stock' || p.status === 'unavailable';
  const hasPrice = p.ebayListingId && priceMismatchIds.has(String(p.ebayListingId));
  if (!p.ebayListingId) return 'unlisted';
  if (hasFail || hasOOS) return 'issue';
  if (hasPrice) return 'price';
  return 'ok';
}

// Group products sharing a groupId into group cards; singles stay as-is
export function buildRenderItems(products) {
  const renderItems = [];
  const seenGroups = new Set();
  for (const p of products) {
    if (!p.groupId) {
      renderItems.push({ type: 'single', product: p });
    } else if (!seenGroups.has(p.groupId)) {
      seenGroups.add(p.groupId);
      const group = products.filter(x => x.groupId === p.groupId);
      if (group.length === 1) {
        renderItems.push({ type: 'single', product: group[0] });
      } else {
        renderItems.push({ type: 'group', groupId: p.groupId, variants: group });
      }
    }
  }
  return renderItems;
}

export function itemHasIssue(item, ebayFailedIds, priceMismatchIds) {
  const s = getItemStatus(item, ebayFailedIds, priceMismatchIds);
  if (s === 'issue' || s === 'price') return true;
  const variants = item.type === 'group' ? item.variants : [item.product];
  return variants.some(v =>
    (v.status && v.status !== 'active') ||
    ebayFailedIds.has(String(v._id))
  );
}

export function itemEbayViews(item, ebayViews) {
  const variants = item.type === 'group' ? item.variants : [item.product];
  return variants.reduce((max, v) => {
    const views = v.ebayListingId ? (ebayViews[String(v.ebayListingId)] ?? 0) : 0;
    return Math.max(max, views);
  }, 0);
}

// Sort: items with any issue bubble to the top, then by most eBay views
export function sortRenderItems(renderItems, ebayFailedIds, priceMismatchIds, ebayViews) {
  return [...renderItems].sort((a, b) => {
    const issueDiff = Number(itemHasIssue(b, ebayFailedIds, priceMismatchIds)) - Number(itemHasIssue(a, ebayFailedIds, priceMismatchIds));
    if (issueDiff !== 0) return issueDiff;
    return itemEbayViews(b, ebayViews) - itemEbayViews(a, ebayViews);
  });
}
