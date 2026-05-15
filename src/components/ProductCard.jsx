import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function useCountdown(target) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(target) - new Date();
      if (diff <= 0) { setRemaining('soon'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}

export default function ProductCard({ product, onCheck, onDelete }) {
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();
  const { _id, title, url, currency, current, lowest, history } = product;

  const countdown = useCountdown(product.nextCheck);
  const isAtLowest = current <= lowest;
  const firstPrice = history?.[0]?.price;
  const hasDrop = firstPrice && current < firstPrice;
  const dropPct = hasDrop ? Math.round(((firstPrice - current) / firstPrice) * 100) : 0;

  return (
    <div className={`bg-white rounded-xl p-5 relative flex flex-col gap-2 border transition-shadow hover:shadow-md ${isAtLowest ? 'border-green-400' : 'border-gray-200'}`}>

      <button
        onClick={() => onDelete(_id)}
        title="Stop tracking"
        className="absolute top-3 right-3 text-gray-300 text-sm px-1.5 py-0.5 rounded hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        ✕
      </button>

      {product.image && (
        <img
          src={product.image}
          alt={title}
          className="w-full h-36 object-contain rounded-lg bg-gray-50"
        />
      )}

      <h3
        className="text-sm font-medium text-gray-700 pr-6 leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        title={title}
      >
        {title}
      </h3>

      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-3xl font-black tracking-tight ${isAtLowest ? 'text-green-700' : 'text-gray-900'}`}>
          {currency}{current.toLocaleString()}
        </span>
        {hasDrop && (
          <span className="bg-green-50 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
            ▼ {dropPct}% off
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {isAtLowest ? '✅ Lowest price ever' : `Lowest ever: ${currency}${lowest.toLocaleString()}`}
      </p>

      {product.nextCheck && (
        <p className="text-xs text-gray-300">
          Next check in: <span className="font-mono">{countdown}</span>
        </p>
      )}

      <div className="flex items-center justify-between mt-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline"
        >
          View on Amazon →
        </a>
        <button
          onClick={async () => {
            setChecking(true);
            await onCheck(_id);
            setChecking(false);
          }}
          disabled={checking}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
          title="Check price now"
        >
          {checking ? '⏳' : '🔄'}
        </button>
      </div>

      {product.upc && (
        <button
          onClick={() => navigate(`/ebay?upc=${product.upc}&title=${encodeURIComponent(title)}`)}
          className="w-full mt-1 py-1.5 text-xs font-semibold text-[#e53238] border border-[#e53238] rounded-lg hover:bg-red-50 transition-colors"
        >
          🏷️ Find on eBay (exact match)
        </button>
      )}
    </div>
  );
}
