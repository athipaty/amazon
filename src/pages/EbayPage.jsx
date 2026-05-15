import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function EbayCard({ item }) {
  const currencySymbol = item.currency === 'GBP' ? '£' : item.currency === 'EUR' ? '€' : '$';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-36 object-contain rounded-lg bg-gray-50"
        />
      )}

      <h3
        className="text-sm font-medium text-gray-700 leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        title={item.title}
      >
        {item.title}
      </h3>

      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-black text-gray-900">
          {currencySymbol}{item.price.toLocaleString()}
        </span>
        {item.shipping === 0 ? (
          <span className="text-xs text-green-600 font-medium">Free shipping</span>
        ) : item.shipping > 0 ? (
          <span className="text-xs text-gray-400">+{currencySymbol}{item.shipping} shipping</span>
        ) : null}
      </div>

      <span className="text-xs text-gray-400">{item.condition}</span>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto text-xs font-semibold text-[#e53238] hover:underline"
      >
        View on eBay →
      </a>
    </div>
  );
}

export default function EbayPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API}/api/ebay/search`, { params: { q } });
      setResults(data);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <header className="mb-7">
        <h1 className="text-xl font-bold text-gray-900 mb-1">eBay Price Search</h1>
        <p className="text-sm text-gray-400">Search for any product and compare eBay listings sorted by lowest price.</p>
      </header>

      <form className="flex gap-2 mb-6" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search eBay (e.g. iPhone 15, Sony WH-1000XM5)…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
          className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-red-400 transition-colors disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-[#e53238] text-white font-bold text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {!searched && !loading && (
        <div className="text-center mt-24 text-gray-400">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="text-base font-medium">Search for a product above.</p>
          <p className="text-sm mt-1">Results are sorted by lowest price.</p>
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <p className="text-center text-gray-400 mt-16">No results found for "{query}".</p>
      )}

      {results.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {results.map(item => <EbayCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
