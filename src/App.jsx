import { NavLink, useLocation } from 'react-router-dom';
import { Component } from 'react';
import AmazonPage from './pages/AmazonPage';
import DealsPage from './pages/DealsPage';
import OrdersPage from './pages/OrdersPage';
import useProductTracker from './hooks/useProductTracker';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-sm">
          <p className="font-bold text-red-600 mb-2">App Error</p>
          <pre className="text-red-500 whitespace-pre-wrap break-all text-xs bg-red-50 p-3 rounded">
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack?.slice(0, 500)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const location = useLocation();
  const tracker = useProductTracker();
  const tab = location.pathname === '/orders' ? 'orders' : location.pathname === '/deals' ? 'deals' : 'tracker';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 text-slate-900 antialiased pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* All three tabs stay mounted permanently (just hidden) instead of unmounting on
          navigation — switching tabs used to tear down the socket connection and
          re-fetch everything from scratch every time, making it feel like a full reload. */}
      <div style={{ display: tab === 'deals' ? 'block' : 'none' }}>
        <DealsPage tracker={tracker} />
      </div>
      <div style={{ display: tab === 'tracker' ? 'block' : 'none' }}>
        <AmazonPage tracker={tracker} />
      </div>
      <div style={{ display: tab === 'orders' ? 'block' : 'none' }}>
        <OrdersPage />
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-3 bg-white border-t border-slate-200/70 shadow-lift pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/deals"
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          <span className="text-lg leading-none">🏷️</span>
          Deals
        </NavLink>
        <NavLink to="/" end
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          <span className="text-lg leading-none">📦</span>
          Tracker
        </NavLink>
        <NavLink to="/orders"
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          <span className="text-lg leading-none">🧾</span>
          Orders
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
