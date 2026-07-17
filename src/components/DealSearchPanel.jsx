import { useState, useEffect } from 'react';
import axios from 'axios';
import FadeImg from './FadeImg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STORAGE_KEY = 'dealSearchPanel:v1';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Finds new products worth sourcing, seeded from what you actually sell — not a manual
// category pick. The backend looks at your recently sold orders and highest-viewed tracked
// listings, pulls Amazon's "frequently bought together" + same-category best-sellers for
// those, then hard-filters to Prime + 4+ stars + $20 or less + Amazon's Choice only. Takes
// 30-70s since the Amazon's Choice check is a live per-product page fetch — results are
// cached server-side 30min so repeat clicks are instant, and persisted here in localStorage
// so a page refresh doesn't lose them either. Nothing auto-clears the results — they stay
// until you run a new search or collapse the panel yourself (both remembered across reloads).
export default function DealSearchPanel({ onTrack, trackedAsins, defaultOpen = false, singleOnly = false, actionLabel = 'Track', workingLabel = 'Adding…' }) {
  const [open, setOpen] = useState(() => loadStored()?.open ?? defaultOpen);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(() => loadStored()?.note || '');
  const [deals, setDeals] = useState(() => loadStored()?.deals ?? null);
  const [searchedAt, setSearchedAt] = useState(() => loadStored()?.searchedAt || null);
  const [trackingAsin, setTrackingAsin] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, deals, note, searchedAt }));
    } catch { /* localStorage unavailable (private mode, quota) — persistence just no-ops */ }
  }, [open, deals, note, searchedAt]);

  async function handleSearch() {
    setSearching(true);
    setError('');
    setNote('');
    setDeals(null);
    try {
      const { data } = await axios.get(`${API}/api/tracker/search-similar`, { params: { singleOnly } });
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
            {searching ? 'Searching… (this takes 30-70s, checking each item live on Amazon)' : 'Search'}
          </button>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Filters:</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded-full px-2 py-0.5">Prime only</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-full px-2 py-0.5">★ 4.0+</span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 ring-1 ring-inset ring-purple-200 rounded-full px-2 py-0.5">Amazon's Choice only</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-full px-2 py-0.5">$20 or less</span>
            {searchedAt && !searching && (
              <span className="text-[10px] text-slate-300 ml-auto">Searched {new Date(searchedAt).toLocaleString()}</span>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mt-3 px-1">{error}</p>}
          {note && <p className="text-slate-400 text-sm mt-3 px-1">{note}</p>}

          {deals && (
            deals.length === 0 && !note ? (
              <p className="text-sm text-slate-400 mt-4 px-1">No Amazon's Choice matches found this time — try again later as your sales/views change.</p>
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
                          <span className="inline-flex items-center bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Amazon's Choice</span>
                          {singleOnly && deal.hasVariants && (
                            <span className="inline-flex items-center bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Has variants</span>
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
        </div>
      )}
    </div>
  );
}
