import { Routes, Route, useLocation, Link } from 'react-router-dom';
import AmazonPage from './pages/AmazonPage';
import EbayPage from './pages/EbayPage';

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex lg:hidden">
      <Link
        to="/"
        className={`flex-1 flex flex-col items-center pt-2.5 pb-3 gap-0.5 text-[11px] font-semibold transition-colors ${
          pathname === '/' ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <span className="text-lg leading-none">🛒</span>
        Amazon
      </Link>
      <Link
        to="/ebay"
        className={`flex-1 flex flex-col items-center pt-2.5 pb-3 gap-0.5 text-[11px] font-semibold transition-colors ${
          pathname === '/ebay' ? 'text-[#e53238]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <span className="text-lg leading-none">🏷️</span>
        eBay
      </Link>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-16 lg:pb-0">
        <Routes>
          <Route path="/" element={<AmazonPage />} />
          <Route path="/ebay" element={<EbayPage />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
