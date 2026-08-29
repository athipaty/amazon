import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { getItemStatus, itemHasIssue, buildRenderItems, sortRenderItems } from '../utils/trackerItems';
import { calcEbayPrice } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Shared "product tracker" state — lifted out of AmazonPage so the deal-search flow
// (which can trigger the same multi-variant picker) works from its own tab too.
export default function useProductTracker() {
  const [products, setProducts] = useState([]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null); // { title, price, currency, image, variants, groupId }
  const [selectedAsins, setSelectedAsins] = useState(new Set());
  const [addingVariants, setAddingVariants] = useState(false);
  const [addProgress, setAddProgress] = useState('');
  const [previewGroupId, setPreviewGroupId] = useState(null);
  const [ebayConnected, setEbayConnected] = useState(true);
  const [ebayTokenDaysLeft, setEbayTokenDaysLeft] = useState(null);
  const [ebayFailedIds, setEbayFailedIds] = useState(new Set());
  const [priceMismatchIds, setPriceMismatchIds] = useState(new Set()); // eBay listing IDs with price mismatch
  const [ebayViews, setEbayViews] = useState({}); // listingId → view count
  const [ebayWatchers, setEbayWatchers] = useState({}); // listingId → watcher count
  const [ebaySold, setEbaySold] = useState({}); // listingId → quantity sold
  const [blankPhotoIds, setBlankPhotoIds] = useState(new Set()); // eBay listing IDs with no photos
  const [sellingLimits, setSellingLimits] = useState(null); // { used, limit, remaining }
  const socketRef = useRef(null);
  const ebayIdsRef = useRef([]); // kept in sync by loadProducts for fetchEbayViews
  const previewRef = useRef(null);

  useEffect(() => {
    if (preview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [preview]);

  useEffect(() => {
    loadProducts().then(() => { fetchEbayViews(); fetchEbayWatchers(); fetchPhotoStatus(); });
    checkEbayStatus();
    fetchSellingLimits();

    socketRef.current = io(API);
    const socket = socketRef.current;

    socket.on('tracker:check:start', ({ count }) => {
      setChecking(true);
      setStatusMsg(`Checking ${count} product${count !== 1 ? 's' : ''}...`);
    });

    socket.on('tracker:check:done', () => {
      setChecking(false);
      setStatusMsg('');
      loadProducts();
    });

    socket.on('tracker:listing:ended', () => {
      loadProducts();
    });

    socket.on('tracker:price:drop', ({ product }) => {
      setProducts(prev => prev.map(p => p._id === product._id ? product : p));
    });

    socket.on('tracker:ebay:sync:fail', ({ productId }) => {
      setEbayFailedIds(prev => new Set([...prev, productId]));
    });

    socket.on('tracker:ebay:sync:ok', ({ productId }) => {
      setEbayFailedIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
    });

    const poll = setInterval(loadProducts, 30000);
    const viewsPoll = setInterval(fetchEbayViews, 60 * 60 * 1000); // re-fetch views every hour
    const watchersPoll = setInterval(fetchEbayWatchers, 60 * 60 * 1000); // re-fetch watchers every hour
    return () => { socket.disconnect(); clearInterval(poll); clearInterval(viewsPoll); clearInterval(watchersPoll); };
  }, []);

  async function checkEbayStatus() {
    try {
      const { data } = await axios.get(`${API}/api/ebay/auth/status`);
      setEbayConnected(data.connected === true);
      setEbayTokenDaysLeft(data.refreshTokenDaysLeft ?? null);
    } catch { setEbayConnected(false); }
  }

  async function loadProducts() {
    try {
      const { data } = await axios.get(`${API}/api/tracker`);
      setProducts(data);
      const ids = [...new Set(data.map(p => p.ebayListingId).filter(Boolean))];
      ebayIdsRef.current = ids;
    } catch {}
  }

  async function fetchSellingLimits() {
    try {
      const { data } = await axios.get(`${API}/api/ebay/selling-limits`);
      setSellingLimits(data.items);
    } catch {}
  }

  async function fetchEbayViews() {
    const ids = ebayIdsRef.current;
    if (!ids.length) return;
    try {
      const r = await fetch(`${API}/api/ebay/listings/views?ids=${ids.join(',')}`);
      const json = await r.json();
      if (json._error) console.warn('[eBay views] batch error:', json._error);
      if (json.views) setEbayViews(json.views);
    } catch (e) { console.warn('[eBay views] batch fetch failed:', e.message); }
  }

  async function fetchEbayWatchers() {
    const ids = ebayIdsRef.current;
    if (!ids.length) return;
    try {
      const r = await fetch(`${API}/api/ebay/listings/watchers?ids=${ids.join(',')}`);
      const json = await r.json();
      if (json.watchers) setEbayWatchers(json.watchers);
      if (json.sold) setEbaySold(json.sold);
    } catch (e) { console.warn('[eBay watchers] batch fetch failed:', e.message); }
  }

  async function fetchPhotoStatus() {
    const ids = ebayIdsRef.current;
    if (!ids.length) return;
    try {
      const r = await fetch(`${API}/api/ebay/listings/photo-status?ids=${ids.join(',')}`);
      const data = await r.json();
      const blank = new Set(
        Object.entries(data)
          .filter(([, v]) => v.hasPhoto === false)
          .map(([id]) => id)
      );
      setBlankPhotoIds(blank);
    } catch { /* non-critical */ }
  }

  const trackedAsins = new Set(products.map(p => (p.url.match(/\/dp\/([A-Z0-9]{10})/i) || [])[1]).filter(Boolean));

  async function handleAdd(e, urlOverride) {
    e.preventDefault();
    const trimmed = (urlOverride ?? url).trim();
    if (!trimmed) return;
    if (!/amazon\.|amzn\.(to|com)|a\.co/i.test(trimmed)) {
      setAddError('Please enter a valid Amazon product URL.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      if (data.variants && data.variants.length > 1) {
        // If any variant is already tracked, inherit its groupId so new variants
        // join the existing group rather than creating a split group.
        const existingGroupId = data.variants
          .map(v => products.find(p => (p.url.match(/\/dp\/([A-Z0-9]{10})/i)||[])[1] === v.asin)?.groupId)
          .find(Boolean);
        setPreview(data);
        setPreviewGroupId(existingGroupId || data.groupId || null);
        setSelectedAsins(new Set(data.variants.filter(v => !trackedAsins.has(v.asin)).map(v => v.asin)));
      } else {
        const { data: product } = await axios.post(`${API}/api/tracker`, { url: trimmed, fulfillment: data.fulfillment });
        setProducts(prev => [product, ...prev]);
        setUrl('');
        setStatusMsg(product.isPrime ? '✓ Tracked — Prime eligible' : '✓ Tracked — No Prime');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch (err) {
      setAddError(err.response?.data?.error || err.message || 'Failed to reach the server.');
    } finally {
      setAdding(false);
    }
  }

  async function handleTrackSelected() {
    if (!preview || selectedAsins.size === 0) return;
    setAddingVariants(true);
    setAddError('');
    const toAdd = preview.variants.filter(v => selectedAsins.has(v.asin));
    const failed = [];
    const ebayLinkFailed = [];

    // Fix already-tracked variants from this preview that are missing the group — happens when
    // one variant was tracked without a groupId (e.g. via deal panel or single-item track).
    // Patch them into the group before adding the new ones so everything lands in one card.
    if (previewGroupId) {
      const toFix = preview.variants
        .filter(v => trackedAsins?.has(v.asin))
        .map(v => products.find(p => (p.url.match(/\/dp\/([A-Z0-9]{10})/i)||[])[1] === v.asin))
        .filter(p => p && p.groupId !== previewGroupId);
      for (const p of toFix) {
        try {
          const { data: updated } = await axios.patch(`${API}/api/tracker/${p._id}`, { groupId: previewGroupId });
          setProducts(prev => prev.map(x => x._id === p._id ? updated : x));
        } catch {}
      }
    }

    // If the group already has an eBay listing, auto-add new variants to it
    const existingEbayId = previewGroupId
      ? products.find(p => p.groupId === previewGroupId && p.ebayListingId)?.ebayListingId || null
      : null;
    const existingFolder = existingEbayId
      ? products.find(p => p.groupId === previewGroupId && p.cloudinaryFolder)?.cloudinaryFolder || null
      : null;

    for (let i = 0; i < toAdd.length; i++) {
      setAddProgress(`Adding ${i + 1} of ${toAdd.length}…`);
      try {
        // Fulfillment is only looked up once per preview, at the group/parent URL — applied to
        // every variant tracked from that preview rather than re-paying for a per-ASIN lookup.
        // `variant` passes this sibling's already-known label/attributes/image from the
        // preview's customization_options, so the backend can skip a second full scrape and
        // just do a cheap price check for this ASIN — see POST /api/tracker's sibling fast path.
        const { data: newProduct } = await axios.post(`${API}/api/tracker`, {
          url: toAdd[i].url,
          groupId: previewGroupId,
          fulfillment: preview.fulfillment,
          variant: { label: toAdd[i].label, attributes: toAdd[i].attributes, image: toAdd[i].image },
        });
        if (existingEbayId && newProduct.variant) {
          const price = calcEbayPrice(newProduct.current).toFixed(2);
          try {
            const r = await fetch(`${API}/api/ebay/listing/${existingEbayId}/add-variation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variantLabel: newProduct.variant, price }),
            });
            if (r.ok) {
              const patchRes = await fetch(`${API}/api/tracker/${newProduct._id}/ebay`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ebayListingId: existingEbayId, cloudinaryFolder: existingFolder, ebayPrice: Number(price) }),
              });
              if (!patchRes.ok) {
                ebayLinkFailed.push(newProduct.variant);
                console.warn(`Added "${newProduct.variant}" to eBay listing ${existingEbayId} but failed to save the listing ID to the tracker.`);
              }
            } else {
              ebayLinkFailed.push(newProduct.variant);
              console.warn(`Auto-add to eBay failed for "${newProduct.variant}": HTTP ${r.status}`);
            }
          } catch (ebayErr) {
            ebayLinkFailed.push(newProduct.variant);
            console.warn(`Auto-add to eBay failed for "${newProduct.variant}":`, ebayErr);
          }
        }
      } catch (err) {
        if (err.response?.status !== 409) {
          // 409 = already tracking, safe to ignore; anything else = real failure
          failed.push({ variant: toAdd[i], reason: err.response?.data?.error || err.message });
          console.warn(`Failed to add variant ${toAdd[i].asin}:`, err.response?.data?.error || err.message);
        }
      }
      if (i < toAdd.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    // Reload from server — avoids duplicate race with the 30s poll that may have fired mid-add
    await loadProducts();
    setPreview(null);
    setSelectedAsins(new Set());
    setPreviewGroupId(null);
    setAddingVariants(false);
    setAddProgress('');
    const messages = [];
    if (failed.length > 0) {
      const names = failed.map(f => `"${f.variant.label}"`).join(', ');
      const reason = failed[0].reason ? ` (${failed[0].reason})` : '';
      messages.push(`Failed to add ${names}${reason}. Paste the URL again and track just that variant.`);
    }
    if (ebayLinkFailed.length > 0) {
      const names = ebayLinkFailed.map(v => `"${v}"`).join(', ');
      messages.push(`${names} ${ebayLinkFailed.length > 1 ? 'were' : 'was'} added to eBay listing ${existingEbayId} but the listing ID didn't save to the tracker — use "+ link existing listing manually" on the group to fix.`);
    }
    setAddError(messages.join(' '));
    setUrl('');
  }

  // ── Master-detail helpers (pure logic lives in utils/trackerItems) ──
  const itemStatus = (item) => getItemStatus(item, ebayFailedIds, priceMismatchIds);
  const hasIssue = (item) => itemHasIssue(item, ebayFailedIds, priceMismatchIds);
  const renderItems = sortRenderItems(buildRenderItems(products), ebayFailedIds, priceMismatchIds, ebayViews, ebayWatchers, ebaySold);

  function toggleVariant(asin, checked) {
    const next = new Set(selectedAsins);
    if (checked) next.add(asin); else next.delete(asin);
    setSelectedAsins(next);
  }

  // Deletes an entire variant group in ONE request instead of one sequential request per
  // variant. A client-side loop of N requests is fragile for large groups — closing the tab
  // or losing connection partway through leaves every variant after that point untouched.
  // A single request runs the whole batch server-side, so it finishes even if the browser
  // that fired it is gone a second later.
  async function handleDeleteGroup(ids) {
    const { data } = await axios.post(`${API}/api/tracker/group-delete`, { ids });
    const results = data.results || [];
    const succeededIds = new Set(results.filter(r => r.success).map(r => r.id));
    setProducts(prev => prev.filter(p => !succeededIds.has(p._id)));
    const failed = results.filter(r => !r.success);
    if (failed.length) {
      throw new Error(failed.map(f => f.error).join('; '));
    }
  }

  function handleVariantDeleted(variantId) {
    setProducts(prev => prev.filter(p => p._id !== variantId));
  }

  function handleUpdate(updated) {
    setProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
  }

  function handlePriceMismatch(ebayListingId, hasMismatch) {
    if (!ebayListingId) return;
    setPriceMismatchIds(prev => {
      const next = new Set(prev);
      if (hasMismatch) next.add(String(ebayListingId));
      else next.delete(String(ebayListingId));
      return next;
    });
  }

  async function handleCheckOne(id) {
    try {
      const { data } = await axios.post(`${API}/api/tracker/check/${id}`);
      setProducts(prev => prev.map(p => p._id === id ? data : p));
      return data;
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Check failed');
      throw err;
    }
  }

  return {
    API, products, setProducts, url, setUrl, adding, addError, statusMsg, checking,
    preview, setPreview, selectedAsins, setSelectedAsins, addingVariants, addProgress,
    previewGroupId, ebayConnected, ebayTokenDaysLeft, ebayFailedIds, priceMismatchIds,
    ebayViews, ebayWatchers, ebaySold, blankPhotoIds, sellingLimits,
    previewRef, loadProducts, handleAdd,
    handleTrackSelected, toggleVariant, handleDeleteGroup, handleVariantDeleted, handleUpdate,
    handlePriceMismatch, handleCheckOne,
    itemStatus, hasIssue, renderItems, trackedAsins,
  };
}
