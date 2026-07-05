import { useState, useEffect } from 'react';
import FadeImg from './FadeImg';
import Countdown from './Countdown';

const STATUS_STYLES = {
  needs_purchase: { label: 'Needs purchase', cls: 'text-amber-600' },
  purchased:      { label: 'Purchased',       cls: 'text-blue-600' },
  shipped:        { label: 'Shipped',         cls: 'text-indigo-600' },
  notified:       { label: 'Buyer notified',  cls: 'text-emerald-600' },
};

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other'];

// Maps order.status onto the buyer-facing shipping stages we can actually vouch for
// from our own data — no carrier tracking API involved. "Delivered" reflects the
// existing Notify-Buyer flow, which already assumes delivery was confirmed before
// clicking it (see the message text in onNotifyBuyer).
const SHIP_STAGES = ['Paid', 'Shipped', 'Delivered'];
function shipStageIndex(status) {
  if (status === 'notified') return 2;
  if (status === 'shipped') return 1;
  return 0;
}

function ShipStatusStepper({ status }) {
  const current = shipStageIndex(status);
  return (
    <div className="flex items-center gap-1 mt-1">
      {SHIP_STAGES.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i <= current ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          <span className={`text-[10px] font-medium whitespace-nowrap ${i <= current ? 'text-indigo-600' : 'text-slate-300'}`}>
            {label}
          </span>
          {i < SHIP_STAGES.length - 1 && (
            <span className={`h-px w-3 ${i < current ? 'bg-indigo-400' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const US_STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

function expandState(s) {
  if (!s) return s;
  return US_STATE_NAMES[s.trim().toUpperCase()] || s;
}

const COUNTRY_NAMES = { US: 'United States', CA: 'Canada', GB: 'United Kingdom', UK: 'United Kingdom', AU: 'Australia' };

function expandCountry(c) {
  if (!c) return c;
  return COUNTRY_NAMES[c.trim().toUpperCase()] || c;
}

// Counts up from a past deadline — how long an order has been overdue. Separate from
// Countdown (which counts down and stops at "soon"), since overdue needs to keep
// climbing so the badge conveys how bad it's gotten, not just that it's passed.
function OverdueTimer({ target }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    function update() {
      const diff = Date.now() - new Date(target).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [target]);
  return elapsed || '…';
}

// Shows how much time is left before eBay's 24h shipping-tracking deadline, or how
// overdue it already is. Hidden once tracking is added — no more urgency at that point.
function ShipDeadlineBadge({ order }) {
  if (order.trackingNumber || order.hoursLeft == null) return null;

  if (order.isOverdue) {
    return (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white whitespace-nowrap animate-pulse">
        🚨 OVERDUE <OverdueTimer target={order.shipDeadline} />
      </span>
    );
  }

  const urgent = order.hoursLeft <= 6;
  const warn = order.hoursLeft <= 12;
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
        urgent ? 'bg-red-100 text-red-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      ⏱ เหลือ <Countdown target={order.shipDeadline} />
    </span>
  );
}

// Each entry is a group of pieces shown on one visual line, wrapped together —
// but each piece stays its own click-to-copy chip.
function addressGroups(a) {
  if (!a) return [];
  const phone = a.phone && a.phone !== 'Invalid Request' ? a.phone : null;
  const groups = [
    [expandCountry(a.country)],
    [a.name],
    [phone],
    [a.street1],
    [a.street2],
    [a.cityName, expandState(a.stateOrProvince), a.postalCode],
  ].map(g => g.filter(Boolean));
  return groups.filter(g => g.length);
}

export default function OrderCard({ order, onMarkPurchased, onAddTracking, onNotifyBuyer, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [copiedLines, setCopiedLines] = useState(new Set());
  const [amazonOrderId, setAmazonOrderId] = useState(order.amazonOrderId || '');
  const [editingPurchase, setEditingPurchase] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [carrier, setCarrier] = useState(order.carrier || CARRIERS[0]);
  const [editingTracking, setEditingTracking] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null); // { sent, messageText }
  const [messageCopied, setMessageCopied] = useState(false);
  const [notifyError, setNotifyError] = useState('');

  const status = STATUS_STYLES[order.status] || STATUS_STYLES.needs_purchase;

  const groups = addressGroups(order.shippingAddress);

  function copyAddress() {
    navigator.clipboard.writeText(groups.map(g => g.join(', ')).join('\n')).then(() => {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    });
  }

  function copyLine(idx, text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLines(prev => new Set(prev).add(idx));
      setTimeout(() => setCopiedLines(prev => { const next = new Set(prev); next.delete(idx); return next; }), 2000);
    });
  }

  async function submitPurchase() {
    if (!amazonOrderId.trim()) return;
    setSavingPurchase(true);
    try {
      await onMarkPurchased(amazonOrderId.trim());
      setEditingPurchase(false);
    } finally {
      setSavingPurchase(false);
    }
  }

  async function submitTracking() {
    if (!trackingNumber.trim()) return;
    setSavingTracking(true);
    setTrackingError('');
    try {
      await onAddTracking(trackingNumber.trim(), carrier);
      setEditingTracking(false);
    } catch (e) {
      setTrackingError(e.message || 'Failed to push tracking to eBay');
    } finally {
      setSavingTracking(false);
    }
  }

  async function handleNotify() {
    setNotifying(true);
    setNotifyError('');
    try {
      const result = await onNotifyBuyer();
      setNotifyResult(result);
    } catch (e) {
      setNotifyError(e.message || 'Failed to create message');
    } finally {
      setNotifying(false);
    }
  }

  function copyMessage() {
    navigator.clipboard.writeText(notifyResult?.messageText || order.buyerMessageText || '').then(() => {
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    });
  }

  async function confirmRemove() {
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
    }
  }

  const cardTone = order.isOverdue
    ? 'border-red-300 bg-red-50/40'
    : order.hoursLeft != null && order.hoursLeft <= 12
    ? 'border-amber-300 bg-amber-50/30'
    : 'border-slate-200/70 bg-white';

  return (
    <div className={`rounded-2xl border shadow-card p-4 md:p-5 flex flex-col gap-3 transition-colors ${cardTone}`}>
      <button onClick={() => setExpanded(e => !e)} className="flex items-start justify-between gap-2 text-left w-full">
        <div className="flex items-start gap-3 min-w-0">
          {order.productImage && (
            <FadeImg src={order.productImage} alt="" className="w-12 h-12 rounded-lg object-cover ring-1 ring-slate-200 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{order.title || order.ebayItemId}</p>
            <p className="text-xs text-slate-500">
              {order.variationValue ? `${order.variationValue} · ` : ''}Qty {order.quantity} · ${order.price?.toFixed?.(2) ?? order.price}
              {order.createTimeEbay ? ` · ${new Date(order.createTimeEbay).toLocaleDateString()}` : ''}
            </p>
            <ShipStatusStepper status={order.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShipDeadlineBadge order={order} />
          <span className={`text-[11px] font-semibold whitespace-nowrap ${status.cls}`}>
            {status.label}
          </span>
          <span className={`text-xs transition-colors duration-200 ${expanded ? 'text-indigo-600' : 'text-slate-300'}`}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
      <>
      {/* Shipping address — click any piece to copy just that piece */}
      <div className="flex items-start justify-between gap-2 bg-slate-50 rounded-xl px-3.5 py-2.5">
        {groups.length ? (
          <div className="flex flex-col gap-1 min-w-0">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="flex flex-wrap items-center gap-1">
                {group.map((piece, pIdx) => {
                  const idx = `${gIdx}-${pIdx}`;
                  return (
                    <button key={idx} onClick={() => copyLine(idx, piece)} title="Click to copy this piece"
                      className={`text-left text-xs px-2.5 py-1 rounded-lg transition-colors ${copiedLines.has(idx) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-600 hover:bg-amber-100 ring-1 ring-inset ring-slate-200'}`}>
                      {piece}{copiedLines.has(idx) ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No address captured</p>
        )}
        <button onClick={copyAddress}
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap">
          {addressCopied ? '✓ Copied!' : '📋 Copy All'}
        </button>
      </div>

      {/* Mark purchased */}
      <div className="flex items-center gap-2 flex-wrap">
        {order.amazonUrl && (
          <a href={order.amazonUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
            Amazon ↗
          </a>
        )}
        {editingPurchase ? (
          <>
            <input value={amazonOrderId} onChange={e => setAmazonOrderId(e.target.value)}
              placeholder="Amazon order ID"
              className="text-xs px-3 py-1.5 rounded-full ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-amazon flex-1 min-w-[160px]" />
            <button onClick={submitPurchase} disabled={savingPurchase}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-amazon text-white hover:bg-amazon-dark transition-colors disabled:opacity-50">
              {savingPurchase ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditingPurchase(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </>
        ) : (
          <button onClick={() => setEditingPurchase(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors">
            {order.amazonOrderId ? `📦 Amazon: ${order.amazonOrderId}` : '📦 Mark Purchased'}
          </button>
        )}
        {order.amazonOrderId && (
          <a href={`https://www.amazon.com/gp/your-account/order-details?orderID=${encodeURIComponent(order.amazonOrderId)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-amazon-dark ring-1 ring-inset ring-orange-200 hover:bg-orange-100 transition-colors whitespace-nowrap">
            🚚 Track on Amazon ↗
          </a>
        )}
      </div>

      {/* Tracking */}
      <div className="flex items-center gap-2 flex-wrap">
        {editingTracking ? (
          <>
            <select value={carrier} onChange={e => setCarrier(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-full ring-1 ring-inset ring-slate-200 focus:outline-none">
              {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Tracking number"
              className="text-xs px-3 py-1.5 rounded-full ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-ebay flex-1 min-w-[160px]" />
            <button onClick={submitTracking} disabled={savingTracking}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-ebay text-white hover:bg-ebay-dark transition-colors disabled:opacity-50">
              {savingTracking ? 'Pushing…' : 'Push to eBay'}
            </button>
            <button onClick={() => setEditingTracking(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </>
        ) : (
          <button onClick={() => setEditingTracking(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-ebay ring-1 ring-inset ring-red-200 hover:bg-red-100 transition-colors">
            {order.trackingNumber ? `🚚 ${order.carrier} ${order.trackingNumber}` : '🚚 Add Tracking'}
          </button>
        )}
        {trackingError && <span className="text-[11px] text-red-500">⚠ {trackingError}</span>}
      </div>

      {/* Notify buyer — generates a thank-you message for you to copy into eBay.
          Gated on having a real tracking number so we never imply "delivered"
          before the order has actually shipped. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleNotify} disabled={notifying || !order.trackingNumber}
          title={!order.trackingNumber ? 'Add a tracking number first' : undefined}
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-50">
          {notifying ? 'Creating…' : order.buyerMessageSent ? '✓ Message Ready' : '✉️ Notify Buyer'}
        </button>
        {order.ebayOrderId && (
          <a href={`https://www.ebay.com/sh/ord/details?orderid=${encodeURIComponent(order.ebayOrderId)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-ebay ring-1 ring-inset ring-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
            💬 Message Buyer on eBay ↗
          </a>
        )}
        {!order.trackingNumber && (
          <span className="text-[11px] text-slate-400">Add tracking before notifying the buyer</span>
        )}
        {notifyError && <span className="text-[11px] text-red-500">⚠ {notifyError}</span>}
      </div>

      {/* Remove — for orders you've already fully handled */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
        {confirmingRemove ? (
          <>
            <span className="text-[11px] text-slate-500">Remove this order from the list?</span>
            <button onClick={confirmRemove} disabled={removing}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
              {removing ? 'Removing…' : 'Yes'}
            </button>
            <button onClick={() => setConfirmingRemove(false)} className="text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmingRemove(true)}
            className="text-[11px] text-slate-400 hover:text-red-500 transition-colors mt-1">
            🗑️ Remove
          </button>
        )}
      </div>

      {(notifyResult?.messageText || order.buyerMessageText) && (
        <div className="flex items-start justify-between gap-2 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-xl px-3.5 py-2.5">
          <div>
            <p className="text-xs text-emerald-700 font-semibold mb-1">Copy this and paste into eBay's message center:</p>
            <p className="text-xs text-emerald-700 whitespace-pre-wrap">{notifyResult?.messageText || order.buyerMessageText}</p>
          </div>
          <button onClick={copyMessage}
            className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap">
            {messageCopied ? '✓ Copied!' : '📋 Copy Message'}
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
