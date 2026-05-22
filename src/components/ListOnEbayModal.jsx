import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'VERY_GOOD', label: 'Very Good' },
  { value: 'GOOD', label: 'Good' },
  { value: 'ACCEPTABLE', label: 'Acceptable' },
];

export default function ListOnEbayModal({ product, onClose }) {
  const [accountInfo, setAccountInfo] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [notAuthenticated, setNotAuthenticated] = useState(false);

  const defaultMarkup = 30;
  const defaultPrice = product.current
    ? Math.ceil(product.current * (1 + defaultMarkup / 100) * 100) / 100
    : '';

  const [title, setTitle] = useState((product.title || '').slice(0, 80));
  const [markup, setMarkup] = useState(defaultMarkup);
  const [price, setPrice] = useState(defaultPrice);
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('NEW');
  const [categoryId, setCategoryId] = useState('');
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState('');
  const [returnPolicyId, setReturnPolicyId] = useState('');
  const [paymentPolicyId, setPaymentPolicyId] = useState('');
  const [merchantLocationKey, setMerchantLocationKey] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/ebay/account-info`)
      .then(({ data }) => {
        setAccountInfo(data);
        if (data.fulfillmentPolicies?.[0]) setFulfillmentPolicyId(data.fulfillmentPolicies[0].fulfillmentPolicyId);
        if (data.returnPolicies?.[0])      setReturnPolicyId(data.returnPolicies[0].returnPolicyId);
        if (data.paymentPolicies?.[0])     setPaymentPolicyId(data.paymentPolicies[0].paymentPolicyId);
        if (data.locations?.[0])           setMerchantLocationKey(data.locations[0].merchantLocationKey);
      })
      .catch(err => {
        if (err.response?.status === 401) setNotAuthenticated(true);
      })
      .finally(() => setLoadingAccount(false));
  }, []);

  function handleMarkupChange(val) {
    const m = parseFloat(val) || 0;
    setMarkup(m);
    if (product.current) {
      setPrice(Math.ceil(product.current * (1 + m / 100) * 100) / 100);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/api/ebay/create-listing`, {
        sku: product.specs?.asin || product._id,
        title,
        price: parseFloat(price),
        currency: 'USD',
        quantity: parseInt(quantity),
        condition,
        categoryId: categoryId || undefined,
        fulfillmentPolicyId,
        returnPolicyId,
        paymentPolicyId,
        merchantLocationKey,
        imageUrl: product.image || undefined,
        upc: product.upc || undefined,
        specs: product.specs || {},
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-300 hover:text-gray-600 text-xl leading-none">×</button>

        <h2 className="text-base font-bold text-gray-900 mb-4">List on eBay</h2>

        {loadingAccount && (
          <p className="text-sm text-gray-400">Loading your eBay account…</p>
        )}

        {!loadingAccount && notAuthenticated && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 mb-3">Connect your eBay seller account first.</p>
            <a
              href={`${API}/api/ebay/auth/login`}
              className="px-5 py-2 bg-[#e53238] text-white text-sm font-bold rounded-lg hover:opacity-90"
            >
              Connect eBay Account
            </a>
          </div>
        )}

        {!loadingAccount && !notAuthenticated && !result && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* Title */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">
                Title <span className="normal-case text-gray-300">({title.length}/80)</span>
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 80))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400"
                required
              />
            </div>

            {/* Price + Markup */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">
                  Markup % <span className="normal-case text-gray-300">(Amazon: ${product.current})</span>
                </label>
                <input
                  type="number" min="0" step="1" value={markup}
                  onChange={e => handleMarkupChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Selling Price ($)</label>
                <input
                  type="number" min="0.01" step="0.01" value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400"
                  required
                />
              </div>
            </div>

            {/* Quantity + Condition */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Quantity</label>
                <input
                  type="number" min="1" step="1" value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Condition</label>
                <select
                  value={condition} onChange={e => setCondition(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400 bg-white"
                >
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Category ID */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">
                eBay Category ID <span className="normal-case text-gray-300">(optional — eBay will auto-assign if blank)</span>
              </label>
              <input
                value={categoryId} onChange={e => setCategoryId(e.target.value)}
                placeholder="e.g. 26395"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
            </div>

            {/* Policies */}
            {accountInfo && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Shipping Policy</label>
                  <select value={fulfillmentPolicyId} onChange={e => setFulfillmentPolicyId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-yellow-400 bg-white" required>
                    {accountInfo.fulfillmentPolicies.map(p => (
                      <option key={p.fulfillmentPolicyId} value={p.fulfillmentPolicyId}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Return Policy</label>
                  <select value={returnPolicyId} onChange={e => setReturnPolicyId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-yellow-400 bg-white" required>
                    {accountInfo.returnPolicies.map(p => (
                      <option key={p.returnPolicyId} value={p.returnPolicyId}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Payment Policy</label>
                  <select value={paymentPolicyId} onChange={e => setPaymentPolicyId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-yellow-400 bg-white" required>
                    {accountInfo.paymentPolicies.map(p => (
                      <option key={p.paymentPolicyId} value={p.paymentPolicyId}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">Ship-from Location</label>
                  <select value={merchantLocationKey} onChange={e => setMerchantLocationKey(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-yellow-400 bg-white" required>
                    {accountInfo.locations.map(l => (
                      <option key={l.merchantLocationKey} value={l.merchantLocationKey}>{l.name || l.merchantLocationKey}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <div className="flex gap-2 mt-1">
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 bg-[#e53238] text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Creating…' : 'Create eBay Listing'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="text-center py-4">
            <p className="text-green-600 font-bold text-sm mb-1">Listing created!</p>
            <p className="text-xs text-gray-500 mb-4">Listing ID: {result.listingId}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2 bg-[#e53238] text-white text-sm font-bold rounded-lg hover:opacity-90">
              View on eBay →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
