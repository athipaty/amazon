import { useState, useEffect, useRef } from 'react';
import { calcEbayPrice, calcEbayFee } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AmazonPrimeBadge() {
  return (
    <span className="inline-flex flex-col items-center leading-none select-none" title="Amazon Prime">
      <span
        style={{ background: '#00A8E0', fontFamily: 'Georgia, serif' }}
        className="text-white text-[9px] font-extrabold italic tracking-widest px-2 pt-[3px] pb-[1px] rounded-t-sm"
      >
        prime
      </span>
      <svg viewBox="0 0 40 8" className="w-8" style={{ display: 'block', marginTop: '-1px' }} aria-hidden="true">
        <path d="M2 2 Q10 7 20 5 Q30 3 38 6" fill="none" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" />
        <polygon points="35,3 39,6 35.5,8" fill="#FF9900" />
      </svg>
    </span>
  );
}

function useCountdown(target) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function update() {
      const diff = new Date(target) - new Date();
      if (diff <= 0) { setRemaining('soon'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

const SKIP_SPEC_KEYS = new Set(['asin', 'upc']);
function fmtKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val != null).map(([k, val]) => `${fmtKey(k)}: ${val}`).join(' · ');
  return String(v);
}

export default function ProductGroupCard({ variants, onCheck, onDelete, onUpdate, ebayFailedIds, detailMode = false, onPriceMismatch }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [allExpanded, setAllExpanded] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function toggleExpand(idx) {
    setAllExpanded(prev => !prev);
    setActiveIdx(idx);
  }
  const [editingEbay, setEditingEbay] = useState(false);
  const [ebayInput, setEbayInput] = useState('');
  const [savingEbay, setSavingEbay] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [refreshResults, setRefreshResults] = useState({}); // id -> 'ok' | 'fail'
  const [ebayPushResults, setEbayPushResults] = useState({}); // id -> 'ok' | 'fail'
  const [linkStatus, setLinkStatus] = useState(''); // '' | 'pushing' | 'ok' | 'fail'
  const [autoListing, setAutoListing] = useState(false);
  const [autoListStep, setAutoListStep] = useState('');
  const [autoListError, setAutoListError] = useState('');
  const [fixingPhotos, setFixingPhotos] = useState(false);
  const [fixPhotosStatus, setFixPhotosStatus] = useState(''); // '' | 'ok' | 'fail'
  const [fixPhotosError, setFixPhotosError] = useState('');
  const [revisingDesc, setRevisingDesc] = useState(false);
  const [reviseDescStatus, setReviseDescStatus] = useState(''); // '' | 'ok' | 'fail'
  const [reviseDescError, setReviseDescError] = useState('');
  const [competitorData, setCompetitorData] = useState(null); // { lowest, avg, count }

  const groupEbayId = variants.find(v => v.ebayListingId)?.ebayListingId || null;
  const anySyncFailed = ebayFailedIds && variants.some(v => ebayFailedIds.has(String(v._id)));
  const [ebayLivePrices, setEbayLivePrices] = useState(null);
  const [autoSyncErrors, setAutoSyncErrors] = useState({}); // variantId -> error string
  const autoSyncDone = useRef(false);

  async function fetchEbayPrices() {
    if (!groupEbayId) return;
    try {
      const r = await fetch(`${API}/api/ebay/listing/${groupEbayId}/prices`);
      const d = await r.json();
      setEbayLivePrices(d);
    } catch {}
  }

  useEffect(() => {
    fetchEbayPrices();
    // Stagger competitor fetches (0–3s random) so 34 cards don't all fire at once
    const primary = variants.find(v => v.upc) || variants[0];
    if (!primary) return;
    const params = new URLSearchParams();
    if (primary.upc) params.set('upc', primary.upc);
    else if (primary.title) params.set('title', primary.title.split(' ').slice(0, 6).join(' '));
    const t = setTimeout(() => {
      fetch(`${API}/api/ebay/competitors?${params}`)
        .then(r => r.json())
        .then(d => { if (d.count > 0) setCompetitorData(d); })
        .catch(() => {});
    }, Math.random() * 3000);
    return () => clearTimeout(t);
  }, [groupEbayId]);

  // Auto-fix mismatched eBay prices as soon as live prices are fetched
  useEffect(() => {
    if (!ebayLivePrices || !groupEbayId || autoSyncDone.current) return;
    autoSyncDone.current = true;

    const mismatches = variants.filter(v => {
      const calcPrice = calcEbayPrice(v.current);
      const livePrice = getLivePrice(v.variant || '');
      return livePrice != null && Math.abs(livePrice - calcPrice) >= 0.02;
    });
    // Notify parent sidebar: price issue detected
    if (mismatches.length) onPriceMismatch?.(groupEbayId, true);
    if (!mismatches.length) { onPriceMismatch?.(groupEbayId, false); return; }

    const ids = new Set(mismatches.map(v => v._id));
    setRefreshingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setAutoSyncErrors({});

    Promise.all(mismatches.map(async v => {
      const calcPrice = calcEbayPrice(v.current);
      try {
        const r = await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: groupEbayId, price: calcPrice, variantLabel: v.variant || '' }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setAutoSyncErrors(prev => ({ ...prev, [v._id]: body.error || `HTTP ${r.status}` }));
        }
      } catch (e) {
        setAutoSyncErrors(prev => ({ ...prev, [v._id]: e.message || 'Network error' }));
      }
    })).finally(() => {
      setRefreshingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      // Re-fetch actual eBay prices to confirm sync — clears price issue if all fixed
      setTimeout(() => {
        fetchEbayPrices();
        onPriceMismatch?.(groupEbayId, false); // optimistically clear; will re-trigger if still mismatched
      }, 4000);
    });
  }, [ebayLivePrices]); // autoSyncDone ref prevents looping when fetchEbayPrices re-sets ebayLivePrices

  async function handleCheckOne(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const updated = await onCheck(id);
      if (updated?.current != null && groupEbayId) {
        const newCalcPrice = Math.floor(updated.current * 1.45) + 0.99;
        const variantLabel = variants.find(v => v._id === id)?.variant || '';
        const r = await fetch(`${API}/api/ebay/listing/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: groupEbayId, price: newCalcPrice, variantLabel }),
        });
        if (r.ok) {
          setEbayPushResults(prev => ({ ...prev, [id]: 'ok' }));
          // eBay has propagation delay — update display state optimistically
          const label = variantLabel.toLowerCase();
          setEbayLivePrices(prev => {
            if (!prev) return prev;
            if (prev.variations?.length) {
              return {
                ...prev,
                variations: prev.variations.map(v => {
                  const hit = Object.values(v.specs).some(val =>
                    val === label || label.includes(val) || val.includes(label)
                  );
                  return hit ? { ...v, price: newCalcPrice } : v;
                }),
              };
            }
            return { ...prev, base: newCalcPrice };
          });
        } else {
          setEbayPushResults(prev => ({ ...prev, [id]: 'fail' }));
          await fetchEbayPrices();
        }
      }
      setRefreshResults(prev => ({ ...prev, [id]: 'ok' }));
    } catch {
      setRefreshResults(prev => ({ ...prev, [id]: 'fail' }));
    } finally {
      setRefreshingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setTimeout(() => {
        setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
        setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
      }, 6000);
    }
  }

  function getLivePrice(variantLabel) {
    if (!ebayLivePrices) return null;
    const label = (variantLabel || '').toLowerCase();
    if (ebayLivePrices.variations?.length) {
      const match = ebayLivePrices.variations.find(v =>
        Object.values(v.specs).some(val => val === label || label.includes(val) || val.includes(label))
      );
      if (match) return match.price;
    }
    return ebayLivePrices.base || null;
  }

  async function openEbayEdit(prefill) {
    setEbayInput(prefill || '');
    setEditingEbay(true);
    try {
      const r = await fetch(`${API}/api/ebay/all-active-listings`);
      const data = await r.json();
      setMyListings(Array.isArray(data) ? data : []);
    } catch { setMyListings([]); }
  }

  async function saveEbayListing() {
    setSavingEbay(true);
    setLinkStatus('');
    try {
      const id = ebayInput.trim().replace(/.*\/itm\/(\d+).*/,'$1');
      for (const v of variants) {
        const res = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ebayListingId: id || null }),
        });
        const updated = await res.json();
        onUpdate?.(updated);
      }
      setEditingEbay(false);
      if (id) {
        setLinkStatus('pushing');
        let anyFail = false;
        for (const v of variants) {
          const calcPrice = calcEbayPrice(v.current);
          const r = await fetch(`${API}/api/ebay/listing/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId: id, price: calcPrice, variantLabel: v.variant || '' }),
          });
          if (!r.ok) anyFail = true;
        }
        setLinkStatus(anyFail ? 'fail' : 'ok');
        setTimeout(() => setLinkStatus(''), 5000);
      }
    } finally { setSavingEbay(false); }
  }

  async function autoListOnEbay() {
    setAutoListing(true);
    setAutoListError('');
    try {
      // Step 1: Generate SEO title from first variant
      setAutoListStep('title');
      const titleRes = await fetch(`${API}/api/ebay/seo-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, specs: active.specs }),
      });
      const titleData = await titleRes.json();
      const ebayTitle = titleData.title || active.title;

      // Step 2: Upload ALL images per variant separately so each variant gets its own photo set
      setAutoListStep('images');
      const slug = (active.specs?.asin || String(active._id).slice(-8)).toLowerCase().replace(/[^a-z0-9]/g, '');

      const variantCloudinaryImages = [];
      for (const v of variants) {
        const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
        if (!varImgs.length) { variantCloudinaryImages.push([]); continue; }
        const varSlug = slug + '-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          const uploadData = await uploadRes.json();
          variantCloudinaryImages.push(uploadData.cloudinaryUrls || []);
        } catch { variantCloudinaryImages.push([]); }
      }
      // Combine all for the main listing gallery (deduplicated, max 12)
      const cloudinaryUrls = [...new Set(variantCloudinaryImages.flat())].slice(0, 12);

      // Step 3: Create multi-variation eBay listing
      setAutoListStep('listing');
      const variantDimension = variants.some(v => (v.variant || '').match(/\d+["']/)) ? 'Size'
        : variants.some(v => (v.variant || '').match(/\b(red|blue|green|black|white|gray|pink|purple|yellow|orange|brown|natural|carbonized)\b/i)) ? 'Color'
        : 'Style';

      const variantPayload = variants.map((v, i) => ({
        label: v.variant || `Variant ${i + 1}`,
        price: (calcEbayPrice(v.current)).toFixed(2),
        quantity: 2,
        images: variantCloudinaryImages[i] || [],
        image: variantCloudinaryImages[i]?.[0] || null,
      }));

      // Step 3: Generate HTML description
      setAutoListStep('description');
      let listingDescription = null;
      try {
        const descRes = await fetch(`${API}/api/ebay/generate-description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: ebayTitle, specs: active.specs || {}, imageUrls: cloudinaryUrls, bullets: active.bullets || [], upc: active.upc, variant: active.variant }),
        });
        const descData = await descRes.json();
        listingDescription = descData.html || null;
      } catch { /* fall back to generic placeholder */ }

      // Step 4: Create eBay listing
      setAutoListStep('listing');
      const listRes = await fetch(`${API}/api/ebay/trading-create-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ebayTitle,
          price: (calcEbayPrice(active.current)).toFixed(2),
          imageUrls: cloudinaryUrls,
          upc: active.upc,
          specs: active.specs || {},
          variants: variantPayload,
          variantDimension,
          ...(listingDescription ? { description: listingDescription } : {}),
        }),
      });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error || 'eBay listing failed');

      // Step 5: Verify & fix any price mismatches immediately after listing
      setAutoListStep('verifying');
      try {
        await new Promise(r => setTimeout(r, 3000)); // wait for eBay to process
        const priceRes = await fetch(`${API}/api/ebay/listing/${listData.listingId}/prices`);
        const priceData = await priceRes.json();
        const mismatchFixes = variantPayload.filter(vp => {
          const live = priceData.variations?.find(lv =>
            Object.values(lv.specs || {}).some(val => val.toLowerCase() === vp.label.toLowerCase())
          );
          return live && Math.abs(live.price - parseFloat(vp.price)) > 0.02;
        });
        for (const vp of mismatchFixes) {
          await fetch(`${API}/api/ebay/listing/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId: listData.listingId, price: vp.price, variantLabel: vp.label }),
          });
        }
        if (mismatchFixes.length) console.log(`Auto-fixed ${mismatchFixes.length} price mismatches on new listing ${listData.listingId}`);
      } catch { /* non-critical — listing was created, prices can be fixed manually */ }

      // Step 6: Save listing ID to all variants
      setAutoListStep('saving');
      for (const v of variants) {
        const saveRes = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ebayListingId: listData.listingId }),
        });
        const updated = await saveRes.json();
        onUpdate?.(updated);
      }
    } catch (e) {
      setAutoListError(e.message.slice(0, 300));
    } finally {
      setAutoListing(false);
      setAutoListStep('');
    }
  }

  async function fixVariationPhotos() {
    if (!groupEbayId) return;
    setFixingPhotos(true);
    setFixPhotosStatus('');
    setFixPhotosError('');
    try {
      // Step 1: Refresh images from Amazon for each variant (gets full hi-res set, not just what was scraped)
      const refreshed = await Promise.all(
        variants.map(v =>
          fetch(`${API}/api/tracker/${v._id}/refresh-images`, { method: 'POST' })
            .then(r => r.json())
            .catch(() => null)
        )
      );

      // Merge refreshed image list back into variant data
      const variantsWithFreshImages = variants.map((v, i) => ({
        ...v,
        images: refreshed[i]?.images?.length ? refreshed[i].images : (v.images?.length ? v.images : [v.image].filter(Boolean)),
      }));

      // Step 2: Upload ALL images per variant separately
      const slug = (active.specs?.asin || String(active._id).slice(-8)).toLowerCase().replace(/[^a-z0-9]/g, '');
      const variantCloudinaryImages = [];
      for (const v of variantsWithFreshImages) {
        const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
        if (!varImgs.length) { variantCloudinaryImages.push([]); continue; }
        const varSlug = slug + '-fix-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          variantCloudinaryImages.push((await uploadRes.json()).cloudinaryUrls || []);
        } catch { variantCloudinaryImages.push([]); }
      }

      const variantDimension = variants.some(v => (v.variant || '').match(/\d+["']/)) ? 'Size'
        : variants.some(v => (v.variant || '').match(/\b(red|blue|green|black|white|gray|pink|purple|yellow|orange|brown|natural|carbonized)\b/i)) ? 'Color'
        : 'Style';

      const variantPayload = variants.map((v, i) => ({
        label: v.variant || `Variant ${i + 1}`,
        images: variantCloudinaryImages[i] || [],
        image: variantCloudinaryImages[i]?.[0] || null,
      })).filter(v => v.images.length);

      const res = await fetch(`${API}/api/ebay/listing/variation-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: groupEbayId, variantDimension, variants: variantPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFixPhotosStatus('ok');
      setTimeout(() => setFixPhotosStatus(''), 5000);
    } catch (e) {
      setFixPhotosStatus('fail');
      setFixPhotosError(e.message.slice(0, 200));
    } finally {
      setFixingPhotos(false);
    }
  }

  async function reviseDescription() {
    if (!groupEbayId) return;
    setRevisingDesc(true);
    setReviseDescStatus('');
    setReviseDescError('');
    try {
      const slug = (active.specs?.asin || String(active._id).slice(-8)).toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawImages = [...new Set([active.image, ...(active.images || [])].filter(Boolean))].slice(0, 8);
      let imageUrls = rawImages;
      if (rawImages.length) {
        const up = await fetch(`${API}/api/ebay/upload-images`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrls: rawImages, slug: slug + '-rdesc' }),
        });
        imageUrls = (await up.json()).cloudinaryUrls || rawImages;
      }
      const descRes = await fetch(`${API}/api/ebay/generate-description`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, specs: active.specs || {}, imageUrls, bullets: active.bullets || [], upc: active.upc, variant: active.variant }),
      });
      const { html } = await descRes.json();
      if (!html) throw new Error('Description generation failed');
      const patchRes = await fetch(`${API}/api/ebay/listing/${groupEbayId}/revise-description`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: html }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error || 'Failed');
      setReviseDescStatus('ok');
      setTimeout(() => setReviseDescStatus(''), 6000);
    } catch (e) {
      setReviseDescStatus('fail');
      setReviseDescError(e.message.slice(0, 200));
    } finally {
      setRevisingDesc(false);
    }
  }


  const countdowns = [
    useCountdown(variants[0]?.nextCheck),
    useCountdown(variants[1]?.nextCheck),
    useCountdown(variants[2]?.nextCheck),
    useCountdown(variants[3]?.nextCheck),
    useCountdown(variants[4]?.nextCheck),
    useCountdown(variants[5]?.nextCheck),
    useCountdown(variants[6]?.nextCheck),
    useCountdown(variants[7]?.nextCheck),
    useCountdown(variants[8]?.nextCheck),
    useCountdown(variants[9]?.nextCheck),
  ];

  const active = variants[activeIdx];

  function confirmDeleteAll() {
    variants.forEach(v => onDelete(v._id));
  }

  const specEntries = active.specs
    ? Object.entries(active.specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];

  const allUnavailable = variants.every(v => v.status === 'unavailable');
  const allOOS = variants.every(v => v.status === 'out_of_stock');
  const someIssue = variants.some(v => v.status && v.status !== 'active');
  const groupStatus = allUnavailable ? 'unavailable' : allOOS ? 'out_of_stock' : someIssue ? 'partial' : 'active';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 transition-shadow hover:shadow-sm flex flex-col p-4 ${detailMode ? 'gap-5 shadow-sm' : 'gap-3'}`}>

      {/* ── Group header ── */}
      <div className={`flex items-start gap-3 min-w-0 ${detailMode ? 'gap-5' : ''}`}>
        {active.image
          ? <img src={active.image} alt={active.title} className={`object-contain rounded-xl bg-gray-50 flex-shrink-0 ${detailMode ? 'w-32 h-32' : 'w-12 h-12'}`} />
          : <div className={`rounded-xl bg-gray-100 flex-shrink-0 ${detailMode ? 'w-32 h-32' : 'w-12 h-12'}`} />
        }
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-gray-800 ${detailMode ? 'text-base leading-snug line-clamp-3 lg:line-clamp-none' : 'text-sm truncate'}`} title={active.title}>{active.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {variants.some(v => v.isPrime) && <AmazonPrimeBadge />}
            {detailMode && (() => {
              const totalProfit = variants.reduce((sum, v) => {
                const cp = calcEbayPrice(v.current);
                return sum + (cp - v.current - calcEbayFee(cp));
              }, 0);
              const avgMargin = (totalProfit / variants.reduce((sum, v) => sum + calcEbayPrice(v.current), 0) * 100).toFixed(1);
              return (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {avgMargin}% margin
                </span>
              );
            })()}
          </div>
        </div>
        {confirmingDelete ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] text-gray-500 whitespace-nowrap">{variants.length === 1 ? 'Stop tracking?' : `Remove all ${variants.length} variants?`}</span>
            <button
              onClick={confirmDeleteAll}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
            >Yes</button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >No</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} title="Stop tracking all variants"
            className="text-gray-300 hover:text-red-500 transition-colors text-sm flex-shrink-0">✕</button>
        )}
      </div>

      {/* ── Product status banner ── */}
      {groupStatus === 'unavailable' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>🔴</span>
          <span className="font-medium">Product unavailable</span>
          <span className="text-red-400 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'out_of_stock' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
          <span>🟡</span>
          <span className="font-medium">Out of stock on Amazon</span>
          <span className="text-amber-500 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'partial' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
          <span>⚠️</span>
          <span className="font-medium">Some variants unavailable</span>
        </div>
      )}

      {/* ── eBay sync failure warning ── */}
      {anySyncFailed && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
          <span>⚠️ eBay price sync failed</span>
          <a
            href={`${API}/api/ebay/auth/login`}
            className="font-semibold underline whitespace-nowrap hover:text-red-800"
          >
            Reconnect eBay →
          </a>
        </div>
      )}

      {/* ── Variant swatches ── */}
      <div className={`grid gap-2 ${detailMode ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1'}`}>
        {variants.map((v, i) => {
          const label     = v.variant || `Variant ${i + 1}`;
          const calcPrice = calcEbayPrice(v.current);
          const ebayFee   = calcEbayFee(calcPrice);
          const profit    = +(calcPrice - v.current - ebayFee).toFixed(2);
          const marginPct = ((profit / calcPrice) * 100).toFixed(1);
          const livePrice = getLivePrice(v.variant || label);
          const synced    = livePrice != null && Math.abs(livePrice - calcPrice) < 0.02;
          const isRefreshing = refreshingIds.has(v._id);
          const result = refreshResults[v._id];
          const ebayPush = ebayPushResults[v._id];
          const isActive = i === activeIdx;

          // ── DETAIL MODE: full card with labeled price rows ──────────
          if (detailMode) return (
            <div
              key={v._id}
              onClick={() => toggleExpand(i)}
              className={`relative flex flex-col rounded-xl border-2 transition-colors cursor-pointer overflow-hidden ${
                isActive ? 'border-[#e53238] shadow-sm' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Image */}
              <div className={`flex items-center justify-center p-2 ${isActive ? 'bg-[#fff5f5]' : 'bg-gray-50'}`}>
                {v.image
                  ? <img src={v.image} alt={label} className="w-16 h-16 object-contain" />
                  : <div className="w-16 h-16 bg-gray-100 rounded-lg" />
                }
              </div>

              {/* Label */}
              <div className={`px-2 py-1 text-center border-b ${isActive ? 'bg-[#fff5f5] border-[#fcc]' : 'bg-white border-gray-100'}`}>
                <span className={`text-xs font-bold ${isActive ? 'text-[#e53238]' : 'text-gray-800'}`}>{label}</span>
                {v.status === 'out_of_stock' && <span className="ml-1 text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">OOS</span>}
                {(v.status === 'unavailable' || v.status === 'error') && <span className="ml-1 text-[9px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1">N/A</span>}
              </div>

              {/* Price rows */}
              <div className="px-2.5 py-2 flex flex-col gap-1 bg-white">
                {/* Amazon */}
                <div className="flex items-center justify-end lg:justify-between gap-1">
                  <span className="hidden lg:inline text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">Amazon</span>
                  <span className="text-sm font-bold text-gray-900">{v.currency}{v.current.toFixed(2)}</span>
                </div>

                {/* Calculated eBay */}
                <div className="flex items-center justify-end lg:justify-between gap-1">
                  <span className="hidden lg:inline text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">Cal</span>
                  <span className="text-sm font-semibold text-blue-700">{v.currency}{calcPrice.toFixed(2)}</span>
                </div>

                {/* Competitor market price */}
                {competitorData && (() => {
                  const diff = ((calcPrice - competitorData.lowest) / competitorData.lowest) * 100;
                  const color = diff <= 0 ? 'text-green-600' : diff <= 20 ? 'text-amber-600' : 'text-red-500';
                  const bg    = diff <= 0 ? 'bg-green-50' : diff <= 20 ? 'bg-amber-50' : 'bg-red-50';
                  return (
                    <div className="flex items-center justify-end lg:justify-between gap-1">
                      <span className={`hidden lg:inline text-[9px] font-bold px-1.5 py-0.5 rounded leading-none flex-shrink-0 ${color} ${bg}`}>Mkt</span>
                      <span className={`text-[11px] font-semibold ${color}`} title={`${competitorData.count} active listings · avg $${competitorData.avg}`}>
                        ${competitorData.lowest.toFixed(2)}
                        <span className="text-[9px] ml-0.5 opacity-70">{diff > 0 ? `+${diff.toFixed(0)}%` : `✓`}</span>
                      </span>
                    </div>
                  );
                })()}

                {/* Live eBay price */}
                {isRefreshing ? (
                  <div className="flex items-center justify-end lg:justify-between gap-1">
                    <span className="hidden lg:inline text-[9px] font-bold text-[#e53238] bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                    <span className="text-xs text-yellow-500">…</span>
                  </div>
                ) : livePrice != null ? (
                  <div className="flex items-center justify-end lg:justify-between gap-1">
                    <span className="hidden lg:inline text-[9px] font-bold text-[#e53238] bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                    <span className={`text-sm font-bold ${synced ? 'text-green-600' : 'text-red-500'}`}>
                      <span className="text-[9px] mr-0.5">{synced ? '✓' : '✗'}</span>{v.currency}{livePrice.toFixed(2)}
                    </span>
                  </div>
                ) : null}

                {/* Profit row */}
                <div className={`flex items-center justify-end lg:justify-between px-1 py-1.5 rounded-lg mt-1 ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`hidden lg:inline text-[9px] font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-400'}`}>{marginPct}%</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-black ${profit >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                      {profit >= 0 ? '+' : ''}{v.currency}{profit.toFixed(2)}
                    </span>
                    <span className={`lg:hidden text-[9px] ${profit >= 0 ? 'text-green-500' : 'text-red-400'}`}>{marginPct}%</span>
                  </div>
                </div>

                {/* Countdown + refresh */}
                <div className="flex flex-col gap-1.5 mt-0.5 pt-1.5 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    {v.nextCheck
                      ? <span className="text-[10px] text-gray-400 font-mono">⏱ {countdowns[i] || '…'}</span>
                      : <span />
                    }
                    {autoSyncErrors[v._id] && (
                      <span className="text-[9px] text-orange-500">⚠</span>
                    )}
                    {ebayPush === 'fail' && (
                      <a href={`${API}/api/ebay/auth/login`} onClick={e => e.stopPropagation()}
                        className="text-[9px] text-yellow-700 underline">Reconnect</a>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                    disabled={isRefreshing}
                    className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                      isRefreshing ? 'text-blue-600 bg-blue-50 border border-blue-200 cursor-not-allowed'
                      : result === 'ok' && ebayPush === 'ok' ? 'text-green-600 bg-green-50 border border-green-200 hover:bg-green-100'
                      : result === 'ok' && ebayPush === 'fail' ? 'text-yellow-700 bg-yellow-50 border border-yellow-300'
                      : result === 'fail' ? 'text-red-500 bg-red-50 border border-red-200'
                      : 'text-gray-400 bg-gray-100 border border-gray-200 hover:text-gray-600'
                    }`}
                  >
                    <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
                      {result === 'ok' && ebayPush === 'ok' ? '✓' : result === 'ok' && ebayPush === 'fail' ? '⚠' : result === 'fail' ? '✗' : '🔄'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );

          // ── COMPACT MODE: original tiny grid tile ──────────────────
          return (
            <div
              key={v._id}
              onClick={() => toggleExpand(i)}
              title={label}
              className={`relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg border transition-colors cursor-pointer ${
                isActive ? 'border-[#e53238] bg-[#fff5f5]' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {livePrice != null && (
                <span className={`absolute top-0.5 right-0.5 text-[8px] font-bold leading-none ${synced ? 'text-green-500' : 'text-red-500'}`}>
                  {synced ? '✓' : '✗'}
                </span>
              )}
              {v.image && <img src={v.image} alt={label} className="w-5 h-5 object-contain rounded flex-shrink-0" />}
              <span className={`font-medium truncate max-w-[60px] text-[10px] text-center ${isActive ? 'text-[#e53238]' : 'text-gray-700'}`}>{label}</span>
              {allExpanded && (
                <>
                  {v.status === 'out_of_stock' && <span className="text-[8px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-0.5 leading-tight">OOS</span>}
                  {(v.status === 'unavailable' || v.status === 'error') && <span className="text-[8px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-0.5 leading-tight">N/A</span>}
                  <span className="text-[9px] text-gray-400 font-mono">{v.currency}{v.current.toFixed(2)}</span>
                  <span className={`text-[9px] font-mono font-semibold ${isActive ? 'text-[#e53238]' : 'text-gray-600'}`}>{v.currency}{calcPrice.toFixed(2)}</span>
                  {isRefreshing ? <span className="text-[9px] font-mono text-yellow-500">…</span>
                    : livePrice != null ? <span className={`text-[9px] font-mono ${synced ? 'text-green-600' : 'text-red-500'}`}>{v.currency}{livePrice.toFixed(2)}</span>
                    : null}
                  {autoSyncErrors[v._id] && <span className="text-[8px] text-red-600 bg-red-50 border border-red-200 rounded px-0.5 leading-tight">⚠ err</span>}
                  {v.nextCheck && <span className="text-[9px] text-gray-400 font-mono">⏱{countdowns[i] || '…'}</span>}
                  {ebayPush === 'fail' && (
                    <a href={`${API}/api/ebay/auth/login`} onClick={e => e.stopPropagation()} className="text-[9px] text-yellow-700 underline whitespace-nowrap">Reconnect →</a>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                    disabled={isRefreshing}
                    className={`mt-0.5 self-stretch flex items-center justify-center rounded text-[10px] py-0.5 transition-all ${
                      isRefreshing ? 'bg-blue-100 text-blue-600 border border-blue-300 cursor-not-allowed'
                      : result === 'ok' && ebayPush === 'ok' ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                      : result === 'ok' && ebayPush === 'fail' ? 'bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100'
                      : result === 'fail' ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200 hover:text-gray-600'
                    }`}
                  >
                    <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
                      {result === 'ok' && ebayPush === 'ok' ? '✓' : result === 'ok' && ebayPush === 'fail' ? '⚠' : result === 'fail' ? '✗' : '🔄'}
                    </span>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <a href={active.url?.startsWith('http') ? active.url : `https://${active.url}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
          Amazon ↗
        </a>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(active.upc || active.title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-[#e53238] border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
          eBay ↗
        </a>
        {editingEbay ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            {myListings.length > 0 && (
              <select
                autoFocus
                className="w-52 px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#e53238] bg-white"
                value={ebayInput}
                onChange={e => setEbayInput(e.target.value)}
                disabled={savingEbay}
              >
                <option value="">— pick a listing —</option>
                {myListings.map(l => (
                  <option key={l.listingId} value={l.listingId}>
                    {l.listingId} · {(l.title || '').slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="or paste ID / URL"
                value={ebayInput}
                onChange={e => setEbayInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEbayListing(); if (e.key === 'Escape') setEditingEbay(false); }}
                className="w-52 px-2 py-1 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#e53238]"
                disabled={savingEbay}
              />
              <button onClick={saveEbayListing} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#e53238] text-white text-xs hover:bg-red-700 disabled:opacity-40 transition-colors">✓</button>
              <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs hover:bg-gray-200 transition-colors">✕</button>
            </div>
          </div>
        ) : groupEbayId ? (
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5">
              <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[#e53238] text-white hover:bg-red-700 transition-colors whitespace-nowrap">
                My Listing ↗
              </a>
              <button onClick={() => openEbayEdit(groupEbayId)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-[13px] transition-colors" title="Edit eBay listing">✏️</button>
            </div>
            <button onClick={fixVariationPhotos} disabled={fixingPhotos}
              className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors whitespace-nowrap">
              {fixingPhotos ? '📸 Uploading…' : '🖼️ Fix Variation Photos'}
            </button>
            {fixPhotosStatus === 'ok' && <p className="text-[10px] text-green-600 text-center">Photos updated ✓</p>}
            {fixPhotosStatus === 'fail' && <p className="text-[10px] text-red-500 break-words">{fixPhotosError || 'Failed ⚠'}</p>}
            <button onClick={reviseDescription} disabled={revisingDesc}
              className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full border border-violet-300 text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors whitespace-nowrap">
              {revisingDesc ? '📝 Updating…' : '📝 Update Description'}
            </button>
            {reviseDescStatus === 'ok' && <p className="text-[10px] text-green-600 text-center">Description updated ✓</p>}
            {reviseDescStatus === 'fail' && <p className="text-[10px] text-red-500 break-words">{reviseDescError || 'Failed ⚠'}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {(() => { const hasPrime = variants.some(v => v.isPrime); return (
            <button onClick={autoListOnEbay} disabled={autoListing || !hasPrime}
              title={!hasPrime ? 'Prime required to list on eBay' : undefined}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#e53238] text-white hover:bg-[#c0272d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
              {autoListing
                ? (autoListStep === 'title'       ? '✍️ Title…'
                  : autoListStep === 'images'      ? '📸 Images…'
                  : autoListStep === 'description' ? '📝 Description…'
                  : autoListStep === 'listing'     ? '📤 Listing…'
                  : autoListStep === 'verifying'   ? '✅ Verifying prices…'
                  : '💾 Saving…')
                : !hasPrime ? '🚫 No Prime — Cannot List' : '🚀 Auto-List on eBay'}
            </button>
            ); })()}
            <button onClick={() => openEbayEdit('')}
              className="text-[10px] text-gray-400 text-center hover:text-[#e53238] transition-colors">
              + link existing listing
            </button>
            {autoListError && (
              <p className="text-[10px] text-red-500 leading-tight break-words max-w-[200px]">{autoListError}</p>
            )}
          </div>
        )}
        {linkStatus === 'pushing' && (
          <span className="text-xs text-blue-500 whitespace-nowrap">Pushing prices…</span>
        )}
        {linkStatus === 'ok' && (
          <span className="text-xs text-green-600 whitespace-nowrap">Prices updated ✓</span>
        )}
        {linkStatus === 'fail' && (
          <span className="text-xs text-red-500 whitespace-nowrap">Price push failed ⚠</span>
        )}
        <button onClick={() => setShowSpecs(s => !s)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap px-2 py-1 rounded-full hover:bg-gray-100">
          <span className="text-[10px]">{showSpecs ? '▲' : '▼'}</span> specs
        </button>
      </div>


      {/* ── Specs panel ── */}
      {showSpecs && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Specs — {active.variant || `Variant ${activeIdx + 1}`}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            {active.upc && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">UPC</span>
                <span className="text-xs text-gray-700 font-mono">{active.upc}</span>
              </div>
            )}
            {specEntries.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{fmtKey(k)}</span>
                <span className="text-xs text-gray-700 break-words">{fmtVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
