import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ProductGroupCard from '../components/ProductGroupCard';
import SidebarList from '../components/SidebarList';
import TrackerHeader from '../components/TrackerHeader';
import TrackerBanners from '../components/TrackerBanners';
import AddProductPanel from '../components/AddProductPanel';
import DealSearchPanel from '../components/DealSearchPanel';
import { getItemKey, getItemImage, getItemTitle, getItemStatus, buildRenderItems, sortRenderItems } from '../utils/trackerItems';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  const [ebayWatchers, setEbayWatchers] = useState({}); // listingId → watcher count
  const [blankPhotoIds, setBlankPhotoIds] = useState(new Set()); // eBay listing IDs with no photos
  const [sellingLimits, setSellingLimits] = useState(null); // { used, limit, remaining }
  const socketRef = useRef(null);
  const ebayIdsRef = useRef([]); // kept in sync by loadProducts for fetchEbayViews
  const previewRef = useRef(null);
  const deletingEbayIds = useRef(new Set()); // dedup concurrent eBay END calls for grouped variants

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
    // Sync sale mode from DB
    axios.get(`${API}/api/tracker/settings`).then(({ data }) => {
      setSaleModeActive(data.saleModeActive);
      if (data.saleModeActive) localStorage.setItem('saleModeActive', 'true');
      else localStorage.removeItem('saleModeActive');
    }).catch(() => {});

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

    socket.on('tracker:orphan:cleanup', ({ found, ended }) => {
      setCleaningOrphans(false);
      if (found > 0) {
        setOrphanResult({ found, ended });
        setTimeout(() => setOrphanResult(null), 8000);
      } else {
        setOrphanResult({ found: 0, ended: 0 });
        setTimeout(() => setOrphanResult(null), 4000);
      }
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
      ebayIdsRef.current = [...new Set(data.map(p => p.ebayListingId).filter(Boolean))];
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
        setSelectedAsins(new Set(data.variants.map(v => v.asin)));
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

  async function handleTrackDeal(url) {
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url });
      if (data.variants && data.variants.length > 1) {
        setPreview(data);
        setPreviewGroupId(data.groupId || null);
        setSelectedAsins(new Set(data.variants.map(v => v.asin)));
      } else {
        const { data: product } = await axios.post(`${API}/api/tracker`, { url });
        setProducts(prev => [product, ...prev]);
        setStatusMsg(product.isPrime ? '✓ Tracked — Prime eligible' : '✓ Tracked — No Prime');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch (err) {
      if (err.response?.status !== 409) {
        setStatusMsg(err.response?.data?.error || 'Failed to track item.');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    }
  }

  async function handleTrackSelected() {
    if (!preview || selectedAsins.size === 0) return;
    setAddingVariants(true);
    setAddError('');
    const toAdd = preview.variants.filter(v => selectedAsins.has(v.asin));
    let failCount = 0;
    for (let i = 0; i < toAdd.length; i++) {
      setAddProgress(`Adding ${i + 1} of ${toAdd.length}…`);
      try {
        await axios.post(`${API}/api/tracker`, { url: toAdd[i].url, groupId: previewGroupId });
      } catch (err) {
        if (err.response?.status !== 409) {
          // 409 = already tracking, safe to ignore; anything else = real failure
          failCount++;
          console.warn(`Failed to add variant ${toAdd[i].asin}:`, err.response?.data?.error || err.message);
        }
      }
      // Small delay between calls so ScraperAPI doesn't rate-limit sequential requests
      if (i < toAdd.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    // Reload from server — avoids duplicate race with the 30s poll that may have fired mid-add
    await loadProducts();
    setPreview(null);
    setSelectedAsins(new Set());
    setPreviewGroupId(null);
    setUrl('');
    setAddingVariants(false);
    setAddProgress('');
    if (failCount > 0) setAddError(`${failCount} variant(s) failed to add — they may have timed out. Try adding them individually.`);
  }

  // ── Master-detail helpers (pure logic lives in utils/trackerItems) ──
  const itemStatus = (item) => getItemStatus(item, ebayFailedIds, priceMismatchIds);

  const renderItems = sortRenderItems(buildRenderItems(products), ebayFailedIds, priceMismatchIds, ebayViews, ebayWatchers);
  const trackedAsins = new Set(products.map(p => (p.url.match(/\/dp\/([A-Z0-9]{10})/i) || [])[1]).filter(Boolean));

  // Auto-select first item; reset stale key after deletions
  const selectedItem = renderItems.find(i => getItemKey(i) === selectedKey) || renderItems[0] || null;
  useEffect(() => {
    if (selectedKey && renderItems.length && !renderItems.some(i => getItemKey(i) === selectedKey)) {
      setSelectedKey(renderItems[0] ? getItemKey(renderItems[0]) : null);
    }
  }, [renderItems.map(getItemKey).join(',')]);

  function toggleVariant(asin, checked) {
    const next = new Set(selectedAsins);
    if (checked) next.add(asin); else next.delete(asin);
    setSelectedAsins(next);
  }

  async function handleDelete(id) {
    const product = products.find(p => p._id === id);
    if (product?.ebayListingId) {
      const lid = String(product.ebayListingId);
      if (!deletingEbayIds.current.has(lid)) {
        deletingEbayIds.current.add(lid);
        await axios.delete(`${API}/api/ebay/listing/${lid}`).catch(() => {});
        deletingEbayIds.current.delete(lid);
      }
    }
    await axios.delete(`${API}/api/tracker/${id}`);
    setProducts(prev => prev.filter(p => p._id !== id));
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
      const { data } = await axios.post(`${API}/api/tracker/check/${id}`, { saleMode: saleModeActive });
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


  const [saleMode, setSaleMode] = useState(false);
  const [saleModeResetting, setSaleModeResetting] = useState(false);
  const [saleModeResult, setSaleModeResult] = useState(null);
  const [saleModeConfirm, setSaleModeConfirm] = useState(false);
  const [saleModeActive, setSaleModeActive] = useState(() => localStorage.getItem('saleModeActive') === 'true');
  async function handleSaleMode() {
    if (!saleModeConfirm) { setSaleModeConfirm(true); return; }
    setSaleModeConfirm(false);
    setSaleModeResult(null);

    if (saleModeActive) {
      // Turn OFF: reprice back to normal and clear DB flag
      setSaleModeResetting(true);
      try {
        const { data } = await axios.post(`${API}/api/ebay/sale-mode`, { active: false });
        setSaleModeResult(data);
        if (!data.error) {
          setSaleModeActive(false);
          localStorage.removeItem('saleModeActive');
        }
      } catch (e) {
        setSaleModeResult({ error: e.response?.data?.error || e.message });
      } finally {
        setSaleModeResetting(false);
      }
    } else {
      // Turn ON: reprice at sale pricing and set DB flag
      setSaleMode(true);
      try {
        const { data } = await axios.post(`${API}/api/ebay/sale-mode`, { active: true });
        setSaleModeResult(data);
        if (!data.error) {
          setSaleModeActive(true);
          localStorage.setItem('saleModeActive', 'true');
        }
      } catch (e) {
        setSaleModeResult({ error: e.response?.data?.error || e.message });
      } finally {
        setSaleMode(false);
      }
    }
  }


const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [orphanResult, setOrphanResult] = useState(null); // { found, ended } | null
  async function handleCleanOrphans() {
    setCleaningOrphans(true);
    setOrphanResult(null);
    try {
      // DELETE triggers the scheduler's orphanCleanup which emits tracker:orphan:cleanup when done
      await axios.delete(`${API}/api/ebay/orphan-listings`);
      // Result comes back via socket — spinner will stop there
    } catch (e) {
      setOrphanResult({ error: e.response?.data?.error || e.message });
      setCleaningOrphans(false);
      setTimeout(() => setOrphanResult(null), 6000);
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
      await axios.post(`${API}/api/tracker/retry-errors`).catch(() => {}); // non-fatal
      const total = errorProducts.length;
      let done = 0;
      const BATCH = 5;
      for (let i = 0; i < errorProducts.length; i += BATCH) {
        await Promise.all(errorProducts.slice(i, i + BATCH).map(async p => {
          try {
            const { data } = await axios.post(`${API}/api/tracker/check/${p._id}`, { saleMode: saleModeActive });
            setProducts(prev => prev.map(q => q._id === p._id ? data : q));
          } catch {}
          done++;
          setRetryProgress({ done, total });
        }));
      }
    } catch {
    } finally {
      setRetrying(false);
      setTimeout(() => setRetryProgress(null), 4000);
    }
  }


  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <TrackerHeader
        sellingLimits={sellingLimits}
        saleModeActive={saleModeActive} saleMode={saleMode} saleModeResetting={saleModeResetting}
        saleModeResult={saleModeResult} saleModeConfirm={saleModeConfirm}
        handleSaleMode={handleSaleMode} setSaleModeConfirm={setSaleModeConfirm}
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
      />

      <DealSearchPanel onTrack={handleTrackDeal} trackedAsins={trackedAsins} />

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
              saleMode={saleModeActive}
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
              saleMode={saleModeActive}
              blankPhotoIds={blankPhotoIds}
            />

            {/* RIGHT: detail panel — always use GroupCard layout (1 card for singles, N for groups) */}
            <div className="flex-1 min-w-0">
              {selectedItem && (
                selectedItem.type === 'group'
                  ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} saleMode={saleModeActive} />
                  : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} saleMode={saleModeActive} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile detail sheet ── */}
      {detailOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-50 flex flex-col animate-slide-in-right">
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
                ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} saleMode={saleModeActive} />
                : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} onVariantDeleted={handleVariantDeleted} ebayFailedIds={ebayFailedIds} detailMode={true} saleMode={saleModeActive} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
