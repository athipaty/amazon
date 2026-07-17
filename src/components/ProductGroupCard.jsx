import { useState, useEffect, useRef } from 'react';
import { calcEbayPrice, calcEbayFee, trueCost } from '../utils/pricing';
import { detectVariantDimension, AUTO_LIST_STEP_LABELS } from '../utils/productGroupHelpers';
import { useAutoListState, setAutoListState } from '../utils/autoListStore';
import AmazonPrimeBadge from './AmazonPrimeBadge';
import VariantSwatchGrid from './VariantSwatchGrid';
import EbayListingControls from './EbayListingControls';
import SpecsPanel from './SpecsPanel';
import FadeImg from './FadeImg';
import ConfirmDialog from './ConfirmDialog';
import CompetitorPriceCheck from './CompetitorPriceCheck';
import useCompetitorCheck from '../hooks/useCompetitorCheck';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ProductGroupCard({ variants, onCheck, onDeleteGroup, onUpdate, onVariantDeleted, ebayFailedIds, detailMode = false, onPriceMismatch }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [allExpanded, setAllExpanded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deletingVariantId, setDeletingVariantId] = useState(null);
  const [confirmingVariantId, setConfirmingVariantId] = useState(null);
  const [variantDeleteError, setVariantDeleteError] = useState(null);
  const [addingToEbayId, setAddingToEbayId] = useState(null);
  const [addToEbayErrors, setAddToEbayErrors] = useState({}); // variantId → error

  async function handleAddVariantToEbay(variantId) {
    if (!groupEbayId) return;
    const variant = variants.find(v => v._id === variantId);
    if (!variant) return;
    setAddingToEbayId(variantId);
    setAddToEbayErrors(prev => { const n = { ...prev }; delete n[variantId]; return n; });
    try {
      const price = calcEbayPrice(variant.current).toFixed(2);
      const r = await fetch(`${API}/api/ebay/listing/${groupEbayId}/add-variation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantLabel: variant.variant || '', price }),
      });
      const data = await r.json();
      if (!r.ok) { setAddToEbayErrors(prev => ({ ...prev, [variantId]: data.error || 'Failed to add to eBay' })); return; }
      const existingFolder = variants.find(v => v.cloudinaryFolder)?.cloudinaryFolder || null;
      const patchRes = await fetch(`${API}/api/tracker/${variantId}/ebay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebayListingId: groupEbayId, cloudinaryFolder: existingFolder, ebayPrice: Number(price) }),
      });
      if (patchRes.ok) { const updated = await patchRes.json(); onUpdate?.(updated); }
    } catch (e) {
      setAddToEbayErrors(prev => ({ ...prev, [variantId]: e.message || 'Network error' }));
    } finally {
      setAddingToEbayId(null);
    }
  }

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
  // Progress lives in an external store keyed by product/group id (not local useState) so
  // it survives this component unmounting when the user selects a different item and
  // remounting when they come back — see utils/autoListStore.js.
  const groupKey = variants[0]?.groupId ? `group-${variants[0].groupId}` : `single-${variants[0]?._id}`;
  const { autoListing, autoListStep, autoListError, autoListWarning, autoListSuccess } = useAutoListState(groupKey);
  const setAutoListing = (v) => setAutoListState(groupKey, { autoListing: v });
  const setAutoListStep = (v) => setAutoListState(groupKey, { autoListStep: v });
  const setAutoListError = (v) => setAutoListState(groupKey, { autoListError: v });
  const setAutoListWarning = (v) => setAutoListState(groupKey, { autoListWarning: v });
  const setAutoListSuccess = (v) => setAutoListState(groupKey, { autoListSuccess: v });
  const [priceConfirming, setPriceConfirming] = useState(false);
  const [customPrices, setCustomPrices] = useState({});
  const [fixingPhotos, setFixingPhotos] = useState(false);
  const [fixPhotosStatus, setFixPhotosStatus] = useState(''); // '' | 'ok' | 'fail'
  const [fixPhotosError, setFixPhotosError] = useState('');
  const [redoingDescription, setRedoingDescription] = useState(false);
  const [redoDescriptionStatus, setRedoDescriptionStatus] = useState(''); // '' | 'ok' | 'fail'

  const groupEbayId = variants.find(v => v.ebayListingId)?.ebayListingId || null;
  const anySyncFailed = ebayFailedIds && variants.some(v => ebayFailedIds.has(String(v._id)));
  const [autoSyncErrors, setAutoSyncErrors] = useState({}); // variantId -> error string
  const autoSyncAt = useRef(0); // timestamp of last auto-sync attempt

  // Read eBay price from DB (stored by scheduler on each successful price check).
  // No GetItem API calls needed — eliminates 4,000+ eBay API calls/day.
  // Mirrors bestVariantMatch on the backend: exact → shortest-superset → longest-subset.
  function getLivePrice(variantLabel) {
    if (!groupEbayId) return null;
    const label = (variantLabel || '').toLowerCase().trim();
    if (variants.length === 1) return variants[0].ebayPrice ?? null;
    const vl = v => (v.variant || '').toLowerCase().trim();
    // 1. Exact match
    const exact = variants.find(v => vl(v) === label);
    if (exact) return exact.ebayPrice ?? null;
    // 2. DB name contains label (e.g. "2pcs yellow" contains "yellow") — pick shortest
    const supersets = variants.filter(v => vl(v).includes(label));
    if (supersets.length) return supersets.reduce((a, b) => vl(a).length <= vl(b).length ? a : b).ebayPrice ?? null;
    // 3. Label contains DB name (e.g. "yellow+colorful" contains "yellow") — pick longest
    const subsets = variants.filter(v => vl(v).length > 2 && label.includes(vl(v)));
    if (subsets.length) return subsets.reduce((a, b) => vl(a).length >= vl(b).length ? a : b).ebayPrice ?? null;
    return null;
  }

  // Auto-fix mismatched eBay prices on mount and whenever DB prices update.
  // Throttled to once per 5 min.
  useEffect(() => {
    if (!groupEbayId) return;
    const mismatches = variants.filter(v => {
      const calcPrice = calcEbayPrice(v.current);
      const storedPrice = getLivePrice(v.variant || '');
      return storedPrice != null && Math.abs(storedPrice - calcPrice) >= 0.02;
    });
    if (!mismatches.length) { onPriceMismatch?.(groupEbayId, false); return; }
    onPriceMismatch?.(groupEbayId, true);

    const now = Date.now();
    if (now - autoSyncAt.current < 5 * 60 * 1000) return;
    autoSyncAt.current = now;

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
      onPriceMismatch?.(groupEbayId, false);
    });
  }, [variants.map(v => `${v._id}:${v.ebayPrice}`).join(',')]);

  async function handleCheckOne(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    setRefreshResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEbayPushResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const updated = await onCheck(id);
      // Scheduler handles eBay price sync and saves ebayPrice to DB — no separate push needed here
      if (updated) {
        onUpdate?.(updated);
        setEbayPushResults(prev => ({ ...prev, [id]: 'ok' }));
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
      const linkFailures = [];
      for (const v of variants) {
        const res = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ebayListingId: id || null }),
        });
        if (res.ok) {
          const updated = await res.json();
          onUpdate?.(updated);
        } else {
          linkFailures.push(v.variant || v.title || v._id);
        }
      }
      if (linkFailures.length) {
        setLinkStatus('fail');
        setTimeout(() => setLinkStatus(''), 5000);
        return;
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

  function ambiguousVariantLabels(variantList) {
    if (variantList.length < 2) return null;
    const labels = variantList.map(v => (v.variant || '').toLowerCase().trim()).filter(Boolean);
    // Check if `sub` appears as a standalone word-boundary token within `sup`.
    // Prevents "8" falsely matching inside "18" (different numbers, not substrings).
    const isWordSubstring = (sub, sup) => {
      const esc = sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![\\w])${esc}(?![\\w])`).test(sup);
    };
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (labels[i] === labels[j]) return { subset: labels[i], superset: labels[j] };
        if (isWordSubstring(labels[j], labels[i]) || isWordSubstring(labels[i], labels[j])) {
          return { subset: labels[i].length < labels[j].length ? labels[i] : labels[j], superset: labels[i].length >= labels[j].length ? labels[i] : labels[j] };
        }
      }
    }
    return null;
  }

  async function autoListOnEbay(pricesOverride = {}) {
    if (autoListing) return; // already running for this product/group — don't start a second concurrent listing
    setAutoListing(true);
    setAutoListError('');
    setAutoListWarning('');

    if (groupEbayId) {
      setAutoListError(`This group already has eBay listing ${groupEbayId}. Use the "+ Add to eBay" button on each new variant tile instead — that adds to the existing listing without creating a duplicate.`);
      setAutoListing(false);
      return;
    }

    if (variants.length > 1) {
      const clash = ambiguousVariantLabels(variants);
      if (clash) {
        // Warn but don't block — eBay lists these fine. Only our backend price-sync
        // could have issues matching "Grass Green" vs "Red and Grass Green".
        setAutoListWarning('variant-name-overlap');
      }
    }
    try {
      // Pre-flight: register every sibling's hero image before any of them get scraped
      // for real, so the cross-sibling contamination filter is fully primed even on a
      // brand-new group's very first listing attempt.
      if (variants.length > 1 && variants[0]?.groupId) {
        try {
          await fetch(`${API}/api/tracker/group/${variants[0].groupId}/preflight-images`, { method: 'POST' });
        } catch {}
      }

      // Pre-step: scrape fresh per-variant images from Amazon via ScraperAPI for every
      // variant — always, regardless of existing Cloudinary images. This guarantees each
      // colour gets its own 7-image gallery before the listing is created.
      setAutoListStep('preparing-images');
      const freshVariants = [...variants];
      for (let i = 0; i < freshVariants.length; i++) {
        const v = freshVariants[i];
        try {
          const res = await fetch(`${API}/api/tracker/${v._id}/refresh-images`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
          });
          if (res.ok) {
            const data = await res.json();
            if (data.images?.length) freshVariants[i] = { ...v, image: data.image || v.image, images: data.images, cloudinaryFolder: data.cloudinaryFolder || v.cloudinaryFolder };
          }
        } catch {}
      }

      setAutoListStep('title');
      const titleRes = await fetch(`${API}/api/ebay/seo-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, specs: active.specs }),
      });
      const titleData = await titleRes.json();
      const ebayTitle = titleData.title || active.title;

      setAutoListStep('images');

      // Folder slug uses EACH variant's own ASIN, not one shared "active" variant's —
      // otherwise every variant's B2 folder name is misleadingly prefixed with whichever
      // variant happened to be active, instead of reflecting which product it actually holds.
      const variantCloudinaryImages = [];
      const variantCloudinaryFolders = [];
      for (const v of freshVariants) {
        const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
        if (!varImgs.length) { variantCloudinaryImages.push([]); variantCloudinaryFolders.push(null); continue; }
        const vAsin = v.specs?.asin || v.url?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || String(v._id).slice(-8);
        const vSlugBase = vAsin.toLowerCase().replace(/[^a-z0-9]/g, '');
        const varSlug = vSlugBase + '-' + (v.variant || String(freshVariants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '');
        const varFolder = `ebay-listings/${varSlug}`;
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.cloudinaryUrls?.length) {
            variantCloudinaryImages.push(uploadData.cloudinaryUrls);
            variantCloudinaryFolders.push(varFolder);
          } else {
            variantCloudinaryImages.push([]);
            variantCloudinaryFolders.push(null);
          }
        } catch { variantCloudinaryImages.push([]); variantCloudinaryFolders.push(null); }
      }
      const cloudinaryUrls = [...new Set(variantCloudinaryImages.flat())].slice(0, 12);
      if (!cloudinaryUrls.length) throw new Error('No product images could be uploaded to storage. Please check the product has images and try again.');

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

      setAutoListStep('listing');
      const variantDimension = detectVariantDimension(freshVariants);
      const variantPayload = freshVariants.map((v, i) => ({
        label: v.variant || `Variant ${i + 1}`,
        price: (parseFloat(pricesOverride[v._id]) || calcEbayPrice(v.current)).toFixed(2),
        quantity: 1,
        images: variantCloudinaryImages[i] || [],
        image: variantCloudinaryImages[i]?.[0] || null,
        // productId + cloudinaryFolder let the backend link each variant's tracker record to the
        // listing server-side, inside this same request — see the "saving" step below and the
        // matching comment in routes/ebay.js for why that used to be a separate, fragile PATCH.
        productId: v._id,
        cloudinaryFolder: variantCloudinaryFolders[i] || null,
      }));

      const listRes = await fetch(`${API}/api/ebay/trading-create-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ebayTitle,
          price: (parseFloat(pricesOverride[active._id]) || calcEbayPrice(active.current)).toFixed(2),
          imageUrls: cloudinaryUrls,
          upc: active.upc,
          specs: active.specs || {},
          variants: variantPayload,
          variantDimension,
          ...(listingDescription ? { description: listingDescription } : {}),
        }),
      });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.message || listData.error || 'eBay listing failed');

      setAutoListStep('photos');
      if (variantPayload.length > 1 && listData.isMultiVariation !== false) {
        try {
          await new Promise(r => setTimeout(r, 2000));
          const vpRes = await fetch(`${API}/api/ebay/listing/variation-photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId: listData.listingId, variantDimension, variants: variantPayload }),
          });
          if (!vpRes.ok) setAutoListWarning('photos-failed');
        } catch { setAutoListWarning('photos-failed'); }
      } else if (listData.isMultiVariation === false && variantPayload.length > 1) {
        setAutoListWarning('single-item-fallback');
      }

      setAutoListStep('verifying');
      try {
        await new Promise(r => setTimeout(r, 2000));
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
      } catch { /* non-critical */ }

      setAutoListStep('saving');
      // The backend already linked every variant server-side inside trading-create-listing (see
      // the productId/cloudinaryFolder passed into variantPayload above) — this loop just fetches
      // the updated records for local UI state. listData.linkFailures names the (rare) ids where
      // the server-side link itself failed; those get real retries with backoff here as the last
      // line of defense, since at that point the eBay listing exists but nothing else will retry.
      const linkFailureIds = new Set(listData.linkFailures || []);
      const saveFailures = [];
      for (let i = 0; i < freshVariants.length; i++) {
        const v = freshVariants[i];
        const attempts = linkFailureIds.has(v._id) ? 3 : 1;
        let saved = false;
        for (let attempt = 0; attempt < attempts && !saved; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));
          try {
            const saveRes = await fetch(`${API}/api/tracker/${v._id}/ebay`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ebayListingId: listData.listingId, cloudinaryFolder: variantCloudinaryFolders[i] || null }),
            });
            if (saveRes.ok) {
              const updated = await saveRes.json();
              onUpdate?.(updated);
              saved = true;
            }
          } catch { /* retry */ }
        }
        if (!saved) saveFailures.push(v.variant || `Variant ${i + 1}`);
      }
      // The eBay listing (listData.listingId) already exists on eBay regardless of whether
      // every save below succeeded — so we still report success, but flag which variants
      // didn't get linked in our own DB so they don't end up silently stuck unlinked.
      if (saveFailures.length) {
        setAutoListWarning(`save-failed:${saveFailures.join(', ')}`);
      }
      setAutoListSuccess({ listingId: listData.listingId, title: ebayTitle });
      setTimeout(() => setAutoListSuccess(null), 10000);
    } catch (e) {
      setAutoListError(e.message.slice(0, 300));
    } finally {
      setAutoListing(false);
      setAutoListStep('');
    }
  }

  function startAutoList() {
    if (autoListing) return; // already running for this product/group
    const initial = {};
    for (const v of variants) {
      initial[v._id] = calcEbayPrice(v.current).toFixed(2);
    }
    setCustomPrices(initial);
    setPriceConfirming(true);
    setAutoListError('');
    setAutoListSuccess(null);
  }

  function cancelPriceConfirm() { setPriceConfirming(false); }

  async function confirmAutoList() {
    setPriceConfirming(false);
    await autoListOnEbay(customPrices);
  }

  async function fixVariationPhotos() {
    if (!groupEbayId) return;
    setFixingPhotos(true);
    setFixPhotosStatus('');
    setFixPhotosError('');
    try {
      // Pre-flight: register every sibling's hero image before any of them get scraped
      // for real, so the cross-sibling contamination filter is fully primed from this
      // very first click instead of only protecting whichever variant gets scraped later.
      if (variants.length > 1 && variants[0]?.groupId) {
        try {
          await fetch(`${API}/api/tracker/group/${variants[0].groupId}/preflight-images`, { method: 'POST' });
        } catch {}
      }

      // Step 1: Refresh images from Amazon for each variant sequentially to avoid concurrent
      // Amazon scrapes triggering bot detection — same reason we queue background uploads.
      const refreshed = [];
      for (const v of variants) {
        const result = await fetch(`${API}/api/tracker/${v._id}/refresh-images`, { method: 'POST' })
          .then(r => r.json())
          .catch(() => null);
        refreshed.push(result);
      }

      // Merge refreshed image list back into variant data
      const variantsWithFreshImages = variants.map((v, i) => ({
        ...v,
        images: refreshed[i]?.images?.length ? refreshed[i].images : (v.images?.length ? v.images : [v.image].filter(Boolean)),
      }));

      // Step 2: Upload ALL images per variant separately — folder slug uses EACH
      // variant's own ASIN, not a single shared "active" one, so B2 folder names
      // actually reflect which product's photos are inside.
      const variantCloudinaryImages = [];
      for (const v of variantsWithFreshImages) {
        const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
        if (!varImgs.length) { variantCloudinaryImages.push([]); continue; }
        const vAsin = v.specs?.asin || v.url?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || String(v._id).slice(-8);
        const vSlugBase = vAsin.toLowerCase().replace(/[^a-z0-9]/g, '');
        const varSlug = vSlugBase + '-fix-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '');
        try {
          const uploadRes = await fetch(`${API}/api/ebay/upload-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrls: varImgs, slug: varSlug }),
          });
          const uploadData = await uploadRes.json();
          variantCloudinaryImages.push(uploadRes.ok && uploadData.cloudinaryUrls?.length ? uploadData.cloudinaryUrls : []);
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

  // Competitor research — only fetched once expanded, using data already loaded on the card
  // (no extra /preview round trip like the standalone Research tab needs).
  const { comp, sold, compLoading } = useCompetitorCheck(showResearch ? active.title : null, showResearch ? active.upc : null);
  const estYourPrice = active?.current != null ? calcEbayPrice(active.current) : null;

  async function redoDescription() {
    if (!groupEbayId) return;
    setRedoingDescription(true);
    setRedoDescriptionStatus('');
    try {
      const imageUrls = [...new Set(variants.flatMap(v => [v.image, ...(v.images || [])]).filter(Boolean))].slice(0, 12);
      const descRes = await fetch(`${API}/api/ebay/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: active.title,
          specs: active.specs || {},
          bullets: active.bullets || [],
          imageUrls,
          upc: active.upc || null,
          variant: active.variant || null,
        }),
      });
      const descData = await descRes.json();
      if (!descRes.ok) throw new Error(descData.error || 'Failed to generate description');
      const revRes = await fetch(`${API}/api/ebay/listing/${groupEbayId}/revise-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descData.html }),
      });
      const revData = await revRes.json();
      if (!revRes.ok) throw new Error(revData.error || 'Failed to update listing');
      setRedoDescriptionStatus('ok');
      setTimeout(() => setRedoDescriptionStatus(''), 5000);
    } catch (e) {
      setRedoDescriptionStatus('fail');
    } finally {
      setRedoingDescription(false);
    }
  }

  async function confirmDeleteAll() {
    setDeleting(true);
    setDeleteError(null);
    try {
      // Single request for the whole group — runs entirely server-side, so it finishes
      // even if this tab closes or loses connection right after firing it. See
      // useProductTracker's handleDeleteGroup for why that beats one request per variant.
      await onDeleteGroup(variants.map(v => v._id));
    } catch (e) {
      setDeleteError(e.response?.data?.error || e.message || 'Delete failed');
      setDeleting(false);
    }
  }

  function handleDeleteVariant(variantId) {
    if (deletingVariantId) return;
    const variant = variants.find(v => v._id === variantId);
    if (!variant) return;

    if (variants.length === 1) {
      setConfirmingDelete(true);
      return;
    }

    setVariantDeleteError(null);
    setConfirmingVariantId(variantId);
  }

  async function performVariantDelete() {
    const variantId = confirmingVariantId;
    const variant = variants.find(v => v._id === variantId);
    if (!variant) { setConfirmingVariantId(null); return; }

    setDeletingVariantId(variantId);
    setVariantDeleteError(null);
    try {
      if (groupEbayId && variant.variant) {
        const ebayRes = await fetch(`${API}/api/ebay/listing/${groupEbayId}/variation`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantLabel: variant.variant }),
        });
        const ebayData = await ebayRes.json().catch(() => ({}));
        if (!ebayRes.ok) {
          setVariantDeleteError(ebayData.error || 'eBay error');
          return;
        }
        if (ebayData.zeroed) {
          alert(`"${variant.variant}" has sales history — eBay set it to qty 0 instead of deleting. It will be hidden from buyers.`);
        }
      }
      await fetch(`${API}/api/tracker/${variantId}`, { method: 'DELETE' });
      onVariantDeleted?.(variantId);
      setConfirmingVariantId(null);
    } catch (e) {
      setVariantDeleteError(e.message || 'Delete failed');
    } finally {
      setDeletingVariantId(null);
    }
  }

  const allUnavailable = variants.every(v => v.status === 'unavailable');
  const allOOS = variants.every(v => v.status === 'out_of_stock');
  const someIssue = variants.some(v => v.status && v.status !== 'active');
  const groupStatus = allUnavailable ? 'unavailable' : allOOS ? 'out_of_stock' : someIssue ? 'partial' : 'active';

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/70 transition-shadow flex flex-col p-4 md:p-5 ${detailMode ? 'gap-5 shadow-card' : 'gap-3 hover:shadow-soft'}`}>

      {/* ── Group header ── */}
      <div className={`flex items-start gap-3 min-w-0 ${detailMode ? 'gap-4 md:gap-5' : ''}`}>
        {active.image
          ? <FadeImg src={active.image} alt={active.title} className={`object-contain rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 ${detailMode ? 'w-24 h-24 md:w-32 md:h-32' : 'w-12 h-12'}`} />
          : <div className={`rounded-2xl bg-slate-100 flex-shrink-0 ${detailMode ? 'w-24 h-24 md:w-32 md:h-32' : 'w-12 h-12'}`} />
        }
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-slate-800 ${detailMode ? 'text-[15px] md:text-base leading-snug line-clamp-3 lg:line-clamp-none' : 'text-sm truncate'}`} title={active.title}>{active.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {variants.some(v => v.isPrime) && <AmazonPrimeBadge />}
            {detailMode && (() => {
              const priced = variants.filter(v => v.current != null);
              if (!priced.length) return null;
              const totalProfit = priced.reduce((sum, v) => {
                const cp = calcEbayPrice(v.current);
                return sum + (cp - trueCost(v.current) - calcEbayFee(cp));
              }, 0);
              const totalEbayPrice = priced.reduce((sum, v) => sum + calcEbayPrice(v.current), 0);
              const avgMargin = totalEbayPrice > 0 ? (totalProfit / totalEbayPrice * 100).toFixed(1) : '0.0';
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
            {detailMode && (() => {
              const listedAt = variants.find(v => v.listedAt)?.listedAt;
              if (!listedAt) return null;
              const days = Math.max(0, Math.floor((Date.now() - new Date(listedAt).getTime()) / 86400000));
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                  {days}d listed
                </span>
              );
            })()}
            {(() => {
              // Surfaces SKUs that keep blowing eBay's 24h tracking deadline, so their
              // handling time can be bumped — sourcing lag isn't something auto-tracking
              // can fix, only more slack in the listing's stated handling time can.
              const lateCount = Math.max(0, ...variants.map(v => v.lateShipmentCount || 0));
              if (lateCount < 2) return null;
              return (
                <span
                  title="This SKU has repeatedly missed eBay's 24h tracking deadline — consider extending its handling time"
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200"
                >
                  🐌 Late {lateCount}×
                </span>
              );
            })()}
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
        ) : (
          <button onClick={() => { setDeleteError(null); setConfirmingDelete(true); }} title="Stop tracking all variants"
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

      {/* ── Single-item listing but multiple variants tracked ── */}
      {groupEbayId && !variants.some(v => v.variant) && variants.length > 1 && (
        <div className="flex items-center gap-2 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-xl px-3.5 py-2 text-xs text-amber-700">
          <span>⚠️</span>
          <span className="font-semibold">eBay listing is single-item but you have {variants.length} variants — end it and use Auto List to rebuild with all variants.</span>
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
      <VariantSwatchGrid
        variants={variants}
        detailMode={detailMode}
        activeIdx={activeIdx}
        toggleExpand={toggleExpand}
        allExpanded={allExpanded}
        refreshingIds={refreshingIds}
        refreshResults={refreshResults}
        ebayPushResults={ebayPushResults}
        autoSyncErrors={autoSyncErrors}
        getLivePrice={getLivePrice}
        handleCheckOne={handleCheckOne}

        apiUrl={API}
        onDeleteVariant={handleDeleteVariant}
        deletingVariantId={deletingVariantId}
        groupEbayId={groupEbayId}
        ebayPricesFetched={variants.some(v => v.ebayPrice != null)}
        onAddVariantToEbay={handleAddVariantToEbay}
        addingToEbayId={addingToEbayId}
        addToEbayErrors={addToEbayErrors}
      />

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <a href={active.url?.startsWith('http') ? active.url : `https://${active.url}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
          Amazon ↗
        </a>
        <button
          onClick={() => {
            const url = active.url?.startsWith('http') ? active.url : `https://${active.url}`;
            navigator.clipboard.writeText(url).then(() => {
              setUrlCopied(true);
              setTimeout(() => setUrlCopied(false), 2000);
            });
          }}
          title="Copy Amazon URL"
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap"
        >
          {urlCopied ? '✓ Copied!' : '🔗 Copy URL'}
        </button>
        <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(active.upc || active.title)}&_sop=15`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-ebay ring-1 ring-inset ring-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
          eBay ↗
        </a>
        <EbayListingControls
          variants={variants}
          groupEbayId={groupEbayId}
          isMultiVariation={variants.some(v => v.ebayListingId && v.variant)}
          editingEbay={editingEbay}
          setEditingEbay={setEditingEbay}
          ebayInput={ebayInput}
          setEbayInput={setEbayInput}
          savingEbay={savingEbay}
          myListings={myListings}
          saveEbayListing={saveEbayListing}
          openEbayEdit={openEbayEdit}
          fixVariationPhotos={fixVariationPhotos}
          fixingPhotos={fixingPhotos}
          fixPhotosStatus={fixPhotosStatus}
          fixPhotosError={fixPhotosError}
          redoDescription={redoDescription}
          redoingDescription={redoingDescription}
          redoDescriptionStatus={redoDescriptionStatus}
          onAutoList={startAutoList}
          autoListing={autoListing}
          autoListStep={autoListStep}
          autoListError={autoListError}
          priceConfirming={priceConfirming}
          customPrices={customPrices}
          setCustomPrices={setCustomPrices}
          onConfirmList={confirmAutoList}
          onCancelPriceConfirm={cancelPriceConfirm}
          autoListSuccess={autoListSuccess}
        />
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
        <button onClick={() => setShowResearch(s => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap px-2.5 py-1 rounded-full hover:bg-slate-100">
          <span className="text-[10px]">{showResearch ? '▲' : '▼'}</span> 🔎 Research
        </button>
      </div>

      {showResearch && (
        <CompetitorPriceCheck title={active.title} comp={comp} sold={sold} compLoading={compLoading} estYourPrice={estYourPrice} />
      )}


      {groupEbayId && (() => { const c = ambiguousVariantLabels(variants); return c ? (
        <div className="bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-inset ring-amber-200 text-[11px] text-amber-700">
          ⚠ Variant name conflict: <strong>"{c.subset}"</strong> is a substring of <strong>"{c.superset}"</strong> — eBay price lookup may return the wrong price. Rename one variant to avoid overlap.
        </div>
      ) : null; })()}
      {autoListWarning === 'variant-name-overlap' && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-inset ring-amber-200 text-[11px] text-amber-700">
          ⚠️ Some variant names overlap (e.g. "Grass Green" inside "Red and Grass Green"). eBay will list them correctly — but price sync may occasionally match the wrong variant.
        </div>
      )}
      {autoListWarning === 'single-item-fallback' && (
        <div className="bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-inset ring-amber-200 text-[11px] text-amber-700">
          ⚠️ eBay doesn't allow multi-variation listings in this category — listed as a single item (first variant only). Each variant needs its own separate listing.
        </div>
      )}
      {autoListWarning?.startsWith('save-failed:') && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-inset ring-amber-200 text-[11px] text-amber-700">
          <span>⚠️ eBay listing created, but the listing ID failed to save for: <strong>{autoListWarning.slice('save-failed:'.length)}</strong>. Use "+ link existing listing manually" to fix.</span>
        </div>
      )}
      {autoListWarning === 'photos-failed' && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-inset ring-amber-200">
          {fixPhotosStatus === 'ok' ? (
            <p className="text-[11px] text-emerald-700 font-semibold">✓ Photos updated successfully.</p>
          ) : fixPhotosStatus === 'fail' ? (
            <p className="text-[11px] text-red-600 break-words">⚠ {fixPhotosError || 'Photos failed — try again.'}</p>
          ) : (
            <p className="text-[11px] text-amber-700 break-words">⚠ Listing created — per-variant photos failed.</p>
          )}
          <button
            onClick={fixVariationPhotos}
            disabled={fixingPhotos || !groupEbayId}
            title={!groupEbayId ? 'Waiting for listing to save…' : ''}
            className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ring-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            {fixingPhotos ? '📸 Uploading…' : fixPhotosStatus === 'ok' ? '✓ Done' : '🖼️ Fix Photos'}
          </button>
        </div>
      )}

      {/* ── Specs panel ── */}
      {showSpecs && <SpecsPanel active={active} activeIdx={activeIdx} />}

      <ConfirmDialog
        open={confirmingDelete}
        title={variants.length === 1 ? 'Stop tracking this product?' : `Remove all ${variants.length} variants?`}
        message={
          groupEbayId
            ? `This will end eBay listing #${groupEbayId} and permanently remove ${variants.length === 1 ? 'it' : `all ${variants.length} variants`} from the tracker. This can't be undone.`
            : `This will permanently remove ${variants.length === 1 ? 'it' : `all ${variants.length} variants`} from the tracker. This can't be undone.`
        }
        confirmLabel="Yes, delete"
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDeleteAll}
        onCancel={() => { setConfirmingDelete(false); setDeleteError(null); }}
      />

      {confirmingVariantId && (() => {
        const v = variants.find(x => x._id === confirmingVariantId);
        const label = v?.variant || 'this variant';
        return (
          <ConfirmDialog
            open={true}
            title={`Remove "${label}"?`}
            message={
              groupEbayId && v?.variant
                ? `This will remove the "${label}" variation from eBay listing #${groupEbayId} (or set it to qty 0 if it has sales history) and stop tracking it. This can't be undone.`
                : `This will stop tracking "${label}". This can't be undone.`
            }
            confirmLabel="Yes, remove"
            loading={deletingVariantId === confirmingVariantId}
            error={variantDeleteError}
            onConfirm={performVariantDelete}
            onCancel={() => { setConfirmingVariantId(null); setVariantDeleteError(null); }}
          />
        );
      })()}

    </div>
  );
}
