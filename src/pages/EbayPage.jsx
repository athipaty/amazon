import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Cards ──────────────────────────────────────────────────────────

function EbayCard({ item }) {
  const sym = item.currency === 'GBP' ? '£' : item.currency === 'EUR' ? '€' : '$';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      {item.image && (
        <img src={item.image} alt={item.title} className="w-full h-36 object-contain rounded-lg bg-gray-50" />
      )}
      <h3
        className="text-sm font-medium text-gray-700 leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        title={item.title}
      >
        {item.title}
      </h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-black text-gray-900">{sym}{item.price.toLocaleString()}</span>
        {item.shipping === 0 ? (
          <span className="text-xs text-green-600 font-medium">Free shipping</span>
        ) : item.shipping > 0 ? (
          <span className="text-xs text-gray-400">+{sym}{item.shipping} shipping</span>
        ) : null}
      </div>
      <span className="text-xs text-gray-400">{item.condition}</span>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-auto text-xs font-semibold text-[#e53238] hover:underline">
        View on eBay →
      </a>
    </div>
  );
}

function MyListingCard({ item }) {
  const sym = item.currency === 'GBP' ? '£' : item.currency === 'EUR' ? '€' : '$';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      {item.image ? (
        <img src={item.image} alt={item.title} className="w-full h-36 object-contain rounded-lg bg-gray-50" />
      ) : (
        <div className="w-full h-36 rounded-lg bg-gray-100 flex items-center justify-center text-4xl text-gray-300">📦</div>
      )}
      <h3
        className="text-sm font-medium text-gray-700 leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        title={item.title}
      >
        {item.title}
      </h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-black text-gray-900">{sym}{item.price.toLocaleString()}</span>
        <span className="text-xs text-gray-400">×{item.quantity} in stock</span>
      </div>
      <span className="text-xs text-gray-400 font-mono truncate" title={item.sku}>SKU: {item.sku}</span>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-auto text-xs font-semibold text-[#e53238] hover:underline">
          View listing →
        </a>
      )}
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────

function SearchTab({ initialUpc, initialTitle, initialQ }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [upcMode, setUpcMode] = useState(false);

  useEffect(() => {
    if (initialUpc) {
      setQuery(initialTitle || initialUpc);
      setUpcMode(true);
      doUpcSearch(initialUpc);
    } else if (initialQ) {
      setQuery(initialQ);
      doKeywordSearch(initialQ);
    }
  }, []);

  async function doUpcSearch(upc) {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get(`${API}/api/ebay/upc`, { params: { upc } });
      setResults(data); setSearched(true); setUpcMode(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Search failed');
    } finally { setLoading(false); }
  }

  async function doKeywordSearch(q) {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get(`${API}/api/ebay/search`, { params: { q } });
      setResults(data); setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Search failed');
    } finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setUpcMode(false);
    await doKeywordSearch(q);
  }

  return (
    <>
      <p className="text-sm text-gray-400 mb-5">
        {upcMode
          ? '✅ Exact product match via UPC — these are the same product as on Amazon.'
          : 'Search for any product. Results sorted by lowest price.'}
      </p>
      <form className="flex gap-2 mb-6" onSubmit={handleSubmit}>
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
    </>
  );
}

function MyListingsTab() {
  const [phase, setPhase] = useState('checking'); // checking | disconnected | loading | loaded | error
  const [listings, setListings] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/api/ebay/auth/status`)
      .then(({ data }) => {
        if (data.connected) { setPhase('loading'); fetchListings(); }
        else setPhase('disconnected');
      })
      .catch(() => setPhase('disconnected'));
  }, []);

  async function fetchListings() {
    try {
      const { data } = await axios.get(`${API}/api/ebay/my-listings`);
      setListings(data);
      setPhase('loaded');
    } catch (err) {
      if (err.response?.status === 401) { setPhase('disconnected'); return; }
      const e = err.response?.data?.error;
      setError(typeof e === 'string' ? e : err.message || 'Failed to load listings');
      setPhase('error');
    }
  }

  if (phase === 'checking' || phase === 'loading') {
    return (
      <div className="text-center mt-24 text-gray-400">
        {phase === 'checking' ? 'Checking connection…' : 'Loading your listings…'}
      </div>
    );
  }

  if (phase === 'disconnected') {
    return (
      <div className="text-center mt-24 text-gray-400">
        <p className="text-4xl mb-3">🔑</p>
        <p className="text-base font-medium mb-1">Connect your eBay account to see your listings.</p>
        <p className="text-sm mb-5">You'll be redirected to eBay to authorize read access.</p>
        <a
          href={`${API}/api/ebay/auth/login`}
          className="inline-block px-6 py-2.5 bg-[#e53238] text-white font-bold text-sm rounded-lg hover:bg-red-700 transition-colors"
        >
          Connect eBay Account
        </a>
      </div>
    );
  }

  if (phase === 'error') {
    return <p className="text-red-500 text-sm mt-4">{error}</p>;
  }

  if (listings.length === 0) {
    return <p className="text-center text-gray-400 mt-16">No active listings found.</p>;
  }

  return (
    <>
      <p className="text-sm text-gray-400 mb-5">{listings.length} active listing{listings.length !== 1 ? 's' : ''}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {listings.map(item => <MyListingCard key={item.offerId} item={item} />)}
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function EbayPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('connected') === '1' ? 'my-listings' : 'search');

  const upc = searchParams.get('upc');
  const title = searchParams.get('title');
  const q = searchParams.get('q');

  return (
    <div className="px-6 py-7">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 mb-3">eBay</h1>
        <div className="flex gap-1 border-b border-gray-200">
          {[['search', 'Search'], ['my-listings', 'My Listings']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === key
                  ? 'border-[#e53238] text-[#e53238]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'search'
        ? <SearchTab initialUpc={upc} initialTitle={title} initialQ={q} />
        : <MyListingsTab />
      }
    </div>
  );
}
