import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ProductGroupCard from '../components/ProductGroupCard';
import ProfitDashboard from '../components/ProfitDashboard';
import { calcEbayPrice, calcEbayFee, trueCost } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function SidebarList({ items, selectedKey, onSelect, getItemKey, getItemTitle, getItemImage, getItemStatus, ebayViews = {}, apiUrl = '', ebayConnected = true, mobile = false, saleMode = false }) {
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
                  {/* Profit badge */}
                  {(() => {
                    const prices = item.type === 'group'
                      ? item.variants.map(v => v.current).filter(Boolean)
                      : [item.product.current].filter(Boolean);
                    if (!prices.length) return null;
                    const avgCost = prices.reduce((a, b) => a + b, 0) / prices.length;
                    const cp = calcEbayPrice(avgCost, saleMode);
                    const p = +(cp - trueCost(avgCost) - calcEbayFee(cp)).toFixed(2);
                    return (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none ${p >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
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
  const [sellingLimits, setSellingLimits] = useState(null); // { used, limit, remaining }
  const [autoListStatus, setAutoListStatus] = useState({}); // productId → { step, error, ebayListingId }
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

  const [discoveryBanner, setDiscoveryBanner] = useState(null); // [{ asin, title, profit, ebayListingId }]

  useEffect(() => {
    // Sync sale mode + discovery results from DB
    axios.get(`${API}/api/tracker/settings`).then(({ data }) => {
      setSaleModeActive(data.saleModeActive);
      if (data.saleModeActive) localStorage.setItem('saleModeActive', 'true');
      else localStorage.removeItem('saleModeActive');
      // Show morning banner if discovery ran recently (last 12h) and added products
      if (data.lastDiscoveryAdded?.length && data.lastDiscoveryRun) {
        const age = Date.now() - new Date(data.lastDiscoveryRun).getTime();
        if (age < 12 * 60 * 60 * 1000) setDiscoveryBanner(data.lastDiscoveryAdded);
      }
    }).catch(() => {});

    loadProducts().then(fetchEbayViews);
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

    socket.on('tracker:discovery:done', ({ added }) => {
      if (added?.length) {
        setDiscoveryBanner(added);
        loadProducts();
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

    socket.on('tracker:auto-list:start', ({ productIds, title }) => {
      setAutoListStatus(prev => {
        const next = { ...prev };
        (productIds || []).forEach(id => { next[id] = { step: 'images', title }; });
        return next;
      });
    });

    socket.on('tracker:auto-list:step', ({ productIds, step }) => {
      setAutoListStatus(prev => {
        const next = { ...prev };
        (productIds || []).forEach(id => { if (next[id]) next[id] = { ...next[id], step }; });
        return next;
      });
    });

    socket.on('tracker:auto-list:done', ({ productIds, ebayListingId }) => {
      setAutoListStatus(prev => {
        const next = { ...prev };
        (productIds || []).forEach(id => { next[id] = { step: 'done', ebayListingId }; });
        return next;
      });
      loadProducts();
      setTimeout(() => setAutoListStatus(prev => {
        const next = { ...prev };
        (productIds || []).forEach(id => { delete next[id]; });
        return next;
      }), 6000);
    });

    socket.on('tracker:auto-list:error', ({ productIds, error }) => {
      setAutoListStatus(prev => {
        const next = { ...prev };
        (productIds || []).forEach(id => { next[id] = { step: 'error', error }; });
        return next;
      });
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

  // Sort: items with any issue bubble to the top, then by most eBay views
  function itemHasIssue(item) {
    const s = getItemStatus(item);
    if (s === 'issue' || s === 'price') return true;
    const variants = item.type === 'group' ? item.variants : [item.product];
    return variants.some(v =>
      (v.status && v.status !== 'active') ||
      ebayFailedIds.has(String(v._id))
    );
  }
  function itemEbayViews(item) {
    const variants = item.type === 'group' ? item.variants : [item.product];
    return variants.reduce((max, v) => {
      const views = v.ebayListingId ? (ebayViews[String(v.ebayListingId)] ?? 0) : 0;
      return Math.max(max, views);
    }, 0);
  }
  renderItems.sort((a, b) => {
    const issueDiff = Number(itemHasIssue(b)) - Number(itemHasIssue(a));
    if (issueDiff !== 0) return issueDiff;
    return itemEbayViews(b) - itemEbayViews(a);
  });

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

  const [showDashboard, setShowDashboard] = useState(false);



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
      {showDashboard && <ProfitDashboard onClose={() => setShowDashboard(false)} />}

      <header className="mb-4 md:mb-6">
        <div className="bg-white/90 backdrop-blur-sm border border-slate-200/70 rounded-2xl shadow-soft px-4 py-3.5 md:px-5 md:py-4">
          {/* Main row: brand + status pills + primary action */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amazon text-white text-lg shadow-soft flex-shrink-0">
                📦
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                  Amazon Price Tracker
                </h1>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {sellingLimits && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ring-1 ring-inset ${
                      sellingLimits.remaining <= 10 ? 'bg-red-50 text-red-600 ring-red-200' :
                      sellingLimits.remaining <= 30 ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                      'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    }`}>
                      {sellingLimits.used}/{sellingLimits.limit} listings
                    </span>
                  )}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider whitespace-nowrap ring-1 ring-inset ${
                    saleModeActive
                      ? 'bg-ebay text-white ring-ebay-dark'
                      : 'bg-slate-50 text-slate-400 ring-slate-200'
                  }`}>
                    {saleModeActive ? '🔥 SALE MODE' : 'NORMAL'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleCheckNow}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 md:px-4 md:py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-soft hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap flex-shrink-0"
            >
              <span className={checking ? 'animate-spin inline-block' : ''}>↻</span>
              <span className="hidden sm:inline">{checking ? 'Checking…' : 'Check All'}</span>
            </button>
          </div>

          {/* Admin/utility row: scrollable on mobile, visually de-emphasized vs primary action */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowDashboard(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap flex-shrink-0"
            >
              📊 Dashboard
            </button>

            <button
              onClick={handleSaleMode}
              onBlur={() => setSaleModeConfirm(false)}
              disabled={saleMode || saleModeResetting || checking}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5
                ${saleMode || saleModeResetting ? (saleModeActive ? 'bg-ebay text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200') :
                  saleModeConfirm ? (saleModeActive ? 'bg-ebay-dark text-white hover:bg-red-800' : 'bg-emerald-500 text-white hover:bg-emerald-600') :
                  saleModeActive ? 'bg-ebay text-white hover:bg-ebay-dark' :
                  'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'}`}
            >
              {saleModeActive && !saleMode && !saleModeResetting && !saleModeConfirm && (
                <span className="bg-white/90 text-ebay text-[9px] font-black px-1 py-0.5 rounded leading-none">SALE</span>
              )}
              {saleMode ? 'Repricing…'
                : saleModeResetting ? 'Resetting prices…'
                : saleModeResult?.error ? '⚠ Failed'
                : saleModeResult && !saleModeActive ? `✓ Normal ${saleModeResult.done}/${saleModeResult.total}`
                : saleModeResult ? `✓ Done ${saleModeResult.done}/${saleModeResult.total}`
                : saleModeConfirm && saleModeActive ? 'Tap to confirm end sale'
                : saleModeConfirm ? 'Tap again to confirm'
                : saleModeActive ? '🔥 Sale ON — tap to end'
                : '🏷️ Sale Mode (2% profit)'}
            </button>
            {products.some(p => ['error','unavailable','out_of_stock'].includes(p.status)) && (
              <button
                onClick={handleRetryErrors}
                disabled={retrying || checking}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
              >
                {retrying
                  ? retryProgress ? `↻ Retrying… ${retryProgress.done}/${retryProgress.total}` : '↻ Retrying…'
                  : retryProgress ? `✓ Done ${retryProgress.done}/${retryProgress.total}`
                  : `⚠ Retry Errors (${products.filter(p => ['error','unavailable','out_of_stock'].includes(p.status)).length})`}
              </button>
            )}
            <button
              onClick={handleCleanOrphans}
              disabled={cleaningOrphans || checking}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
            >
              {cleaningOrphans ? '🔍 Scanning…'
                : orphanResult?.error ? '⚠ Failed'
                : orphanResult?.found === 0 ? '✓ No orphans'
                : orphanResult?.found > 0 ? `✓ Ended ${orphanResult.ended}/${orphanResult.found}`
                : '🧹 Clean Orphans'}
            </button>
          </div>
        </div>
      </header>


      <div className="mb-4">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
            <input
              type="text"
              placeholder="Paste an Amazon product URL to track…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={adding || !!preview}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 placeholder:text-slate-400 shadow-soft"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !url.trim() || !!preview}
            className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
          >
            {adding ? 'Loading…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2 px-1">{addError}</p>}
      </div>

      {preview && (
        <div ref={previewRef} className="mb-5 bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up">
          <div className="flex justify-between items-start mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">
                  {preview.variants.length} variants found — select which to track
                </p>
                {preview.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{preview.title}</p>
            </div>
            <button
              onClick={() => { setPreview(null); setSelectedAsins(new Set()); }}
              className="text-slate-300 hover:text-slate-500 text-xl leading-none ml-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {preview.variants.map(v => (
              <label
                key={v.asin}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAsins.has(v.asin)}
                  onChange={e => toggleVariant(v.asin, e.target.checked)}
                  className="w-4 h-4 accent-amazon flex-shrink-0"
                />
                {v.image && (
                  <img src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                )}
                <span className="text-sm text-slate-700 flex-1">{v.label}</span>
                {v.price != null
                  ? <span className="text-sm font-bold text-slate-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                  : <span className="text-xs text-slate-400 flex-shrink-0">price varies</span>
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
                className="px-4 py-2 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft"
              >
                {addingVariants ? addProgress : selectedAsins.size === 0 ? 'Track Selected' : `Track Selected (${selectedAsins.size})`}
              </button>
              <button
                onClick={() => setSelectedAsins(new Set(preview.variants.map(v => v.asin)))}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAsins(new Set())}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}

      {!ebayConnected && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-red-700 shadow-soft">
          <span className="flex-shrink-0">⚠️</span>
          eBay token expired — prices won't sync until you
          <a href={`${API}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect eBay</a>.
        </div>
      )}
      {ebayConnected && ebayTokenDaysLeft !== null && ebayTokenDaysLeft <= 30 && (
        <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-4 text-sm border shadow-soft ${ebayTokenDaysLeft <= 7 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <span className="flex-shrink-0">⚠️</span>
          eBay token expires in <strong className="mx-1">{ebayTokenDaysLeft} day{ebayTokenDaysLeft !== 1 ? 's' : ''}</strong> —
          <a href={`${API}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect now</a> to avoid disruption.
        </div>
      )}

      {discoveryBanner?.length > 0 && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-800 shadow-soft">
          <span className="flex-shrink-0 text-base">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1">Auto-discovery added {discoveryBanner.length} new listing{discoveryBanner.length !== 1 ? 's' : ''} overnight</p>
            <ul className="space-y-0.5">
              {discoveryBanner.map((item, i) => (
                <li key={i} className="text-xs text-emerald-700 truncate">
                  <span className="font-medium">+${item.profit?.toFixed(2)}</span> — {item.title}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => {
              setDiscoveryBanner(null);
              axios.post(`${API}/api/tracker/settings/dismiss-discovery`).catch(() => {});
            }}
            className="flex-shrink-0 text-emerald-400 hover:text-emerald-600 text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-emerald-100 transition-colors"
          >✕</button>
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-amber-800 shadow-soft">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          {statusMsg}
        </div>
      )}

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
              getItemStatus={getItemStatus}
              ebayViews={ebayViews}
              apiUrl={API}
              ebayConnected={ebayConnected}
              saleMode={saleModeActive}
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
              saleMode={saleModeActive}
            />

            {/* RIGHT: detail panel — always use GroupCard layout (1 card for singles, N for groups) */}
            <div className="flex-1 min-w-0">
              {selectedItem && (
                selectedItem.type === 'group'
                  ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} saleMode={saleModeActive} autoListStatus={autoListStatus} />
                  : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={handleDelete} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} saleMode={saleModeActive} autoListStatus={autoListStatus} />
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
                ? <ProductGroupCard key={getItemKey(selectedItem)} variants={selectedItem.variants} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} onPriceMismatch={handlePriceMismatch} saleMode={saleModeActive} autoListStatus={autoListStatus} />
                : <ProductGroupCard key={selectedItem.product._id} variants={[selectedItem.product]} onCheck={handleCheckOne} onDelete={(id) => { handleDelete(id); setDetailOpen(false); }} onUpdate={handleUpdate} ebayFailedIds={ebayFailedIds} detailMode={true} saleMode={saleModeActive} autoListStatus={autoListStatus} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
