import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ProductCard from './components/ProductCard';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [products, setProducts] = useState([]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [nextCheck, setNextCheck] = useState(null);
  const [checking, setChecking] = useState(false);
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

    socket.on('tracker:scheduled', ({ nextCheck }) => {
      setNextCheck(nextCheck);
    });

    axios.get(`${API}/api/tracker/status`).then(r => {
      if (r.data.nextCheck) setNextCheck(r.data.nextCheck);
    });

    return () => socket.disconnect();
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
      const { data } = await axios.post(`${API}/api/tracker`, { url: trimmed });
      setProducts(prev => [data, ...prev]);
      setUrl('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to reach the server.';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    await axios.delete(`${API}/api/tracker/${id}`);
    setProducts(prev => prev.filter(p => p._id !== id));
  }

  async function handleCheckOne(id) {
    try {
      const { data } = await axios.post(`${API}/api/tracker/check/${id}`);
      setProducts(prev => prev.map(p => p._id === id ? data : p));
    } catch {}
  }

  async function handleCheckNow() {
    setChecking(true);
    setStatusMsg('Checking prices…');
    try {
      const { data } = await axios.post(`${API}/api/tracker/check`);
      if (data.products) setProducts(data.products);
    } catch {
      // silent — products will still refresh on next loadProducts
    } finally {
      setChecking(false);
      setStatusMsg('');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-7 min-h-screen bg-gray-50">

      {/* Header */}
      <header className="flex justify-between items-center mb-7 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <h1 className="text-xl font-bold text-gray-900">Amazon Price Tracker</h1>
        </div>
        <div className="flex items-center gap-3">
          {nextCheck && (
            <span className="text-xs text-gray-400">
              Next check: {new Date(nextCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium cursor-pointer hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? 'Checking…' : 'Check Now'}
          </button>
        </div>
      </header>

      {/* Add form */}
      <div className="mb-5">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Paste an Amazon product URL to track…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={adding}
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400 transition-colors disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={adding || !url.trim()}
            className="px-5 py-2.5 bg-yellow-400 text-gray-900 font-bold text-sm rounded-lg cursor-pointer hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {adding ? 'Adding…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}
      </div>

      {/* Status bar */}
      {statusMsg && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 mb-5 text-sm text-yellow-800">
          <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
          {statusMsg}
        </div>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className="text-center mt-24 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base font-medium">No products tracked yet.</p>
          <p className="text-sm mt-1">Paste an Amazon URL above to start tracking prices.</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {products.map(p => (
            <ProductCard key={p._id} product={p} onCheck={handleCheckOne} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
