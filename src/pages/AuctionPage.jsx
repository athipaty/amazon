// Standalone "list this as an eBay auction" flow — paste any Amazon URL (doesn't need to already
// be tracked), pick a single variant if the listing has more than one (eBay auctions can't be
// multi-variation), set a starting price + duration, and create a live auction listing.
//
// Clicking "Create Auction" tracks the chosen item first (same POST /api/tracker the normal
// "Track Price" flow uses, reusing the existing record if it's already tracked), then reuses the
// same title/image/description generation calls the fixed-price auto-list flow uses, then hits
// the new /api/ebay/trading-create-auction-listing route, then PATCHes the tracked record with
// the resulting listing ID and listingType: 'AUCTION' — which useProductTracker.js filters out
// of the Deals/Tracker views, so auction listings stay on their own list here instead of mixing
// in with fixed-price ones.
import { useEffect, useState } from 'react';
import axios from 'axios';
import FadeImg from '../components/FadeImg';
import DealSearchPanel from '../components/DealSearchPanel';
import { AUTO_LIST_STEP_LABELS } from '../utils/productGroupHelpers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DURATIONS = [1, 3, 5, 7, 10];
const STEP_LABELS = { ...AUTO_LIST_STEP_LABELS, tracking: '📌 Tracking product…', listing: '📤 Creating auction…' };
// Matches the progress-dots pattern in EbayListingControls.jsx (the fixed-price auto-list flow)
const STEP_ORDER = ['tracking', 'title', 'preparing-images', 'images', 'description', 'listing', 'saving'];

