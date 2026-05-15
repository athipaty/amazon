import { Routes, Route, NavLink } from 'react-router-dom';
import AmazonPage from './pages/AmazonPage';
import EbayPage from './pages/EbayPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 flex items-center gap-1 h-12">
          <span className="text-sm font-bold text-gray-500 mr-3">Price Tracker</span>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`
            }
          >
            🛒 Amazon
          </NavLink>
          <NavLink
            to="/ebay"
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive ? 'bg-[#e53238] text-white' : 'text-gray-500 hover:text-gray-800'
              }`
            }
          >
            🏷️ eBay
          </NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<AmazonPage />} />
        <Route path="/ebay" element={<EbayPage />} />
      </Routes>
    </div>
  );
}
