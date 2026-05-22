import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CONDITIONS = [
  { value: 'NEW',             label: 'New' },
  { value: 'LIKE_NEW',        label: 'Like New' },
  { value: 'USED_VERY_GOOD',  label: 'Used – Very Good' },
  { value: 'USED_GOOD',       label: 'Used – Good' },
  { value: 'USED_ACCEPTABLE', label: 'Used – Acceptable' },
];

const CARRIERS = [
  { value: 'USPSFirstClass',     label: 'USPS First Class' },
  { value: 'USPSPriority',       label: 'USPS Priority Mail' },
  { value: 'USPSGroundAdvantage',label: 'USPS Ground Advantage' },
  { value: 'UPSGround',          label: 'UPS Ground' },
  { value: 'FedExHomeDelivery',  label: 'FedEx Home Delivery' },
];

const HANDLING = [
  { value: 1, label: 'Same day' },
  { value: 1, label: '1 business day' },
  { value: 2, label: '2 business days' },
  { value: 3, label: '3 business days' },
  { value: 5, label: '5 business days' },
];

function Section({ title, children }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#e53238] bg-white';
const selectCls = inputCls;

export default function ListOnEbayModal({ product, onClose }) {
  const defaultMultiplier = 1.45;
  function calcPrice(base, mult) {
    if (!base) return '';
    return Math.floor(base * mult) + 0.99;
  }

  // ── Listing basics ──
  const [title, setTitle]           = useState((product.title || '').slice(0, 80));
  const [multiplier, setMultiplier] = useState(defaultMultiplier);
  const [price, setPrice]           = useState(calcPrice(product.current, defaultMultiplier));
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('NEW');
  const [categoryId, setCategoryId] = useState('');

  // ── Shipping ──
  const [freeShip, setFreeShip]         = useState(true);
  const [shipCost, setShipCost]         = useState('');
  const [carrier, setCarrier]           = useState('USPSFirstClass');
  const [handlingDays, setHandlingDays] = useState(1);

  // ── Returns ──
  const [acceptReturns, setAcceptReturns] = useState(true);
  const [returnDays, setReturnDays]       = useState(30);
  const [buyerPays, setBuyerPays]         = useState(true);

  // ── Location ──
  const [zipCode, setZipCode] = useState('');

  // ── State ──
  const [submitting, setSubmitting]     = useState(false);
  const [titleLoading, setTitleLoading] = useState(true);
  const [catLoading, setCatLoading]     = useState(true);
  const [catName, setCatName]           = useState('');
  const [catPath, setCatPath]           = useState('');
  const [error, setError]               = useState('');
  const [result, setResult]             = useState(null);

  const generateTitle = useCallback(async () => {
    setTitleLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/ebay/seo-title`, {
        title: product.title,
        specs: product.specs || {},
      });
      if (data.title) setTitle(data.title.slice(0, 80));
    } catch { /* keep original title on error */ }
    finally { setTitleLoading(false); }
  }, [product.title, product.specs]);

  useEffect(() => {
    generateTitle();
    // Auto-suggest eBay category
    (async () => {
      setCatLoading(true);
      try {
        const { data } = await axios.get(`${API}/api/ebay/category-suggestions`, {
          params: { q: product.title },
        });
        if (data[0]) {
          setCategoryId(data[0].id);
          setCatName(data[0].name);
          setCatPath(data[0].path || '');
        }
      } catch {}
      finally { setCatLoading(false); }
    })();
  }, [generateTitle, product.title]);

  function handleMultiplier(val) {
    const m = parseFloat(val) || 1;
    setMultiplier(m);
    if (product.current) setPrice(calcPrice(product.current, m));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const asin = (product.url || '').match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
      const rawSku = asin || String(product._id || '');
      const sku = rawSku.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50) || 'ITEM';
      const { data } = await axios.post(`${API}/api/ebay/create-listing`, {
        sku,
        title,
        price:     parseFloat(price),
        currency:  'USD',
        quantity:  parseInt(quantity),
        condition,
        categoryId: categoryId || undefined,
        imageUrl:  product.image || undefined,
        upc:       product.upc   || undefined,
        specs:     product.specs || {},
        zipCode:   zipCode || '10001',
        shipping: {
          free:        freeShip,
          cost:        freeShip ? 0 : parseFloat(shipCost || 0),
          carrier,
          handlingDays: parseInt(handlingDays),
        },
        returns: {
          accepted: acceptReturns,
          days:     parseInt(returnDays),
          buyerPays,
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={onClose}>
      <div
        className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#e53238]">eBay</span>
            <span className="text-base font-bold text-gray-800">— Create Listing</span>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {result ? (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div className="text-5xl">🎉</div>
            <p className="text-green-700 font-bold text-base">Listing live on eBay!</p>
            <p className="text-xs text-gray-400 font-mono">ID: {result.listingId}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="px-6 py-2.5 bg-[#e53238] text-white text-sm font-bold rounded-xl hover:opacity-90">
              View Listing →
            </a>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-5 py-4">

            {/* ── Title ── */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {titleLoading ? 'Generating SEO title…' : `Title (${title.length}/80)`}
                </span>
                {!titleLoading && (
                  <button type="button" onClick={generateTitle}
                    className="text-[10px] text-[#e53238] hover:underline leading-none">
                    ↻ Regenerate
                  </button>
                )}
              </div>
              <div className="relative">
                <input value={title} onChange={e => setTitle(e.target.value.slice(0, 80))}
                  className={`${inputCls} ${titleLoading ? 'opacity-50' : ''}`}
                  disabled={titleLoading} required />
                {titleLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">⏳</span>
                )}
              </div>
            </div>

            {/* ── Condition + Category ── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition">
                <select value={condition} onChange={e => setCondition(e.target.value)} className={selectCls}>
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label={catLoading ? 'Category (detecting…)' : 'eBay Category ID'}>
                <input value={categoryId} onChange={e => { setCategoryId(e.target.value); setCatName(''); setCatPath(''); }}
                  placeholder="e.g. 26395" className={inputCls} />
                {catPath && !catLoading && (
                  <span className="text-[10px] text-blue-500 leading-tight">{catPath}</span>
                )}
              </Field>
            </div>

            {/* ── Pricing ── */}
            <Section title="Price & Quantity">
              <div className="grid grid-cols-3 gap-3">
                <Field label={`Multiplier (Amazon $${product.current})`}>
                  <input type="number" min="1" step="0.01" value={multiplier}
                    onChange={e => handleMultiplier(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Sell Price ($) — xx.99">
                  <input type="number" min="0.01" step="0.01" value={price}
                    onChange={e => setPrice(e.target.value)} className={inputCls} required />
                </Field>
                <Field label="Quantity">
                  <input type="number" min="1" step="1" value={quantity}
                    onChange={e => setQuantity(e.target.value)} className={inputCls} required />
                </Field>
              </div>
            </Section>

            {/* ── Shipping ── */}
            <Section title="Shipping">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={freeShip} onChange={e => setFreeShip(e.target.checked)}
                  className="w-4 h-4 accent-[#e53238]" />
                <span className="text-sm font-medium text-gray-700">Free shipping</span>
              </label>

              {!freeShip && (
                <div className="mb-3">
                  <Field label="Shipping cost ($)">
                    <input type="number" min="0" step="0.01" value={shipCost}
                      onChange={e => setShipCost(e.target.value)} placeholder="e.g. 5.99" className={inputCls} />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Carrier">
                  <select value={carrier} onChange={e => setCarrier(e.target.value)} className={selectCls}>
                    {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Handling time">
                  <select value={handlingDays} onChange={e => setHandlingDays(e.target.value)} className={selectCls}>
                    <option value={0}>Same day</option>
                    <option value={1}>1 business day</option>
                    <option value={2}>2 business days</option>
                    <option value={3}>3 business days</option>
                    <option value={5}>5 business days</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* ── Returns ── */}
            <Section title="Returns">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={acceptReturns} onChange={e => setAcceptReturns(e.target.checked)}
                  className="w-4 h-4 accent-[#e53238]" />
                <span className="text-sm font-medium text-gray-700">Accept returns</span>
              </label>

              {acceptReturns && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Return period">
                    <select value={returnDays} onChange={e => setReturnDays(e.target.value)} className={selectCls}>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </select>
                  </Field>
                  <Field label="Return shipping paid by">
                    <select value={buyerPays ? 'buyer' : 'seller'}
                      onChange={e => setBuyerPays(e.target.value === 'buyer')} className={selectCls}>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </Field>
                </div>
              )}
            </Section>

            {/* ── Location ── */}
            <Section title="Item Location">
              <Field label="ZIP Code (US)">
                <input value={zipCode} onChange={e => setZipCode(e.target.value)}
                  placeholder="e.g. 90210" maxLength={10} className={inputCls} />
              </Field>
              <p className="text-[10px] text-gray-400 mt-1">Used to calculate shipping distance shown to buyers.</p>
            </Section>

            {/* ── Payment note ── */}
            <p className="text-[10px] text-gray-400 -mt-1">
              💳 Payment is handled automatically by eBay Managed Payments.
            </p>

            {error && (
              error === 'not_authenticated'
                ? <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 flex items-center justify-between gap-3">
                    <span>eBay account not connected.</span>
                    <a href={`${API}/api/ebay/auth/login`}
                      className="font-bold underline whitespace-nowrap hover:text-yellow-900">
                      Connect eBay →
                    </a>
                  </div>
                : <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{error}</div>
            )}

            {/* ── Actions ── */}
            <div className="flex gap-2 pb-2 flex-shrink-0">
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 bg-[#e53238] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                {submitting ? 'Creating listing…' : 'List on eBay'}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-3 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
