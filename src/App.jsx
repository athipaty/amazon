import { Routes, Route, NavLink } from 'react-router-dom';
import { Component } from 'react';
import AmazonPage from './pages/AmazonPage';
import OrdersPage from './pages/OrdersPage';

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

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 text-slate-900 antialiased">
        <nav className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200/70">
          <NavLink to="/" end
            className={({ isActive }) => `text-sm font-semibold px-3 py-1.5 rounded-full transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Tracker
          </NavLink>
          <NavLink to="/orders"
            className={({ isActive }) => `text-sm font-semibold px-3 py-1.5 rounded-full transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Orders
          </NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<AmazonPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