export default function AuctionPage() {
  const [url, setUrl] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [preview, setPreview] = useState(null); // full /preview response incl. specs/bullets/images

  const [selectedAsin, setSelectedAsin] = useState(null);
  const [startingPrice, setStartingPrice] = useState('');
  const [durationDays, setDurationDays] = useState(7);

  const [step, setStep] = useState(null); // null | 'title' | 'images' | 'description' | 'listing' | 'done' | 'error'
  const [listingError, setListingError] = useState('');
  const [result, setResult] = useState(null); // { listingId, url }

  // Products already listed as auctions (listingType: 'AUCTION') — kept on their own list here
  // rather than mixed into the fixed-price Deals/Tracker views.
  const [myAuctions, setMyAuctions] = useState([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  async function loadMyAuctions() {
    try {
      const { data } = await axios.get(`${API}/api/tracker`);
      setMyAuctions(data.filter(p => p.listingType === 'AUCTION'));
    } catch { /* leave the previous list showing rather than clearing it on a transient failure */ }
    finally {
      setLoadingAuctions(false);
    }
  }

  useEffect(() => { loadMyAuctions(); }, []);

  const variants = preview?.variants || [];
  const hasVariants = variants.length > 1;
  // The single item actually being listed — either the picked variant, or the base preview
  // itself when there's nothing to choose between.
  const active = hasVariants
    ? variants.find(v => v.asin === selectedAsin) || null
    : preview ? { label: preview.title, price: preview.price, image: preview.image, asin: preview.groupId, url } : null;

  const [priceLookupLoading, setPriceLookupLoading] = useState(false);
  // Full /preview response for the selected variant's own page, when we had to fetch it because
  // the listing scrape's per-variant data was incomplete — reused for its image/gallery too (see
  // createAuction), not just the price it was originally fetched for.
  const [resolvedVariant, setResolvedVariant] = useState(null);

  // Pre-fill a starting-price suggestion once an item resolves — half the Amazon price, a low
  // opener meant to attract bids (not calcEbayPrice's fixed-price-equivalent, which is meant for
  // list-it-and-walk-away selling, not auctions). Only ever computed from that exact item's own
  // price: never borrow another variant's price as an estimate — a 37-variant product where
  // every variant had price:null taught us that borrowing a differently-priced sibling produces
  // a confidently wrong number, not a rough one.
  //
  // Amazon's variant listing data very often omits per-variant pricing (same 37-variant case —
  // every single one had price:null). Rather than leave the field blank, fetch that specific
  // variant's own product page (its own dedicated URL) to get its real price directly.
  useEffect(() => {
    let cancelled = false;
    setPriceLookupLoading(false);
    setResolvedVariant(null);
    if (active?.price != null) {
      setStartingPrice((active.price / 2).toFixed(2));
      return;
    }
    if (!active?.url) {
      setStartingPrice('');
      return;
    }
    setStartingPrice('');
    setPriceLookupLoading(true);
    axios.post(`${API}/api/tracker/preview`, { url: active.url })
      .then(({ data }) => {
        if (cancelled) return;
        setResolvedVariant(data);
        if (data.price != null) setStartingPrice((data.price / 2).toFixed(2));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPriceLookupLoading(false); });
    return () => { cancelled = true; };
  }, [active?.asin, active?.price, active?.url]);

  async function handleLookup(e, urlOverride) {
    e.preventDefault();
    const trimmed = (urlOverride ?? url).trim();
    if (!trimmed || looking) return;
    setLooking(true);
    setLookupError('');
    setPreview(null);
    setSelectedAsin(null);
    setStep(null);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      setPreview(data);
      setUrl(trimmed);
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Could not fetch that product.');
    } finally {
      setLooking(false);
    }
  }

  // A deal picked from the "find a product" panel below feeds the same preview flow as
  // pasting its URL manually — nothing gets tracked, it just becomes the item being auctioned.
  function handleSelectDeal(dealUrl) {
    return handleLookup({ preventDefault: () => {} }, dealUrl);
  }

  async function createAuction() {
    if (!active || !startingPrice || !durationDays || step) return;
    setListingError('');
    setResult(null);
    try {
      // Track this exact item first, same as the normal "Track Price" flow — so it shows up
      // in Tracker/Deals like anything else, instead of the auction existing with no DB record
      // of what was actually listed. If it's already tracked (409), reuse that record rather
      // than failing — but block outright if it's already listed on eBay, so this can't
      // accidentally create a second, duplicate live listing for the same product.
      setStep('tracking');
      let trackedProduct;
      try {
        const trackRes = await axios.post(`${API}/api/tracker`, { url: active.url, groupId: preview.groupId });
        trackedProduct = trackRes.data;
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.product) {
          trackedProduct = err.response.data.product;
        } else {
          throw new Error(err.response?.data?.error || 'Failed to track this product.');
        }
      }
      if (trackedProduct.ebayListingId) {
        throw new Error(`This product is already listed on eBay (listing ${trackedProduct.ebayListingId}) — pick a different variant, or manage that listing from the Deals/Tracker tab instead.`);
      }

      setStep('title');
      const titleRes = await axios.post(`${API}/api/ebay/seo-title`, { title: preview.title, specs: preview.specs });
      const ebayTitle = titleRes.data.title || preview.title;

      setStep('preparing-images');
      // Fall back through, in order: the variant's own image from the listing scrape, the same
      // variant's image/gallery from its own page (fetched during price lookup, when the listing
      // scrape's per-variant data was incomplete), then the whole listing's main image/gallery —
      // that top-level image is reliably present even when per-variant image/gallery data isn't.
      // All of that is Keepa-cached data, free to reuse.
      let imgs = [...new Set([
        active.image, resolvedVariant?.image, preview.image,
        ...(resolvedVariant?.images || []), ...(preview.images || []),
      ].filter(Boolean))].slice(0, 12);
      if (!imgs.length) {
        // The tracking step above already kicked off its own background image scrape for this
        // exact product (queueImageUpload, server-side). Poll for that to finish instead of
        // firing a second, concurrent scrape of the same product here — two scrapes racing each
        // other risks Amazon's bot detection, the same reason that queue is serialized to begin
        // with. Only fall back to an explicit refresh-images call (a real second scrape) if the
        // background one genuinely never delivers anything after waiting for it.
        for (let attempt = 0; attempt < 6 && !imgs.length; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const { data } = await axios.get(`${API}/api/tracker/${trackedProduct._id}`);
            if (data.images?.length) imgs = data.images.slice(0, 12);
          } catch { /* keep polling */ }
        }
        if (!imgs.length) {
          try {
            const refreshRes = await axios.post(`${API}/api/tracker/${trackedProduct._id}/refresh-images`);
            if (refreshRes.data.images?.length) imgs = refreshRes.data.images.slice(0, 12);
          } catch { /* falls through to the hard error below */ }
        }
      }
      if (!imgs.length) throw new Error('No product images found to upload.');

      setStep('images');
      const slug = String(active.asin || preview.groupId || 'item').toLowerCase().replace(/[^a-z0-9]/g, '');
      const uploadRes = await axios.post(`${API}/api/ebay/upload-images`, { imageUrls: imgs, slug });
      const cloudinaryUrls = uploadRes.data.cloudinaryUrls || [];
      if (!cloudinaryUrls.length) throw new Error('No product images could be uploaded to storage.');

      setStep('description');
      let description = null;
      try {
        const descRes = await axios.post(`${API}/api/ebay/generate-description`, {
          title: ebayTitle, specs: preview.specs || {}, imageUrls: cloudinaryUrls,
          bullets: preview.bullets || [], upc: preview.upc, variant: hasVariants ? active.label : null,
        });
        description = descRes.data.html || null;
      } catch { /* fall back to backend's generic placeholder */ }

      setStep('listing');
      const listRes = await axios.post(`${API}/api/ebay/trading-create-auction-listing`, {
        title: ebayTitle,
        price: Number(startingPrice).toFixed(2),
        imageUrls: cloudinaryUrls,
        upc: preview.upc,
        specs: preview.specs || {},
        ...(description ? { description } : {}),
        durationDays,
      });
      setResult(listRes.data);

      setStep('saving');
      try {
        await axios.patch(`${API}/api/tracker/${trackedProduct._id}/ebay`, {
          ebayListingId: listRes.data.listingId,
          cloudinaryFolder: `ebay-listings/${slug}`,
          ebayPrice: Number(startingPrice),
          listingType: 'AUCTION',
        });
      } catch { /* listing succeeded either way — this just links it back to the tracked record */ }

      setStep('done');
      loadMyAuctions();
    } catch (err) {
      setListingError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to create auction listing');
      setStep('error');
    }
  }

  const listing = step && step !== 'done' && step !== 'error';

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Auction</h1>
      <p className="text-sm text-slate-400 mb-4">Paste an Amazon URL and list it on eBay as an auction — starting price and duration only.</p>

      <DealSearchPanel
        onTrack={handleSelectDeal}
        maxPrice={6}
        singleOnly
        actionLabel="Auction This"
        workingLabel="Loading…"
      />

      <form className="flex gap-2 mb-5" onSubmit={handleLookup}>
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
          <input
            type="text"
            placeholder="Paste an Amazon product URL…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={looking}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 placeholder:text-slate-400 shadow-soft"
          />
        </div>
        <button
          type="submit"
          disabled={looking || !url.trim()}
          className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
        >
          {looking ? 'Checking…' : 'Check'}
        </button>
      </form>
      {lookupError && <p className="text-red-500 text-sm mb-4 px-1">{lookupError}</p>}

      {preview && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up max-w-xl">
          <div className="flex items-start gap-3">
            {preview.image && (
              <FadeImg src={preview.image} alt={preview.title} className="w-14 h-14 object-contain rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">
                  {hasVariants ? `${variants.length} variants found` : (preview.price != null ? `${preview.currency}${preview.price.toLocaleString()}` : 'Price varies')}
                </p>
                {preview.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{preview.title}</p>
            </div>
          </div>

          {/* eBay auctions can't be multi-variation — force a single choice */}
          {hasVariants && (
            <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1">Pick one variant to auction</p>
              {variants.map(v => (
                <label
                  key={v.asin}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${selectedAsin === v.asin ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : 'hover:bg-slate-50'}`}
                >
                  <input
                    type="radio"
                    name="auction-variant"
                    checked={selectedAsin === v.asin}
                    onChange={() => setSelectedAsin(v.asin)}
                    className="w-4 h-4 accent-amazon flex-shrink-0"
                  />
                  {v.image && (
                    <FadeImg src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-700 flex-1">{v.label}</span>
                  {v.price != null
                    ? <span className="text-sm font-bold text-slate-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                    : <span className="text-xs text-slate-400 flex-shrink-0">price varies</span>
                  }
                </label>
              ))}
            </div>
          )}

          {/* Starting price + duration, once a single item is resolved */}
          {active && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex gap-3 flex-wrap">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Starting price</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number" min="0.99" step="0.01"
                      value={startingPrice}
                      onChange={e => setStartingPrice(e.target.value)}
                      disabled={listing}
                      placeholder={priceLookupLoading ? 'Looking up price…' : ''}
                      className="w-40 pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 disabled:bg-slate-50 placeholder:text-slate-400 placeholder:text-xs"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Duration</span>
                  <div className="flex gap-1">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        type="button"
                        disabled={listing}
                        onClick={() => setDurationDays(d)}
                        className={`px-3 py-2 text-sm rounded-xl border transition-all disabled:opacity-50 ${
                          durationDays === d
                            ? 'bg-amazon border-amazon text-white font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              {/* Step progress dots — same pattern as EbayListingControls.jsx's fixed-price auto-list flow */}
              {listing && (
                <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl ring-1 ring-inset bg-blue-50 ring-blue-200">
                  <div className="flex items-center">
                    {STEP_ORDER.map((s, i) => {
                      const currentIdx = STEP_ORDER.indexOf(step);
                      const done = i < currentIdx;
                      const isActive = i === currentIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 transition-colors ${
                            done ? 'bg-blue-500 text-white' :
                            isActive ? 'bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-300' :
                            'bg-slate-200 text-slate-400'
                          }`}>
                            {done ? '✓' : i + 1}
                          </div>
                          {i < STEP_ORDER.length - 1 && (
                            <div className={`w-3 h-px flex-shrink-0 ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-blue-700 font-semibold leading-snug">
                    {STEP_LABELS[step] || '⏳ Working…'}
                  </span>
                </div>
              )}

              <button
                onClick={createAuction}
                disabled={listing || !startingPrice || Number(startingPrice) <= 0}
                className="self-start px-4 py-2 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft"
              >
                {listing ? 'Working…' : 'Create Auction'}
              </button>

              {step === 'error' && (
                <p className="text-red-500 text-sm">{listingError}</p>
              )}
              {step === 'done' && result && (
                <div className="bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
                  ✓ Auction listed — <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">view on eBay ↗</a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live auctions — kept off the Deals/Tracker views (see useProductTracker.js) so
          fixed-price and auction listings don't get mixed together */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">My Auctions</h2>
        {loadingAuctions ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : myAuctions.length === 0 ? (
          <p className="text-sm text-slate-400">No auction listings yet — create one above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myAuctions.map(p => (
              <div key={p._id} className="flex gap-3 p-3 rounded-xl border border-slate-100 hover:border-amazon/30 hover:shadow-soft transition-all">
                {p.image && (
                  <FadeImg src={p.image} alt={p.title} className="w-16 h-16 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                  <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">{p.title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {p.ebayPrice != null && (
                      <span className="text-sm font-bold text-slate-900">${p.ebayPrice.toLocaleString()}</span>
                    )}
                    <span className="text-slate-400">starting bid</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-[11px] text-slate-400">
                      {p.listedAt ? `Listed ${new Date(p.listedAt).toLocaleDateString()}` : ''}
                    </span>
                    <a
                      href={`https://www.ebay.com/itm/${p.ebayListingId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-ebay text-white font-bold text-[11px] rounded-lg hover:bg-ebay-dark active:scale-[0.98] transition-all whitespace-nowrap"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
