import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import OrderListDetail from '../components/OrderListDetail';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef(null);

  async function loadOrders() {
    try {
      const { data } = await axios.get(`${API}/api/orders`);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();

    socketRef.current = io(API);
    const socket = socketRef.current;
    socket.on('tracker:order:new', ({ order }) => {
      setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev]);
    });

    const poll = setInterval(loadOrders, 30000);
    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  function patchOrder(updated) {
    setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
  }

  async function handleMarkPurchased(orderId, amazonOrderId) {
    const { data } = await axios.patch(`${API}/api/orders/${orderId}/purchased`, { amazonOrderId });
    patchOrder(data);
  }

  async function handleAddTracking(orderId, trackingNumber, carrier) {
    try {
      const { data } = await axios.patch(`${API}/api/orders/${orderId}/tracking`, { trackingNumber, carrier });
      patchOrder(data);
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message);
    }
  }

  async function handleMarkDelivered(orderId) {
    const { data } = await axios.patch(`${API}/api/orders/${orderId}/delivered`);
    patchOrder(data);
  }

  async function handleUndoDelivered(orderId) {
    const { data } = await axios.patch(`${API}/api/orders/${orderId}/undo-delivered`);
    patchOrder(data);
  }

  async function handleNotifyBuyer(orderId) {
    try {
      const { data } = await axios.post(`${API}/api/orders/${orderId}/notify-buyer`);
      patchOrder(data.order);
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message);
    }
  }

  async function handleRemove(orderId) {
    await axios.delete(`${API}/api/orders/${orderId}`);
    setOrders(prev => prev.filter(o => o._id !== orderId));
  }

  const overdueCount = orders.filter(o => o.isOverdue).length;
  const dueSoonCount = orders.filter(o => !o.isOverdue && o.hoursLeft != null && o.hoursLeft <= 6).length;

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-red-700 shadow-soft">
          <span className="flex-shrink-0">⚠️</span>
          {overdueCount > 0 && `${overdueCount} order${overdueCount > 1 ? 's' : ''} overdue for tracking`}
          {overdueCount > 0 && dueSoonCount > 0 && ' · '}
          {dueSoonCount > 0 && `⏰ ${dueSoonCount} due within 6h`}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <OrderListDetail
          orders={orders}
          emptyState={
            <div className="text-center mt-16 md:mt-24">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-soft border border-slate-100 text-3xl mb-4">🧾</div>
              <p className="text-base font-bold text-slate-700">No sold orders yet</p>
              <p className="text-sm mt-1 text-slate-400 mb-4">They'll show up here automatically after a sale, or check now.</p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-soft"
              >
                <span className={refreshing ? 'animate-spin' : ''}>↻</span>
                {refreshing ? 'Checking…' : 'Check for new orders'}
              </button>
            </div>
          }
          onMarkPurchased={handleMarkPurchased}
          onAddTracking={handleAddTracking}
          onMarkDelivered={handleMarkDelivered}
          onUndoDelivered={handleUndoDelivered}
          onNotifyBuyer={handleNotifyBuyer}
          onRemove={handleRemove}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
    </div>
  );
}
