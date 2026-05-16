import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ProductCard from '../components/ProductCard';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AmazonPage() {
  const [products, setProducts] = useState([]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null); // { title, price, currency, image, variants }
  const [selectedAsins, setSelectedAsins] = useState(new Set());
  const [addingVariants, setAddingVariants] = useState(false);
  const [addProgress, setAddProgress] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    loadProducts();

    socketRef.current = io(API);
    const socket = socketRef.current;

    socket.on('tracker:check:start', ({ count }) => {
      setChecking(true);
      setStatusMsg(`Checking ${count} product${count !== 1 ? 's' : ''}...`);
    });

    socket.on('tracker:check:done', () => {
      setChecking(false);
      setStatusMsg('');
      loadProducts();
    });

    socket.on('tracker:price:drop', ({ product }) => {
      setProducts(prev => prev.map(p => p._id === product._id ? product : p));
    });

    const poll = setInterval(loadProducts, 30000);
    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  async function loadProducts() {
    try {
      const { data } = await axios.get(`${API}/api/tracker`);
      setProducts(data);
    } catch {}
  }

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError('');
    try {
      const { data } = await axios.post(`${API}/api/tracker/preview`, { url: trimmed });
      if (data.variants && data.variants.length > 1) {
        setPreview(data);
        setSelectedAsins(new Set(data.variants.map(v => v.asin)));
      } else {
        const { data: product } = await axios.post(`${API}/api/tracker`, { url: trimmed });
        setProducts(prev => [product, ...prev]);
        setUrl('');
      }
    } catch (err) {
      setAddError(err.response?.data?.error || err.message || 'Failed to reach the server.');
    } finally {
      setAdding(false);
    }
  }

  async function handleTrackSelected() {
    if (!preview || selectedAsins.size === 0) return;
    setAddingVariants(true);
    setAddError('');
    const toAdd = preview.variants.filter(v => selectedAsins.has(v.asin));
    const added = [];
    for (let i = 0; i < toAdd.length; i++) {
      setAddProgress(`Adding ${i + 1} of ${toAdd.length}…`);
      try {
        const { data } = await axios.post(`${API}/api/tracker`, { url: toAdd[i].url });
        added.push(data);
      } catch {}
    }
    setProducts(prev => [...added.reverse(), ...prev]);
    setPreview(null);
    setSelectedAsins(new Set());
    setUrl('');
    setAddingVariants(false);
    setAddProgress('');
  }

  function toggleVariant(asin, checked) {
    const next = new Set(selectedAsins);
    if (checked) next.add(asin); else next.delete(asin);
    setSelectedAsins(next);
  }

  async function handleDelete(id) {
    await axios.delete(`${API}/api/tracker/${id}`);
    setProducts(prev => prev.filter(p => p._id !== id));
  }

  async function handleCheckOne(id) {
    try {
      const { data } = await axios.post(`${API}/api/tracker/check/${id}`);
      setProducts(prev => prev.map(p => p._id === id ? data : p));
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Check failed');
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setStatusMsg('Checking prices…');
    try {
      const { data } = await axios.post(`${API}/api/tracker/check`);
      if (data.products) setProducts(data.products);
    } catch {
    } finally {
      setChecking(false);
      setStatusMsg('');
    }
  }

  return (
    <div className="px-6 py-7">
      <header className="flex justify-between items-center mb-7 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Amazon Price Tracker</h1>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? 'Checking…' : 'Check All Now'}
        </button>
      </header>

      <div className="mb-5">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Paste an Amazon product URL to track…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={adding || !!preview}
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400 transition-colors disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={adding || !url.trim() || !!preview}
            className="px-5 py-2.5 bg-yellow-400 text-gray-900 font-bold text-sm rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {adding ? 'Loading…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}
      </div>

      {preview && (
        <div className="mb-5 bg-white border border-yellow-300 rounded-xl p-5">
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {preview.variants.length} variants found — select which to track:
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{preview.title}</p>
            </div>
            <button
              onClick={() => { setPreview(null); setSelectedAsins(new Set()); }}
              className="text-gray-300 hover:text-gray-500 text-xl leading-none ml-3"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1">
            {preview.variants.map(v => (
              <label
                key={v.asin}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAsins.has(v.asin)}
                  onChange={e => toggleVariant(v.asin, e.target.checked)}
                  className="w-4 h-4 accent-yellow-400 flex-shrink-0"
                />
                {v.image && (
                  <img src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded bg-gray-50 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-700 flex-1">{v.label}</span>
                {v.price != null
                  ? <span className="text-sm font-bold text-gray-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                  : <span className="text-xs text-gray-400 flex-shrink-0">price varies</span>
                }
              </label>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleTrackSelected}
              disabled={addingVariants || selectedAsins.size === 0}
              className="px-4 py-2 bg-yellow-400 text-gray-900 font-bold text-sm rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingVariants ? addProgress : `Track Selected (${selectedAsins.size})`}
            </button>
            <button
              onClick={() => setSelectedAsins(new Set(preview.variants.map(v => v.asin)))}
              disabled={addingVariants}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedAsins(new Set())}
              disabled={addingVariants}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              None
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 mb-5 text-sm text-yellow-800">
          <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
          {statusMsg}
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center mt-24 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base font-medium">No products tracked yet.</p>
          <p className="text-sm mt-1">Paste an Amazon URL above to start tracking prices.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <ProductCard key={p._id} product={p} onCheck={handleCheckOne} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
