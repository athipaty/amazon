import { useState } from 'react';
import axios from 'axios';
import FadeImg from './FadeImg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Amazon's top-level browse categories — picking one steers the search toward
// discounted listings within that department only.
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

// Pick an Amazon category and find Prime-eligible items under a price ceiling with
// a 4+ star rating. Discount is shown when present but not required. maxPrice/actionLabel
// let this be reused outside the Deals tab (e.g. the Auction tab wants a lower ceiling and
// a "select this" action instead of "track"). singleOnly excludes anything that's a child of
// an Amazon variation family (color/size siblings) — the Auction tab wants single-item results
// only, since eBay auctions can't be multi-variation.
export default function DealSearchPanel({ onTrack, trackedAsins, defaultOpen = false, maxPrice = 15, singleOnly = false, actionLabel = 'Track', workingLabel = 'Adding…' }) {
  const [open, setOpen] = useState(defaultOpen);
  const [category, setCategory] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [deals, setDeals] = useState(null);
  const [trackingAsin, setTrackingAsin] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!category) return;
    setSearching(true);
    setError('');
    setDeals(null);
    try {
      const { data } = await axios.get(`${API}/api/tracker/search-deals`, { params: { category, maxPrice, singleOnly } });
      setDeals(data.deals || []);
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
          <p className="text-sm font-bold text-slate-800">Find items on sale</p>
          <p className="text-xs text-slate-400">Browse discounted, Prime-eligible deals by category</p>
        </div>
        <span className={`text-slate-300 text-sm flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-card animate-slide-up">
          <form className="flex gap-2" onSubmit={handleSearch}>
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🏷️</span>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={searching}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 text-slate-700 appearance-none"
              >
                <option value="">Choose an Amazon category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={searching || !category}
              className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Filters:</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded-full px-2 py-0.5">Prime only</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-full px-2 py-0.5">Under ${maxPrice}</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-full px-2 py-0.5">★ 4.0+</span>
          </div>

          {error && <p className="text-red-500 text-sm mt-3 px-1">{error}</p>}

          {deals && (
            deals.length === 0 ? (
              <p className="text-sm text-slate-400 mt-4 px-1">No matching items found in "{category}". Try a different category.</p>
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
                          {deal.originalPrice && <span className="text-xs text-slate-400 line-through">{deal.currency}{deal.originalPrice.toLocaleString()}</span>}
                          {deal.discountPercent > 0 && <span className="inline-flex items-center bg-red-50 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">−{deal.discountPercent}%</span>}
                          <span className="inline-flex items-center bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Prime</span>
                          {deal.isLimitedDeal && (
                            <span className="inline-flex items-center bg-amber-50 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">⚡ Limited deal</span>
                          )}
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
