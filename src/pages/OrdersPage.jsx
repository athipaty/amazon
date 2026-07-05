import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import OrderCard from '../components/OrderCard';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  async function loadOrders() {
    try {
      const { data } = await axios.get(`${API}/api/orders`);
      setOrders(data);
    } finally {
      setLoading(false);
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
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-800">Sold Orders</h1>

      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-2.5 text-sm text-red-700 font-medium">
          {overdueCount > 0 && `🚨 ${overdueCount} order${overdueCount > 1 ? 's' : ''} overdue for tracking`}
          {overdueCount > 0 && dueSoonCount > 0 && ' · '}
          {dueSoonCount > 0 && `⏰ ${dueSoonCount} due within 6h`}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500">No sold orders yet — they'll show up here automatically after a sale (checked every 30 min).</p>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order._id}
            order={order}
            onMarkPurchased={(amazonOrderId) => handleMarkPurchased(order._id, amazonOrderId)}
            onAddTracking={(trackingNumber, carrier) => handleAddTracking(order._id, trackingNumber, carrier)}
            onNotifyBuyer={() => handleNotifyBuyer(order._id)}
            onRemove={() => handleRemove(order._id)}
          />
        ))
      )}
    </div>
  );
}
