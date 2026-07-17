import { useState, useEffect } from 'react';
import OrderCard from './OrderCard';
import OrderSidebarList from './OrderSidebarList';

// Master-detail UI for orders (sidebar photo grid + detail panel, full-screen sheet on
// mobile) — mirrors ProductListDetail's layout so Orders reads as the same app as
// Tracker/Deals instead of a bolted-on list.
export default function OrderListDetail({
  orders, emptyState,
  onMarkPurchased, onAddTracking, onMarkDelivered, onUndoDelivered, onNotifyBuyer, onRemove,
  onRefresh, refreshing,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = detailOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [detailOpen]);

  // Auto-select first order; reset stale selection after removals
  const selectedOrder = orders.find(o => o._id === selectedId) || orders[0] || null;
  useEffect(() => {
    if (selectedId && orders.length && !orders.some(o => o._id === selectedId)) {
      setSelectedId(orders[0] ? orders[0]._id : null);
    }
  }, [orders.map(o => o._id).join(',')]);

  if (orders.length === 0) return emptyState;

  function renderCard(order) {
    return (
      <OrderCard
        key={order._id}
        order={order}
        onMarkPurchased={(amazonOrderId) => onMarkPurchased(order._id, amazonOrderId)}
        onAddTracking={(trackingNumber, carrier) => onAddTracking(order._id, trackingNumber, carrier)}
        onMarkDelivered={() => onMarkDelivered(order._id)}
        onUndoDelivered={() => onUndoDelivered(order._id)}
        onNotifyBuyer={() => onNotifyBuyer(order._id)}
        onRemove={() => onRemove(order._id)}
      />
    );
  }

  return (
    <>
      {/* ── Mobile: compact list ── */}
      <div className="flex lg:hidden flex-col">
        <OrderSidebarList
          mobile
          orders={orders}
          selectedId={selectedId || (orders[0] ? orders[0]._id : null)}
          onSelect={(id) => { setSelectedId(id); setDetailOpen(true); }}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      </div>

      {/* ── Desktop: master-detail ── */}
      <div className="hidden lg:flex gap-4 items-start">
        <OrderSidebarList
          orders={orders}
          selectedId={selectedId || orders[0]._id}
          onSelect={setSelectedId}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
        <div className="flex-1 min-w-0">
          {selectedOrder && renderCard(selectedOrder)}
        </div>
      </div>

      {/* ── Mobile detail sheet ── */}
      {detailOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-slide-in-right">
          <div className="flex items-center gap-3 px-3 py-3 bg-white/90 backdrop-blur-sm border-b border-slate-100 flex-shrink-0 shadow-soft">
            <button
              onClick={() => setDetailOpen(false)}
              className="flex items-center justify-center gap-1 w-9 h-9 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0 text-base"
              aria-label="Back to orders"
            >
              ‹
            </button>
            <p className="flex-1 text-sm font-semibold text-slate-700 truncate min-w-0">
              {selectedOrder && (selectedOrder.title || selectedOrder.ebayItemId)}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 pb-8">
            {selectedOrder && renderCard(selectedOrder)}
          </div>
        </div>
      )}
    </>
  );
}
