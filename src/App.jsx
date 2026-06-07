import { Routes, Route } from 'react-router-dom';
import { Component } from 'react';
import AmazonPage from './pages/AmazonPage';

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
        <Routes>
          <Route path="/" element={<AmazonPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
