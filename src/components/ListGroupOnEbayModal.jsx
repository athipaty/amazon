import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CONDITIONS = [
  { value: 'NEW',       label: 'New' },
  { value: 'LIKE_NEW',  label: 'Like New' },
  { value: 'VERY_GOOD', label: 'Very Good' },
  { value: 'GOOD',      label: 'Good' },
  { value: 'ACCEPTABLE',label: 'Acceptable' },
];

const CARRIERS = [
  { value: 'USPSFirstClass',      label: 'USPS First Class' },
  { value: 'USPSPriority',        label: 'USPS Priority Mail' },
  { value: 'USPSGroundAdvantage', label: 'USPS Ground Advantage' },
  { value: 'UPSGround',           label: 'UPS Ground' },
  { value: 'FedExHomeDelivery',   label: 'FedEx Home Delivery' },
];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#e53238] bg-white';
const selectCls = inputCls;

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function ListGroupOnEbayModal({ variants, onClose }) {
  const firstVariant = variants[0];
  const minPrice = Math.min(...variants.map(v => v.current).filter(Boolean));

  const defaultMultiplier = 1.45;
  function calcPrice(base, mult) { return Math.floor(base * mult) + 0.99; }

  const [title, setTitle]               = useState((firstVariant.title || '').slice(0, 80));
  const [titleLoading, setTitleLoading] = useState(true);
  const [multiplier, setMultiplier]     = useState(defaultMultiplier);
  const [price, setPrice]               = useState(calcPrice(minPrice, defaultMultiplier));

  function handleMultiplier(val) {
    const m = parseFloat(val) || 1;
    setMultiplier(m);
    setPrice(calcPrice(minPrice, m));
  }
  const [condition, setCondition]   = useState('NEW');
  const [categoryId, setCategoryId] = useState('');

  // Per-variant quantities
  const [quantities, setQuantities] = useState(
    Object.fromEntries(variants.map(v => [v._id, 1]))
  );

  const [freeShip, setFreeShip]         = useState(true);
  const [shipCost, setShipCost]         = useState('');
  const [carrier, setCarrier]           = useState('USPSFirstClass');
  const [handlingDays, setHandlingDays] = useState(1);

  const [acceptReturns, setAcceptReturns] = useState(true);
  const [returnDays, setReturnDays]       = useState(30);
  const [buyerPays, setBuyerPays]         = useState(true);

  const [zipCode, setZipCode]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [result, setResult]         = useState(null);

  const generateTitle = useCallback(async () => {
    setTitleLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/ebay/seo-title`, {
        title: firstVariant.title,
        specs: firstVariant.specs || {},
      });
      if (data.title) setTitle(data.title.slice(0, 80));
    } catch {}
    finally { setTitleLoading(false); }
  }, [firstVariant.title, firstVariant.specs]);

  useEffect(() => { generateTitle(); }, [generateTitle]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const groupKey = firstVariant.groupId || firstVariant.specs?.asin || firstVariant._id;
      const variantPayload = variants.map(v => ({
        sku: v.specs?.asin || v._id,
        label: v.variant || v.title.slice(0, 30),
        image: v.image || undefined,
        quantity: parseInt(quantities[v._id]) || 1,
      }));

      const { data } = await axios.post(`${API}/api/ebay/create-group-listing`, {
        groupKey,
        title,
        price: parseFloat(price),
        currency: firstVariant.currency === '$' ? 'USD' : firstVariant.currency === '£' ? 'GBP' : 'USD',
        condition,
        categoryId: categoryId || undefined,
        variants: variantPayload,
        specs: firstVariant.specs || {},
        zipCode: zipCode || '10001',
        shipping: {
          free: freeShip,
          cost: freeShip ? 0 : parseFloat(shipCost || 0),
          carrier,
          handlingDays: parseInt(handlingDays),
        },
        returns: {
          accepted: acceptReturns,
          days: parseInt(returnDays),
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
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#e53238]">eBay</span>
            <span className="text-base font-bold text-gray-800">— List Group ({variants.length} variants)</span>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {result ? (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div className="text-5xl">🎉</div>
            <p className="text-green-700 font-bold text-base">Group listing live on eBay!</p>
            <p className="text-xs text-gray-400 font-mono">ID: {result.listingId}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="px-6 py-2.5 bg-[#e53238] text-white text-sm font-bold rounded-xl hover:opacity-90">
              View Listing →
            </a>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-5 py-4">

            {/* Title */}
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

            {/* Condition + Category */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition">
                <select value={condition} onChange={e => setCondition(e.target.value)} className={selectCls}>
                  {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="eBay Category ID (optional)">
                <input value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  placeholder="e.g. 26395" className={inputCls} />
              </Field>
            </div>

            {/* Variants table */}
            <Section title="Variants & Quantity">
              <div className="flex flex-col gap-2">
                {variants.map(v => (
                  <div key={v._id} className="flex items-center gap-3">
                    {v.image && (
                      <img src={v.image} alt={v.variant} className="w-9 h-9 object-contain rounded bg-gray-50 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-700 flex-1 min-w-0 truncate" title={v.variant}>
                      {v.variant || v.title.slice(0, 40)}
                    </span>
                    <span className="text-xs font-mono text-gray-500 flex-shrink-0 w-14 text-right">
                      ${v.current?.toLocaleString()}
                    </span>
                    <input
                      type="number" min="1" step="1"
                      value={quantities[v._id]}
                      onChange={e => setQuantities(q => ({ ...q, [v._id]: e.target.value }))}
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-[#e53238]"
                      title="Quantity"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">All variants share the same listing price below.</p>
            </Section>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Multiplier (lowest Amazon $${minPrice})`}>
                <input type="number" min="1" step="0.01" value={multiplier}
                  onChange={e => handleMultiplier(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sell Price ($) — xx.99, all variants">
                <input type="number" min="0.01" step="0.01" value={price}
                  onChange={e => setPrice(e.target.value)} className={inputCls} required />
              </Field>
            </div>

            {/* Shipping */}
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

            {/* Returns */}
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

            {/* Location */}
            <Section title="Item Location">
              <Field label="ZIP Code (US)">
                <input value={zipCode} onChange={e => setZipCode(e.target.value)}
                  placeholder="e.g. 90210" maxLength={10} className={inputCls} />
              </Field>
            </Section>

            <p className="text-[10px] text-gray-400 -mt-1">
              💳 Payment is handled automatically by eBay Managed Payments.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{error}</div>
            )}

            <div className="flex gap-2 pb-2 flex-shrink-0">
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 bg-[#e53238] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                {submitting ? 'Creating listing…' : 'List Group on eBay'}
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
