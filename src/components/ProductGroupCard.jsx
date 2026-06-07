import { useState, useEffect, useRef } from 'react';
import { calcEbayPrice, calcEbayFee, trueCost } from '../utils/pricing';

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

function Countdown({ target }) {
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
  return remaining || '…';
}

// Use 'Style' for compound labels (contain / + or start with digit) so eBay doesn't
// reject them as invalid Color values. Check complexity BEFORE checking for color words.
function detectVariantDimension(variants) {
  const labels = variants.map(v => v.variant || '');
  if (labels.some(l => /\d+["'.×xX]/.test(l))) return 'Size';
  if (labels.some(l => /[\/+]/.test(l) || /^\d/.test(l))) return 'Style';
  if (labels.some(l => /\b(red|blue|green|black|white|gray|grey|pink|purple|yellow|orange|brown|beige|ivory|cream|navy|teal|turquoise|coral|silver|gold|rose|lavender|mint|charcoal|natural|carbonized|walnut|bamboo|oak|mahogany|cherry|maple|ebony)\b/i.test(l))) return 'Color';
  return 'Style';
}

const SKIP_SPEC_KEYS = new Set(['asin', 'upc']);
function fmtKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val != null).map(([k, val]) => `${fmtKey(k)}: ${val}`).join(' · ');
  return String(v);
}

const AUTO_LIST_STEP_LABELS = {
  images: '📸 Uploading images…',
  title: '✍️ Writing title…',
  description: '📝 Writing description…',
  listing: '📤 Creating listing…',
  photos: '🖼️ Pushing photos…',
  done: '✅ Listed on eBay!',
  error: '⚠️ Listing failed',
};

export default function ProductGroupCard({ variants, onCheck, onDelete, onUpdate, ebayFailedIds, detailMode = false, onPriceMismatch, saleMode = false, autoListStatus = {} }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [allExpanded, setAllExpanded] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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

  const groupEbayId = variants.find(v => v.ebayListingId)?.ebayListingId || null;
  const anySyncFailed = ebayFailedIds && variants.some(v => ebayFailedIds.has(String(v._id)));
  const [ebayLivePrices, setEbayLivePrices] = useState(null);
  const [autoSyncErrors, setAutoSyncErrors] = useState({}); // variantId -> error string
  const autoSyncAt = useRef(0); // timestamp of last auto-sync attempt

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
  }, [groupEbayId]);

  // Auto-fix mismatched eBay prices whenever live prices are refreshed.
  // Throttled to once per 5 min to avoid eBay rate limits and infinite loops.
  useEffect(() => {
    if (!ebayLivePrices || !groupEbayId) return;

    const mismatches = variants.filter(v => {
      const calcPrice = calcEbayPrice(v.current, saleMode);
      const livePrice = getLivePrice(v.variant || '');
      return livePrice != null && Math.abs(livePrice - calcPrice) >= 0.02;
    });
    // Always update sidebar mismatch indicator, regardless of throttle
    if (!mismatches.length) { onPriceMismatch?.(groupEbayId, false); return; }
    onPriceMismatch?.(groupEbayId, true);

    // Throttle: don't re-push if we already tried within the last 5 minutes
    const now = Date.now();
    if (now - autoSyncAt.current < 5 * 60 * 1000) return;
    autoSyncAt.current = now;

    const ids = new Set(mismatches.map(v => v._id));
    setRefreshingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setAutoSyncErrors({});

    Promise.all(mismatches.map(async v => {
      const calcPrice = calcEbayPrice(v.current, saleMode);
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
  }, [ebayLivePrices]);

  async function handleCheckOne(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const updated = await onCheck(id);
      if (updated?.current != null && groupEbayId) {
        const newCalcPrice = calcEbayPrice(updated.current, saleMode);
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
          const calcPrice = calcEbayPrice(v.current, saleMode);
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
      const variantCloudinaryFolders = [];
      for (const v of variants) {
        const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
        if (!varImgs.length) { variantCloudinaryImages.push([]); variantCloudinaryFolders.push(null); continue; }
        const varSlug = slug + '-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '');
        const varFolder = `ebay-listings/${varSlug}`;
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          const uploadData = await uploadRes.json();
          variantCloudinaryImages.push(uploadData.cloudinaryUrls || []);
          variantCloudinaryFolders.push(varFolder);
        } catch { variantCloudinaryImages.push([]); variantCloudinaryFolders.push(null); }
      }
      // Combine all for the main listing gallery (deduplicated, max 12)
      const cloudinaryUrls = [...new Set(variantCloudinaryImages.flat())].slice(0, 12);

      // Step 3: Create multi-variation eBay listing
      setAutoListStep('listing');
      const variantDimension = detectVariantDimension(variants);

      const variantPayload = variants.map((v, i) => ({
        label: v.variant || `Variant ${i + 1}`,
        price: (calcEbayPrice(v.current, saleMode)).toFixed(2),
        quantity: 1,
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
          price: (calcEbayPrice(active.current, saleMode)).toFixed(2),
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

      // Step 5: Push variation photos explicitly after listing creation.
      // eBay sometimes doesn't apply VariationSpecificPictureSet on the first AddFixedPriceItem
      // call, and the backend's variation-photos endpoint auto-reads the correct dimension name
      // from eBay so labels always match exactly.
      setAutoListStep('photos');
      try {
        await new Promise(r => setTimeout(r, 2000)); // brief wait for eBay to index the listing
        await fetch(`${API}/api/ebay/listing/variation-photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: listData.listingId,
            variantDimension,
            variants: variantPayload,
          }),
        });
      } catch { /* non-critical — listing exists, photos can be fixed with Fix Variation Photos */ }

      // Step 6: Verify & fix any price mismatches immediately after listing
      setAutoListStep('verifying');
      try {
        await new Promise(r => setTimeout(r, 2000)); // wait for eBay to process
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
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const saveRes = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ebayListingId: listData.listingId, cloudinaryFolder: variantCloudinaryFolders[i] || null }),
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
        const varSlug = slug + '-fix-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '');
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          variantCloudinaryImages.push((await uploadRes.json()).cloudinaryUrls || []);
        } catch { variantCloudinaryImages.push([]); }
      }

      const variantDimension = detectVariantDimension(variants);

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


  const active = variants[activeIdx];

  async function confirmDeleteAll() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await Promise.all(variants.map(v => onDelete(v._id)));
    } catch (e) {
      setDeleteError(e.response?.data?.error || e.message || 'Delete failed');
      setDeleting(false);
    }
  }

  const specEntries = active.specs
    ? Object.entries(active.specs).filter(([k, v]) => !SKIP_SPEC_KEYS.has(k) && fmtVal(v))
    : [];

  const allUnavailable = variants.every(v => v.status === 'unavailable');
  const allOOS = variants.every(v => v.status === 'out_of_stock');
  const someIssue = variants.some(v => v.status && v.status !== 'active');
  const groupStatus = allUnavailable ? 'unavailable' : allOOS ? 'out_of_stock' : someIssue ? 'partial' : 'active';

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/70 transition-shadow flex flex-col p-4 md:p-5 ${detailMode ? 'gap-5 shadow-card' : 'gap-3 hover:shadow-soft'}`}>

      {/* ── Group header ── */}
      <div className={`flex items-start gap-3 min-w-0 ${detailMode ? 'gap-4 md:gap-5' : ''}`}>
        {active.image
          ? <img src={active.image} alt={active.title} className={`object-contain rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 ${detailMode ? 'w-24 h-24 md:w-32 md:h-32' : 'w-12 h-12'}`} />
          : <div className={`rounded-2xl bg-slate-100 flex-shrink-0 ${detailMode ? 'w-24 h-24 md:w-32 md:h-32' : 'w-12 h-12'}`} />
        }
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-slate-800 ${detailMode ? 'text-[15px] md:text-base leading-snug line-clamp-3 lg:line-clamp-none' : 'text-sm truncate'}`} title={active.title}>{active.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {variants.some(v => v.isPrime) && <AmazonPrimeBadge />}
            {detailMode && (() => {
              const totalProfit = variants.reduce((sum, v) => {
                const cp = calcEbayPrice(v.current, saleMode);
                return sum + (cp - trueCost(v.current) - calcEbayFee(cp));
              }, 0);
              const avgMargin = (totalProfit / variants.reduce((sum, v) => sum + calcEbayPrice(v.current, saleMode), 0) * 100).toFixed(1);
              return (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${totalProfit >= 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-600 ring-red-200'}`}>
                  {totalProfit >= 0 ? '▲' : '▼'} {avgMargin}% margin
                </span>
              );
            })()}
            {detailMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                {variants.length} variant{variants.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {deleting ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <svg className="animate-spin w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <span className="text-[11px] text-red-400">Deleting…</span>
          </div>
        ) : deleteError ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] text-red-500 max-w-[140px] truncate" title={deleteError}>⚠ {deleteError}</span>
            <button onClick={() => { setDeleteError(null); setConfirmingDelete(false); }}
              className="text-[11px] text-slate-400 hover:text-slate-600">✕</button>
          </div>
        ) : confirmingDelete ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] text-slate-500 whitespace-nowrap hidden sm:inline">{variants.length === 1 ? 'Stop tracking?' : `Remove all ${variants.length} variants?`}</span>
            <button
              onClick={confirmDeleteAll}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
            >Yes</button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >No</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} title="Stop tracking all variants"
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors text-sm flex-shrink-0">✕</button>
        )}
      </div>

      {/* ── Product status banner ── */}
      {groupStatus === 'unavailable' && (
        <div className="flex items-center gap-2 bg-red-50 ring-1 ring-inset ring-red-200 rounded-xl px-3.5 py-2 text-xs text-red-600">
          <span>🔴</span>
          <span className="font-semibold">Product unavailable</span>
          <span className="text-red-400 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'out_of_stock' && (
        <div className="flex items-center gap-2 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-xl px-3.5 py-2 text-xs text-amber-700">
          <span>🟡</span>
          <span className="font-semibold">Out of stock on Amazon</span>
          <span className="text-amber-500 ml-auto">Retrying every 24h</span>
        </div>
      )}
      {groupStatus === 'partial' && (
        <div className="flex items-center gap-2 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-xl px-3.5 py-2 text-xs text-amber-700">
          <span>⚠️</span>
          <span className="font-semibold">Some variants unavailable</span>
        </div>
      )}

      {/* ── eBay sync failure warning ── */}
      {anySyncFailed && (
        <div className="flex items-center justify-between gap-2 bg-red-50 ring-1 ring-inset ring-red-200 rounded-xl px-3.5 py-2 text-xs text-red-600">
          <span className="font-semibold">⚠️ eBay price sync failed</span>
          <a
            href={`${API}/api/ebay/auth/login`}
            className="font-bold underline whitespace-nowrap hover:text-red-800"
          >
            Reconnect eBay →
          </a>
        </div>
      )}

      {/* ── Variant swatches ── */}
      <div className={`grid gap-2 ${detailMode ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1'}`}>
        {variants.map((v, i) => {
          const label     = v.variant || `Variant ${i + 1}`;
          const calcPrice = calcEbayPrice(v.current, saleMode);
          const ebayFee   = calcEbayFee(calcPrice);
          const profit    = +(calcPrice - trueCost(v.current) - ebayFee).toFixed(2);
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
              className={`relative flex flex-col rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
                isActive ? 'border-ebay shadow-card' : 'border-slate-200 hover:border-slate-300 hover:shadow-soft'
              }`}
            >
              {/* Image */}
              <div className={`flex items-center justify-center p-2.5 ${isActive ? 'bg-red-50/60' : 'bg-slate-50'}`}>
                {v.image
                  ? <img src={v.image} alt={label} className="w-16 h-16 object-contain" />
                  : <div className="w-16 h-16 bg-slate-100 rounded-xl" />
                }
              </div>

              {/* Label */}
              <div className={`px-2 py-1.5 text-center border-b ${isActive ? 'bg-red-50/60 border-red-100' : 'bg-white border-slate-100'}`}>
                <span className={`text-xs font-bold ${isActive ? 'text-ebay' : 'text-slate-800'}`}>{label}</span>
                {v.status === 'out_of_stock' && <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded px-1">OOS</span>}
                {(v.status === 'unavailable' || v.status === 'error') && <span className="ml-1 text-[9px] font-bold text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-1">N/A</span>}
              </div>

              {/* Price rows */}
              <div className="px-2.5 py-2.5 flex flex-col gap-1 bg-white">
                {/* Amazon */}
                <div className="flex items-center justify-end lg:justify-between gap-1">
                  <span className="hidden lg:inline text-[9px] font-bold text-amazon-dark bg-orange-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">Amazon</span>
                  <span className="text-sm font-bold text-slate-900">{v.currency}{v.current != null ? v.current.toFixed(2) : '—'}</span>
                </div>


                {/* Live eBay price */}
                {isRefreshing ? (
                  <div className="flex items-center justify-end lg:justify-between gap-1">
                    <span className="hidden lg:inline text-[9px] font-bold text-ebay bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                    <span className="text-xs text-amber-500">…</span>
                  </div>
                ) : livePrice != null ? (
                  <div className="flex items-center justify-end lg:justify-between gap-1">
                    <span className="hidden lg:inline text-[9px] font-bold text-ebay bg-red-50 px-1.5 py-0.5 rounded leading-none flex-shrink-0">eBay</span>
                    <span className={`text-sm font-bold ${synced ? 'text-emerald-600' : 'text-red-500'}`}>
                      {v.currency}{livePrice.toFixed(2)}
                    </span>
                  </div>
                ) : null}

                {/* Profit row */}
                <div className={`flex items-center justify-end lg:justify-between px-1.5 py-1.5 rounded-lg mt-1 ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <span className={`hidden lg:inline text-[9px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>{marginPct}%</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-black ${profit >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                      {profit >= 0 ? '+' : ''}{v.currency}{profit.toFixed(2)}
                    </span>
                    <span className={`lg:hidden text-[9px] font-semibold ${profit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{marginPct}%</span>
                  </div>
                </div>

                {/* Countdown + refresh */}
                <div className="flex flex-col gap-1.5 mt-0.5 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    {v.nextCheck
                      ? <span className="text-[10px] text-slate-400 font-mono">⏱ <Countdown target={v.nextCheck} /></span>
                      : <span />
                    }
                    {autoSyncErrors[v._id] && (
                      <span className="text-[9px] text-orange-500">⚠</span>
                    )}
                    {ebayPush === 'fail' && (
                      <a href={`${API}/api/ebay/auth/login`} onClick={e => e.stopPropagation()}
                        className="text-[9px] text-amber-700 underline font-medium">Reconnect</a>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                    disabled={isRefreshing}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                      isRefreshing ? 'text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 cursor-not-allowed'
                      : result === 'ok' && ebayPush === 'ok' ? 'text-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
                      : result === 'ok' && ebayPush === 'fail' ? 'text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-300'
                      : result === 'fail' ? 'text-red-500 bg-red-50 ring-1 ring-inset ring-red-200'
                      : 'text-slate-400 bg-slate-100 ring-1 ring-inset ring-slate-200 hover:text-slate-600 hover:bg-slate-50'
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
                isActive ? 'border-ebay bg-red-50/60' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              {livePrice != null && (
                <span className={`absolute top-0.5 right-0.5 text-[8px] font-bold leading-none ${synced ? 'text-emerald-500' : 'text-red-500'}`}>
                  {synced ? '✓' : '✗'}
                </span>
              )}
              {v.image && <img src={v.image} alt={label} className="w-5 h-5 object-contain rounded flex-shrink-0" />}
              <span className={`font-medium truncate max-w-[60px] text-[10px] text-center ${isActive ? 'text-ebay' : 'text-slate-700'}`}>{label}</span>
              {allExpanded && (
                <>
                  {v.status === 'out_of_stock' && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded px-0.5 leading-tight">OOS</span>}
                  {(v.status === 'unavailable' || v.status === 'error') && <span className="text-[8px] font-bold text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-0.5 leading-tight">N/A</span>}
                  <span className="text-[9px] text-slate-400 font-mono">{v.currency}{v.current.toFixed(2)}</span>
                  {isRefreshing ? <span className="text-[9px] font-mono text-amber-500">…</span>
                    : livePrice != null ? <span className={`text-[9px] font-mono ${synced ? 'text-emerald-600' : 'text-red-500'}`}>{v.currency}{livePrice.toFixed(2)}</span>
                    : null}
                  {autoSyncErrors[v._id] && <span className="text-[8px] text-red-600 bg-red-50 ring-1 ring-inset ring-red-200 rounded px-0.5 leading-tight">⚠ err</span>}
                  {v.nextCheck && <span className="text-[9px] text-slate-400 font-mono">⏱<Countdown target={v.nextCheck} /></span>}
                  {ebayPush === 'fail' && (
                    <a href={`${API}/api/ebay/auth/login`} onClick={e => e.stopPropagation()} className="text-[9px] text-amber-700 underline whitespace-nowrap font-medium">Reconnect →</a>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleCheckOne(v._id); }}
                    disabled={isRefreshing}
                    className={`mt-0.5 self-stretch flex items-center justify-center rounded text-[10px] py-0.5 transition-all ring-1 ring-inset ${
                      isRefreshing ? 'bg-blue-100 text-blue-600 ring-blue-300 cursor-not-allowed'
                      : result === 'ok' && ebayPush === 'ok' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200 hover:bg-emerald-100'
                      : result === 'ok' && ebayPush === 'fail' ? 'bg-amber-50 text-amber-700 ring-amber-300 hover:bg-amber-100'
                      : result === 'fail' ? 'bg-red-50 text-red-500 ring-red-200 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-400 ring-slate-200 hover:bg-slate-200 hover:text-slate-600'
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
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
          Amazon ↗
        </a>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(active.upc || active.title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-ebay ring-1 ring-inset ring-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
          eBay ↗
        </a>
        {editingEbay ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            {myListings.length > 0 && (
              <select
                autoFocus
                className="w-52 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-ebay focus:ring-2 focus:ring-ebay/15 bg-white transition-all"
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
                className="w-52 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-ebay focus:ring-2 focus:ring-ebay/15 transition-all"
                disabled={savingEbay}
              />
              <button onClick={saveEbayListing} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-ebay text-white text-xs hover:bg-ebay-dark disabled:opacity-40 transition-colors">✓</button>
              <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-colors">✕</button>
            </div>
          </div>
        ) : groupEbayId ? (
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5">
              <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-ebay text-white hover:bg-ebay-dark transition-colors whitespace-nowrap">
                My Listing ↗
              </a>
              <button onClick={() => openEbayEdit(groupEbayId)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[13px] transition-colors" title="Edit eBay listing">✏️</button>
            </div>
            <button onClick={fixVariationPhotos} disabled={fixingPhotos}
              className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors whitespace-nowrap">
              {fixingPhotos ? '📸 Uploading…' : '🖼️ Fix Variation Photos'}
            </button>
            {fixPhotosStatus === 'ok' && <p className="text-[10px] text-emerald-600 font-semibold text-center">Photos updated ✓</p>}
            {fixPhotosStatus === 'fail' && <p className="text-[10px] text-red-500 break-words">{fixPhotosError || 'Failed ⚠'}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {(() => {
              // Find active auto-list status for any variant in this group
              const status = variants.map(v => autoListStatus[String(v._id)]).find(Boolean);
              if (status) {
                const isError = status.step === 'error';
                return (
                  <div className={`flex flex-col gap-0.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${isError ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
                    <span>{AUTO_LIST_STEP_LABELS[status.step] || '⏳ Listing…'}</span>
                    {isError && <span className="text-[10px] font-normal text-red-500 break-words">{status.error?.slice(0, 120)}</span>}
                  </div>
                );
              }
              const hasPrime = variants.some(v => v.isPrime);
              return (
                <>
                  {hasPrime
                    ? <span className="text-[10px] text-blue-500 px-1">🤖 Will auto-list when Prime confirmed</span>
                    : <span className="text-[10px] text-slate-400 px-1">🚫 No Prime — cannot list on eBay</span>
                  }
                  <button onClick={() => openEbayEdit('')}
                    className="text-[10px] text-slate-400 text-center hover:text-ebay transition-colors">
                    + link existing listing manually
                  </button>
                </>
              );
            })()}
          </div>
        )}
        {linkStatus === 'pushing' && (
          <span className="text-xs text-blue-500 whitespace-nowrap">Pushing prices…</span>
        )}
        {linkStatus === 'ok' && (
          <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">Prices updated ✓</span>
        )}
        {linkStatus === 'fail' && (
          <span className="text-xs text-red-500 whitespace-nowrap">Price push failed ⚠</span>
        )}
        <button onClick={() => setShowSpecs(s => !s)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap px-2.5 py-1 rounded-full hover:bg-slate-100">
          <span className="text-[10px]">{showSpecs ? '▲' : '▼'}</span> specs
        </button>
      </div>


      {/* ── Specs panel ── */}
      {showSpecs && (
        <div className="border-t border-slate-100 pt-3 animate-fade-in">
          <p className="text-xs font-bold text-slate-500 mb-2.5">Specs — {active.variant || `Variant ${activeIdx + 1}`}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5">
            {active.upc && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">UPC</span>
                <span className="text-xs text-slate-700 font-mono">{active.upc}</span>
              </div>
            )}
            {specEntries.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{fmtKey(k)}</span>
                <span className="text-xs text-slate-700 break-words">{fmtVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
