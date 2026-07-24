import { useState, useEffect } from 'react';
import axios from 'axios';
import FadeImg from './FadeImg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STORAGE_KEY = 'dealSearchPanel:v1';
const BEST_SELLERS_STORAGE_KEY = 'dealSearchPanel:bestSellers:v1';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadStoredBestSellers() {
  try {
    const raw = localStorage.getItem(BEST_SELLERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Finds new products worth sourcing, seeded from what you actually sell — the backend looks at
// your recently sold orders and highest-viewed tracked listings, pulls Amazon's "frequently
// bought together" + same-category best-sellers for those. Results are hard-filtered to Prime +
// 4+ stars + $60 or less. Distinct quantity/pack-size variants aren't a requirement — products
// with more pack sizes just rank higher (more upsell room). Every search runs the pipeline fresh
// (no server-side caching), and results are persisted here in localStorage so a page refresh
// doesn't lose them. Nothing auto-clears the results — they stay until you run a new search or
// collapse the panel yourself (both remembered across reloads).
export default function DealSearchPanel({ onTrack, trackedAsins, defaultOpen = false, actionLabel = 'Track', workingLabel = 'Adding…' }) {
  const [open, setOpen] = useState(() => loadStored()?.open ?? defaultOpen);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(() => loadStored()?.note || '');
  const [deals, setDeals] = useState(() => loadStored()?.deals ?? null);
  const [searchedAt, setSearchedAt] = useState(() => loadStored()?.searchedAt || null);
  const [trackingAsin, setTrackingAsin] = useState(null);

  const [bsSearching, setBsSearching] = useState(false);
  const [bsError, setBsError] = useState('');
  const [bsDeals, setBsDeals] = useState(() => loadStoredBestSellers()?.deals ?? null);
  const [bsSearchedAt, setBsSearchedAt] = useState(() => loadStoredBestSellers()?.searchedAt || null);
  const [bsTrackingAsin, setBsTrackingAsin] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, deals, note, searchedAt }));
    } catch { /* localStorage unavailable (private mode, quota) — persistence just no-ops */ }
  }, [open, deals, note, searchedAt]);

  useEffect(() => {
    try {
      localStorage.setItem(BEST_SELLERS_STORAGE_KEY, JSON.stringify({ deals: bsDeals, searchedAt: bsSearchedAt }));
    } catch { /* localStorage unavailable (private mode, quota) — persistence just no-ops */ }
  }, [bsDeals, bsSearchedAt]);

  async function handleSearch() {
    setSearching(true);
    setError('');
    setNote('');
    setDeals(null);
    try {
      const { data } = await axios.get(`${API}/api/tracker/search-similar`);
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

  // One no-variant best seller per Amazon category (17 categories) — for prospecting into new
  // categories without inheriting a multi-variant listing.
  async function handleSearchBestSellers() {
    setBsSearching(true);
    setBsError('');
    setBsDeals(null);
    try {
      const { data } = await axios.get(`${API}/api/tracker/best-sellers-by-category`);
      setBsDeals(data.deals || []);
      setBsSearchedAt(Date.now());
    } catch (err) {
      setBsError(err.response?.data?.error || err.message || 'Search failed.');
    } finally {
      setBsSearching(false);
    }
  }

  async function handleTrackBestSeller(deal) {
    setBsTrackingAsin(deal.asin);
    try {
      await onTrack(deal.url);
    } finally {
      setBsTrackingAsin(null);
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
          <p className="text-sm font-bold text-slate-800">Find similar to what you sell</p>
          <p className="text-xs text-slate-400">Based on your sold orders + highest-viewed listings</p>
        </div>
        <span className={`text-slate-300 text-sm flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-card animate-slide-up">
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
            {searchedAt && !searching && (
              <span className="text-[10px] text-slate-300 ml-auto">Searched {new Date(searchedAt).toLocaleString()}</span>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mt-3 px-1">{error}</p>}
          {note && <p className="text-slate-400 text-sm mt-3 px-1">{note}</p>}

          {deals && (
            deals.length === 0 && !note ? (
              <p className="text-sm text-slate-400 mt-4 px-1">No matches found this time — try again later as your sales/views change.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {deals.map(deal => {
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
                          {deal.qtyVariants?.length > 0 && (
                            <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Qty: {deal.qtyVariants.join(', ')} pcs</span>
                          )}
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

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-800">Best sellers by category</p>
            <p className="text-xs text-slate-400 mt-0.5">
              One top-ranked, single-listing product per Amazon category — no color/size/pack-size variants.
            </p>
            <button
              onClick={handleSearchBestSellers}
              disabled={bsSearching}
              className="w-full mt-2.5 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:border-amazon/40 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {bsSearching ? 'Checking all categories…' : 'Search best sellers'}
            </button>
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Filters:</span>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded-full px-2 py-0.5">Prime only</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-full px-2 py-0.5">★ 4.0+</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-full px-2 py-0.5">$60 or less</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">No variants</span>
              {bsSearchedAt && !bsSearching && (
                <span className="text-[10px] text-slate-300 ml-auto">Searched {new Date(bsSearchedAt).toLocaleString()}</span>
              )}
            </div>

            {bsError && <p className="text-red-500 text-sm mt-3 px-1">{bsError}</p>}

            {bsDeals && (
              bsDeals.length === 0 ? (
                <p className="text-sm text-slate-400 mt-4 px-1">No categories cleared the filters this time — try again later.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                        <th className="text-left pb-1.5 pr-2">Category</th>
                        <th className="text-left pb-1.5 px-2">Item</th>
                        <th className="text-right pb-1.5 px-2">Price</th>
                        <th className="text-right pb-1.5 px-2">Rating</th>
                        <th className="pb-1.5 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bsDeals.map(deal => {
                        const alreadyTracked = trackedAsins?.has(deal.asin);
                        return (
                          <tr key={deal.asin} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                            <td className="py-2 pr-2 text-xs text-slate-500 font-medium whitespace-nowrap">{deal.category}</td>
                            <td className="py-2 px-2">
                              <a href={deal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
                                {deal.image && (
                                  <FadeImg src={deal.image} alt={deal.title} className="w-10 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                                )}
                                <span className="text-xs text-slate-700 font-medium leading-snug line-clamp-2 min-w-0">{deal.title}</span>
                              </a>
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900 whitespace-nowrap">{deal.currency}{deal.price.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              {deal.rating ? (
                                <span className="text-slate-500">★ {deal.rating} <span className="text-slate-300">({deal.reviewCount?.toLocaleString()})</span></span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2 pl-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => handleTrackBestSeller(deal)}
                                  disabled={alreadyTracked || bsTrackingAsin === deal.asin}
                                  className="px-3 py-1.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-[11px] rounded-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                >
                                  {alreadyTracked ? '✓ Tracked' : bsTrackingAsin === deal.asin ? workingLabel : actionLabel}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
