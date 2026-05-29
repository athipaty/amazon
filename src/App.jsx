import { Routes, Route } from 'react-router-dom';
import AmazonPage from './pages/AmazonPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<AmazonPage />} />
      </Routes>
    </div>
  );
}
