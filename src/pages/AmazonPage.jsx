import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ProductGroupCard from '../components/ProductGroupCard';
import ProfitDashboard from '../components/ProfitDashboard';
import { calcEbayPrice, calcEbayFee } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function SidebarList({ items, selectedKey, onSelect, getItemKey, getItemTitle, getItemImage, getItemStatus, ebayViews = {}, apiUrl = '', ebayConnected = true, mobile = false }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? items.filter(item => getItemTitle(item).toLowerCase().includes(search.toLowerCase()))
    : items;
  return (
    <div className={mobile
      ? "flex flex-col overflow-hidden bg-white border border-gray-200 rounded-xl"
      : "w-64 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden bg-white sticky top-4 max-h-[calc(100vh-120px)] flex flex-col"
    }>
      {/* Header + search */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            {items.length} listing{items.length !== 1 ? 's' : ''}
          </p>
          {ebayConnected
            ? <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded leading-none whitespace-nowrap">● Connected</span>
            : <a
                href={`${apiUrl}/api/ebay/auth/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-semibold text-[#e53238] hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.5 rounded leading-none transition-colors whitespace-nowrap"
              >
                Reconnect eBay
              </a>
          }
        </div>
        <input
          type="text"
          placeholder="Search listings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white placeholder-gray-400"
        />
      </div>
      {/* Items */}
      <div className={mobile ? "flex flex-col" : "overflow-y-auto flex-1"}>
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No results for &ldquo;{search}&rdquo;</p>
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
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : 'border-l-[3px] border-l-transparent'}`}
            >
              <div className="relative flex-shrink-0">
                {image
                  ? <img src={image} alt="" className="w-11 h-11 object-contain rounded-lg bg-gray-50 border border-gray-100" />
                  : <div className="w-11 h-11 rounded-lg bg-gray-100" />
                }
                {(() => {
                  const ebayId = item.type === 'group'
                    ? item.variants.find(v => v.ebayListingId)?.ebayListingId
                    : item.product?.ebayListingId;
                  const views = ebayId != null ? ebayViews[String(ebayId)] : undefined;
                  if (!views) return null;
                  return (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm">
                      {views >= 1000 ? `${(views / 1000).toFixed(1)}k` : views}
                    </span>
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-800 leading-snug line-clamp-2">{title}</p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    {status === 'ok'       && <><span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" /><span className="text-[10px] text-green-600 font-semibold">Listed OK</span></>}
                    {status === 'price'    && <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0 animate-pulse" /><span className="text-[10px] text-yellow-600 font-semibold">Price issue</span></>}
                    {status === 'issue'    && <><span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" /><span className="text-[10px] text-orange-500 font-semibold">Issue</span></>}
                    {status === 'unlisted' && <><span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" /><span className="text-[10px] text-gray-400">Not listed</span></>}
                    {item.type === 'group' && <span className="ml-1 text-[9px] text-gray-300">{item.variants.length}v</span>}
                  </div>
                  {/* Profit badge */}
                  {(() => {
                    const prices = item.type === 'group'
                      ? item.variants.map(v => v.current).filter(Boolean)
                      : [item.product.current].filter(Boolean);
                    if (!prices.length) return null;
                    const avgCost = prices.reduce((a, b) => a + b, 0) / prices.length;
                    const cp = calcEbayPrice(avgCost);
                    const p = +(cp - avgCost - calcEbayFee(cp)).toFixed(2);
                    return (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${p >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                        {p >= 0 ? '+' : ''}${p.toFixed(2)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AmazonPage() {
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
  const [selectedKey, setSelectedKey] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ebayViews, setEbayViews] = useState({}); // listingId → view count
  const socketRef = useRef(null);
  const ebayIdsRef = useRef([]); // kept in sync by loadProducts for fetchEbayViews
  const previewRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = detailOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [detailOpen]);

  useEffect(() => {
    if (preview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [preview]);

  useEffect(() => {
    loadProducts().then(fetchEbayViews);
    checkEbayStatus();

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

    socket.on('ebay:optimize:progress', ({ done, total }) => {
      setOptimizeProgress({ done, total });
    });

    socket.on('ebay:optimize:done', ({ total }) => {
      setOptimizeProgress({ done: total, total });
      setOptimizing(false);
      setTimeout(() => setOptimizeProgress(null), 4000);
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
    return () => { socket.disconnect(); clearInterval(poll); clearInterval(viewsPoll); };
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
      ebayIdsRef.current = [...new Set(data.map(p => p.ebayListingId).filter(Boolean))];
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

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError('');
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      if (data.variants && data.variants.length > 1) {
        setPreview(data);
        setPreviewGroupId(data.groupId || null);
        setSelectedAsins(new Set());
      } else {
        const { data: product } = await axios.post(`${API}/api/tracker`, { url: trimmed });
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
    const added = [];
    for (let i = 0; i < toAdd.length; i++) {
      setAddProgress(`Adding ${i + 1} of ${toAdd.length}…`);
      try {
        const { data } = await axios.post(`${API}/api/tracker`, { url: toAdd[i].url, groupId: previewGroupId });
        added.push(data);
      } catch {}
    }
    setProducts(prev => [...added.reverse(), ...prev]);
    setPreview(null);
    setSelectedAsins(new Set());
    setPreviewGroupId(null);
    setUrl('');
    setAddingVariants(false);
    setAddProgress('');
  }

  // ── Master-detail helpers ────────────────────────────────────────
  function getItemKey(item) {
    return item.type === 'group' ? `group-${item.groupId}` : `single-${item.product._id}`;
  }
  function getItemImage(item) {
    if (item.type === 'group') return item.variants.find(v => v.image)?.image || null;
    return item.product.image || null;
  }
  function getItemTitle(item) {
    if (item.type === 'group') return item.variants[0]?.title || 'Group Listing';
    return item.product.title || 'Product';
  }
  function getItemStatus(item) {
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

  // Build render list: group products sharing a groupId into group cards
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

  // Sort: items with any issue bubble to the top
  function itemHasIssue(item) {
    const s = getItemStatus(item);
    if (s === 'issue' || s === 'price') return true;
    const variants = item.type === 'group' ? item.variants : [item.product];
    return variants.some(v =>
      (v.status && v.status !== 'active') ||
      ebayFailedIds.has(String(v._id))
    );
  }
  renderItems.sort((a, b) => Number(itemHasIssue(b)) - Number(itemHasIssue(a)));

  // Auto-select first item; keep selection valid after deletions
  const selectedItem = renderItems.find(i => getItemKey(i) === selectedKey) || renderItems[0] || null;
  if (renderItems.length && getItemKey(renderItems[0]) !== selectedKey && !renderItems.some(i => getItemKey(i) === selectedKey)) {
    // selectedKey is stale — will be updated on next render via effect-less approach above
  }

  function toggleVariant(asin, checked) {
    const next = new Set(selectedAsins);
    if (checked) next.add(asin); else next.delete(asin);
    setSelectedAsins(next);
  }

  async function handleDelete(id) {
    await axios.delete(`${API}/api/tracker/${id}`);
    setProducts(prev => prev.filter(p => p._id !== id));
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

  async function handleCheckNow() {
    setChecking(true);
    setStatusMsg('Checking prices…');
    try {
      const { data } = await axios.post(`${API}/api/tracker/check`);
      if (data.products) setProducts(data.products);
    } catch {
    } finally {
      setChecking(false);
      setStatusMsg('');
    }
  }

  const [showDashboard, setShowDashboard] = useState(false);

const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(null); // { done, total }
  async function handleOptimizeAll() {
    setOptimizing(true);
    setOptimizeProgress({ done: 0, total: 0 });
    try {
      const { data } = await axios.post(`${API}/api/ebay/batch-optimize`);
      setOptimizeProgress({ done: 0, total: data.total });
    } catch {
      setOptimizing(false);
      setOptimizeProgress(null);
    }
  }

  const [retrying, setRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(null); // { done, total }
  async function handleRetryErrors() {
    const errorProducts = products.filter(p => ['error', 'unavailable', 'out_of_stock'].includes(p.status));
    if (!errorProducts.length) return;
    setRetrying(true);
    setRetryProgress({ done: 0, total: errorProducts.length });
    try {
      await axios.post(`${API}/api/tracker/retry-errors`);
      let done = 0;
      for (const p of errorProducts) {
        try {
          const { data } = await axios.post(`${API}/api/tracker/check/${p._id}`);
          setProducts(prev => prev.map(q => q._id === p._id ? data : q));
          if (data?.current != null && data?.ebayListingId) {
            const price = calcEbayPrice(data.current);
            await fetch(`${API}/api/ebay/listing/price`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingId: data.ebayListingId, price, variantLabel: data.variant || '' }),
            }).catch(() => {});
          }
        } catch {}
        done++;
        setRetryProgress({ done, total: errorProducts.length });
      }
    } catch {
    } finally {
      setRetrying(false);
      setTimeout(() => setRetryProgress(null), 4000);
    }
  }

  const [syncingEbay, setSyncingEbay] = useState(false);
  const [ebaySyncProgress, setEbaySyncProgress] = useState(null); // { done, total }
  async function handleSyncAllEbay() {
    const linked = products.filter(p => p.ebayListingId && p.current != null);
    if (!linked.length) return;
    setSyncingEbay(true);
    setEbaySyncProgress({ done: 0, total: linked.length });
    let done = 0;
    for (const p of linked) {
      try {
        const price = calcEbayPrice(p.current);
        await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: p.ebayListingId, price, variantLabel: p.variant || '' }),
        });
      } catch {}
      done++;
      setEbaySyncProgress({ done, total: linked.length });
    }
    setSyncingEbay(false);
    setTimeout(() => setEbaySyncProgress(null), 4000);
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-7">
      {showDashboard && <ProfitDashboard onClose={() => setShowDashboard(false)} />}

      <header className="mb-4 md:mb-7">
        {/* Main row: title + Check All always visible */}
        <div className="flex justify-between items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Amazon Price Tracker</h1>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {checking ? 'Checking…' : 'Check All'}
          </button>
        </div>

        {/* Admin buttons row: scrollable on mobile */}
        <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setShowDashboard(true)}
            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Dashboard
          </button>
          <button
            onClick={handleOptimizeAll}
            disabled={optimizing || checking}
            className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
          >
            {optimizing
              ? optimizeProgress?.total > 0 ? `Optimizing… ${optimizeProgress.done}/${optimizeProgress.total}` : 'Starting…'
              : optimizeProgress ? `✓ Done ${optimizeProgress.done}/${optimizeProgress.total}` : 'Optimize All'}
          </button>
{products.some(p => ['error','unavailable','out_of_stock'].includes(p.status)) && (
            <button
              onClick={handleRetryErrors}
              disabled={retrying || checking}
              className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
            >
              {retrying
                ? retryProgress ? `Retrying… ${retryProgress.done}/${retryProgress.total}` : 'Retrying…'
                : retryProgress ? `✓ Done ${retryProgress.done}/${retryProgress.total}`
                : `Retry Errors (${products.filter(p => ['error','unavailable','out_of_stock'].includes(p.status)).length})`}
            </button>
          )}
          {products.some(p => p.ebayListingId) && (
            <button
              onClick={handleSyncAllEbay}
              disabled={syncingEbay || checking}
              className="px-3 py-1.5 bg-[#fff0f0] border border-[#fcc] text-[#e53238] rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
            >
              {syncingEbay
                ? ebaySyncProgress ? `Syncing eBay… ${ebaySyncProgress.done}/${ebaySyncProgress.total}` : 'Starting…'
                : ebaySyncProgress ? `✓ Synced ${ebaySyncProgress.done}/${ebaySyncProgress.total}` : 'Sync All eBay'}
            </button>
          )}
        </div>
      </header>


      <div className="mb-5">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Paste an Amazon product URL to track…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={adding || !!preview}
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400 transition-colors disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={adding || !url.trim() || !!preview}
            className="px-5 py-2.5 bg-yellow-400 text-gray-900 font-bold text-sm rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {adding ? 'Loading…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}
      </div>

      {preview && (
        <div ref={previewRef} className="mb-5 bg-white border border-yellow-300 rounded-xl p-5">
          <div className="flex justify-between items-start mb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">
                  {preview.variants.length} variants found — select which to track:
                </p>
                {preview.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{preview.title}</p>
            </div>
            <button
              onClick={() => { setPreview(null); setSelectedAsins(new Set()); }}
              className="text-gray-300 hover:text-gray-500 text-xl leading-none ml-3"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1">
            {preview.variants.map(v => (
              <label
                key={v.asin}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAsins.has(v.asin)}
                  onChange={e => toggleVariant(v.asin, e.target.checked)}
                  className="w-4 h-4 accent-yellow-400 flex-shrink-0"
                />
                {v.image && (
                  <img src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded bg-gray-50 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-700 flex-1">{v.label}</span>
                {v.price != null
                  ? <span className="text-sm font-bold text-gray-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                  : <span className="text-xs text-gray-400 flex-shrink-0">price varies</span>
                }
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {selectedAsins.size === 0 && !addingVariants && (
              <p className="text-sm text-amber-600 font-medium">Select at least one variant to track</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleTrackSelected}
                disabled={addingVariants || selectedAsins.size === 0}
                className="px-4 py-2 bg-yellow-400 text-gray-900 font-bold text-sm rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingVariants ? addProgress : selectedAsins.size === 0 ? 'Track Selected' : `Track Selected (${selectedAsins.size})`}
              </button>
              <button
                onClick={() => setSelectedAsins(new Set(preview.variants.map(v => v.asin)))}
                disabled={addingVariants}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAsins(new Set())}
                disabled={addingVariants}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}

      {!ebayConnected && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-5 text-sm text-red-700">
          <span className="flex-shrink-0">⚠️</span>
          eBay token expired — prices won't sync until you
          <a href={`${API}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect eBay</a>.
        </div>
      )}
      {ebayConnected && ebayTokenDaysLeft !== null && ebayTokenDaysLeft <= 30 && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 mb-5 text-sm border ${ebayTokenDaysLeft <= 7 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <span className="flex-shrink-0">⚠️</span>
          eBay token expires in <strong className="mx-1">{ebayTokenDaysLeft} day{ebayTokenDaysLeft !== 1 ? 's' : ''}</strong> —
          <a href={`${API}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect now</a> to avoid disruption.
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 mb-5 text-sm text-yellow-800">
          <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
          {statusMsg}
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center mt-24 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base font-medium">No products tracked yet.</p>
          <p className="text-sm mt-1">Paste an Amazon URL above to start tracking prices.</p>
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
              getItemStatus={getItemStatus}
              ebayViews={ebayViews}
              apiUrl={API}
              ebayConnected={ebayConnected}
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
              getItemStatus={getItemStatus}
              ebayViews={ebayViews}
              apiUrl={API}
              ebayConnected={ebayConnected}
            />

            {/* RIGHT: detail panel — always use GroupCard layout (1 card for singles, N for groups) */}
            <div className="flex-1 min-w-0">
              {selectedItem && (
                selectedItem.type === 'group'
                  ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
                  : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile detail sheet ── */}
      {detailOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => setDetailOpen(false)}
              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              ‹ Listings
            </button>
            <p className="flex-1 text-xs text-gray-500 truncate min-w-0">
              {selectedItem && getItemTitle(selectedItem)}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-6">
            {selectedItem && (
              selectedItem.type === 'group'
                ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} />
                : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
