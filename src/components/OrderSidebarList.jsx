import { useState } from 'react';
import FadeImg from './FadeImg';

const STATUS_DOT = {
  needs_purchase: 'bg-amber-500',
  purchased: 'bg-blue-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-teal-500',
  notified: 'bg-emerald-500',
};

// Grouped by workflow step (not just urgency) so you can see at a glance how many
// orders are stuck at each stage — mirrors the same ShipStatusStepper stages shown
// in OrderCard's detail panel.
const STEPS = [
  { status: 'needs_purchase', label: '💰 Paid', cls: 'text-amber-600' },
  { status: 'purchased', label: '🛒 Purchased', cls: 'text-blue-600' },
  { status: 'shipped', label: '🚚 Shipped', cls: 'text-indigo-600' },
  { status: 'delivered', label: '📬 Delivered', cls: 'text-teal-600' },
  { status: 'notified', label: '✅ Complete', cls: 'text-emerald-600' },
];

export default function OrderSidebarList({ orders, selectedId, onSelect, mobile = false, onRefresh, refreshing = false }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? orders.filter(o => (o.title || o.ebayItemId || '').toLowerCase().includes(search.toLowerCase()))
    : orders;

  const groups = STEPS
    .map(step => ({ label: step.label, cls: step.cls, items: filtered.filter(o => (o.status || 'needs_purchase') === step.status) }))
    .filter(g => g.items.length);

  function renderItem(order) {
    const isSelected = selectedId === order._id;
    return (
      <button
        key={order._id}
        onClick={() => onSelect(order._id)}
        title={order.title || order.ebayItemId}
        className={`flex items-center justify-center p-1.5 rounded-xl transition-colors ${isSelected ? 'bg-blue-50/70 ring-2 ring-blue-500' : 'ring-1 ring-transparent hover:bg-slate-50'}`}
      >
        <div className="relative flex-shrink-0">
          {order.productImage
            ? <FadeImg src={order.productImage} alt="" className="w-16 h-16 object-contain rounded-xl bg-slate-50 border border-slate-100 opacity-60" />
            : <div className="w-16 h-16 rounded-xl bg-slate-100 opacity-60" />
          }
          <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${STATUS_DOT[order.status] || 'bg-slate-300'}`} />
          {order.isOverdue && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-red-600 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white animate-pulse">
              🚨
            </span>
          )}
          {!order.isOverdue && order.hoursLeft != null && order.hoursLeft <= 6 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
              ⏰
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className={mobile
      ? "flex flex-col overflow-hidden bg-white border border-slate-200/70 rounded-2xl shadow-soft"
      : "w-full sm:w-96 md:w-[30rem] lg:w-[36rem] flex-shrink-0 border border-slate-200/70 rounded-2xl overflow-hidden bg-white shadow-soft sticky top-4 max-h-[calc(100vh-120px)] flex flex-col"
    }>
      {/* Header + search */}
      <div className="px-3.5 py-3 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Check for new orders"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white ring-1 ring-inset ring-slate-200 hover:bg-slate-50 rounded-full px-2 py-1 transition-colors disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin' : ''}>↻</span>
              {refreshing ? 'Checking…' : 'Refresh'}
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none">⌕</span>
          <input
            type="text"
            placeholder="Search orders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 bg-white placeholder-slate-400 transition-all"
          />
        </div>
      </div>
      {/* Items — responsive photo grid: more columns as the screen gets wider */}
      <div className={mobile ? "p-2" : "overflow-y-auto flex-1 scrollbar-thin p-2"}>
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No results for &ldquo;{search}&rdquo;</p>
        )}
        {groups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 px-0.5 ${group.cls}`}>
              {group.label} ({group.items.length})
            </p>
            <div className={mobile ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"}>
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
