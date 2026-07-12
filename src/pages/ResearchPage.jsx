// Standalone "should I list this?" lookup — paste any Amazon URL and see eBay competitor
// pricing before deciding whether it's even worth tracking. Read-only: unlike AddProductPanel,
// nothing here gets saved — it just calls the same /preview endpoint to pull title/price/UPC.
import { useState } from 'react';
import axios from 'axios';
import FadeImg from '../components/FadeImg';
import CompetitorPriceCheck from '../components/CompetitorPriceCheck';
import useCompetitorCheck from '../hooks/useCompetitorCheck';
import { calcEbayPrice } from '../utils/pricing';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResearchPage() {
  const [url, setUrl] = useState('');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null); // { title, price, currency, image, upc, isPrime }

  const { comp, sold, compLoading } = useCompetitorCheck(product?.title, product?.upc);

  const estYourPrice = product?.price != null ? calcEbayPrice(product.price) : null;

  async function handleLookup(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || looking) return;
    setLooking(true);
    setError('');
    setProduct(null);
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      setProduct(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not fetch that product.');
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Research</h1>
      <p className="text-sm text-slate-400 mb-4">Check eBay competitor pricing before you commit to tracking or listing a product.</p>

      <form className="flex gap-2 mb-5" onSubmit={handleLookup}>
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
          <input
            type="text"
            placeholder="Paste an Amazon product URL to research…"
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
      {error && <p className="text-red-500 text-sm mb-4 px-1">{error}</p>}

      {product && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up max-w-xl">
          <div className="flex items-start gap-3">
            {product.image && (
              <FadeImg src={product.image} alt={product.title} className="w-14 h-14 object-contain rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {product.price != null && (
                  <span className="text-sm font-bold text-slate-900">{product.currency}{product.price.toLocaleString()}</span>
                )}
                {product.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{product.title}</p>
            </div>
          </div>

          <div className="mt-3">
            <CompetitorPriceCheck title={product.title} comp={comp} sold={sold} compLoading={compLoading} estYourPrice={estYourPrice} />
          </div>
        </div>
      )}
    </div>
  );
}
