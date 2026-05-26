import { Routes, Route, NavLink } from 'react-router-dom';
import AmazonPage from './pages/AmazonPage';
import EbayPage from './pages/EbayPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top nav — desktop only */}
      <nav className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 flex items-center gap-1 h-12">
          <span className="text-sm font-bold text-gray-500 mr-3">Price Tracker</span>
          <NavLink to="/" end className={({ isActive }) =>
            `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-gray-800'}`
          }>
            🛒 Amazon
          </NavLink>
          <NavLink to="/ebay" className={({ isActive }) =>
            `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-[#e53238] text-white' : 'text-gray-500 hover:text-gray-800'}`
          }>
            🏷️ eBay
          </NavLink>
        </div>
      </nav>

      {/* Page content — extra bottom padding on mobile for the bottom nav */}
      <div className="pb-20 md:pb-0">
        <Routes>
          <Route path="/" element={<AmazonPage />} />
          <Route path="/ebay" element={<EbayPage />} />
        </Routes>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink to="/" end className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${isActive ? 'text-yellow-500' : 'text-gray-400'}`
        }>
          <span className="text-2xl leading-none">🛒</span>
          Amazon
        </NavLink>
        <NavLink to="/ebay" className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${isActive ? 'text-[#e53238]' : 'text-gray-400'}`
        }>
          <span className="text-2xl leading-none">🏷️</span>
          eBay
        </NavLink>
      </nav>

    </div>
  );
}
