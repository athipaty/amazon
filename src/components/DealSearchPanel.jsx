import { useState, useEffect } from 'react';
import axios from 'axios';
import FadeImg from './FadeImg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STORAGE_KEY = 'dealSearchPanel:category:v2';

// Must match KEEPA_CATEGORY_IDS keys in backend routes/tracker/index.js
const CATEGORIES = [
  'Electronics',
  'Home & Kitchen',
  'Kitchen & Dining',
  'Tools & Home Improvement',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Clothing, Shoes & Jewelry',
  'Health & Household',
  'Pet Supplies',
  'Office Products',
  'Patio, Lawn & Garden',
  'Baby',
  'Grocery & Gourmet Food',
  'Automotive',
  'Books',
  'Video Games',
];

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Pick a category, get back best-selling, single-listing (no color/size/pack-size variants)
// products in it — hard-filtered to Prime + 4+ stars + $60 or less, up to 25, in Amazon Best
// Sellers rank order. Every search runs the pipeline fresh (no server-side caching); the last
// results are persisted in localStorage so a page refresh doesn't lose them.
export default function DealSearchPanel({ onTrack, trackedAsins, defaultOpen = false, actionLabel = 'Track', workingLabel = 'Adding…' }) {
  const [open, setOpen] = useState(() => loadStored()?.open ?? defaultOpen);
  const [category, setCategory] = useState(() => loadStored()?.category || CATEGORIES[0]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(() => loadStored()?.note || '');
  const [deals, setDeals] = useState(() => loadStored()?.deals ?? null);
  const [searchedAt, setSearchedAt] = useState(() => loadStored()?.searchedAt || null);
  const [trackingAsin, setTrackingAsin] = useState(null);
  // Per-ASIN, on-demand — a category search can return up to 25 candidates, and eagerly
  // checking all of them would burn 25 ScraperAPI credits per search. { [asin]: 'loading' | data | 'error' }
  const [fulfillment, setFulfillment] = useState({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkAllProgress, setCheckAllProgress] = useState(null); // { done, total }
  const [hideAmazonFulfilled, setHideAmazonFulfilled] = useState(false);

  async function checkOne(deal) {
    setFulfillment(f => ({ ...f, [deal.asin]: 'loading' }));
    try {
      const { data } = await axios.get(`${API}/api/tracker/fulfillment`, { params: { url: deal.url } });
      setFulfillment(f => ({ ...f, [deal.asin]: data }));
      return data;
    } catch {
      setFulfillment(f => ({ ...f, [deal.asin]: 'error' }));
      return null;
    }
  }

  async function handleCheckFulfillment(deal) {
    await checkOne(deal);
  }

  // Sequential, paced ~3s apart — same pacing the backend's own image-scrape queue uses to
  // avoid Amazon bot detection on back-to-back scrapes. These are all Prime-filtered already
  // (the category search hard-filters to Prime), so what this surfaces is specifically Seller
  // Fulfilled Prime candidates — real carrier tracking without giving up the Prime badge/speed.
  // Given every one of the 208 already-tracked products came back Amazon-fulfilled on backfill,
  // don't expect this to find many — SFP is the exception, not the rule.
  async function handleCheckAll() {
    if (!deals?.length) return;
    setCheckingAll(true);
    const todo = deals.filter(d => !fulfillment[d.asin] || fulfillment[d.asin] === 'error');
    setCheckAllProgress({ done: 0, total: todo.length });
    for (let i = 0; i < todo.length; i++) {
      await checkOne(todo[i]);
      setCheckAllProgress({ done: i + 1, total: todo.length });
      if (i < todo.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
    setCheckingAll(false);
    setCheckAllProgress(null);
  }

  const visibleDeals = (deals || []).filter(d =>
    !(hideAmazonFulfilled && fulfillment[d.asin] && fulfillment[d.asin] !== 'loading' && fulfillment[d.asin] !== 'error' && fulfillment[d.asin].isAmazonFulfilled === true)
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, category, deals, note, searchedAt }));
    } catch { /* localStorage unavailable (private mode, quota) — persistence just no-ops */ }
  }, [open, category, deals, note, searchedAt]);

  async function handleSearch() {
    setSearching(true);
    setError('');
    setNote('');
    setDeals(null);
    try {
      const { data } = await axios.get(`${API}/api/tracker/best-sellers-by-category`, { params: { category } });
      setDeals(data.deals || []);
      setNote(data.note || '');
      setSearchedAt(Date.now());
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function handleTrack(deal) {
    setTrackingAsin(deal.asin);
    try {
      await onTrack(deal.url);
    } finally {
      setTrackingAsin(null);
    }
  }

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 bg-white border border-slate-200/70 rounded-2xl px-4 py-3.5 shadow-soft hover:shadow-card active:scale-[0.99] transition-all text-left"
      >
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amazon text-white text-lg shadow-soft flex-shrink-0">🏷️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">Find new products</p>
          <p className="text-xs text-slate-400">Best sellers by category — no variants</p>
        </div>
        <span className={`text-slate-300 text-sm flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-card animate-slide-up">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full mb-2.5 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amazon/30"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="w-full px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Filters:</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded-full px-2 py-0.5">Prime only</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-full px-2 py-0.5">★ 4.0+</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-full px-2 py-0.5">$60 or less</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">No variants</span>
            {searchedAt && !searching && (
              <span className="text-[10px] text-slate-300 ml-auto">Searched {new Date(searchedAt).toLocaleString()}</span>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mt-3 px-1">{error}</p>}
          {note && <p className="text-slate-400 text-sm mt-3 px-1">{note}</p>}

          {deals && deals.length > 0 && (
            <div className="flex items-center gap-3 mt-3 px-1 flex-wrap">
              <button
                onClick={handleCheckAll}
                disabled={checkingAll}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {checkingAll
                  ? `Checking shipping… ${checkAllProgress?.done ?? 0}/${checkAllProgress?.total ?? 0}`
                  : '🔎 Check shipping for all — finds Seller Fulfilled Prime'}
              </button>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideAmazonFulfilled}
                  onChange={e => setHideAmazonFulfilled(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amazon"
                />
                Hide Amazon-fulfilled
              </label>
            </div>
          )}

          {deals && (
            deals.length === 0 && !note ? (
              <p className="text-sm text-slate-400 mt-4 px-1">No single-listing best sellers cleared the filters this time — try again later.</p>
            ) : visibleDeals.length === 0 ? (
              <p className="text-sm text-slate-400 mt-4 px-1">All {deals.length} results are Amazon-fulfilled — nothing left once hidden. Try another category, or uncheck "Hide Amazon-fulfilled".</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {visibleDeals.map(deal => {
                  const alreadyTracked = trackedAsins?.has(deal.asin);
                  return (
                    <div key={deal.asin} className="flex gap-3 p-3 rounded-xl border border-slate-100 hover:border-amazon/30 hover:shadow-soft transition-all">
                      {deal.image && (
                        <FadeImg src={deal.image} alt={deal.title} className="w-16 h-16 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 flex flex-col">
                        <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">{deal.title}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{deal.currency}{deal.price.toLocaleString()}</span>
                          <span className="inline-flex items-center bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Prime</span>
                          {(() => {
                            const f = fulfillment[deal.asin];
                            if (!f) {
                              return (
                                <button
                                  onClick={() => handleCheckFulfillment(deal)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                  🔎 Check shipping
                                </button>
                              );
                            }
                            if (f === 'loading') {
                              return <span className="text-[10px] text-slate-300">Checking…</span>;
                            }
                            if (f === 'error' || f.isAmazonFulfilled == null) {
                              return <span className="text-[10px] text-slate-300">Shipping unknown</span>;
                            }
                            return f.isAmazonFulfilled ? (
                              <span
                                title={`Ships from: ${f.shipsFrom?.trim() || 'Amazon'} · Sold by: ${f.soldBy || 'unknown'}. eBay can't validate Amazon Logistics (TBA…) tracking numbers.`}
                                className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset ring-amber-200 cursor-help"
                              >
                                ⚠️ Amazon-fulfilled
                              </span>
                            ) : (
                              <span
                                title={`Ships from and sold by ${f.soldBy || 'the seller'} — real carrier tracking, should validate fine on eBay.`}
                                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200 cursor-help"
                              >
                                ✓ Ships from seller
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="flex flex-col gap-0.5">
                            {deal.rating ? (
                              <span className="text-[11px] text-slate-400">★ {deal.rating} ({deal.reviewCount.toLocaleString()})</span>
                            ) : (
                              <span className="text-[11px] text-slate-300">No rating</span>
                            )}
                            {deal.monthlySold && (
                              <span className="text-[11px] text-emerald-600 font-medium">{deal.monthlySold.toLocaleString()}+ sold/mo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={deal.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-lg hover:bg-slate-200 active:scale-[0.98] transition-all whitespace-nowrap"
                            >
                              🔗 Amazon
                            </a>
                            <button
                              onClick={() => handleTrack(deal)}
                              disabled={alreadyTracked || trackingAsin === deal.asin}
                              className="px-3 py-1.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-[11px] rounded-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                            >
                              {alreadyTracked ? '✓ Tracked' : trackingAsin === deal.asin ? workingLabel : actionLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
