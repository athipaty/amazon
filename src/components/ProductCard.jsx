import { useState, useEffect } from 'react';

function useCountdown(target) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(target) - new Date();
      if (diff <= 0) { setRemaining('soon'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}

export default function ProductCard({ product, onCheck, onDelete }) {
  const [checking, setChecking] = useState(false);
  const { _id, title, url, currency, current, lowest, history } = product;

  const countdown = useCountdown(product.nextCheck);
  const isAtLowest = current <= lowest;
  const firstPrice = history?.[0]?.price;
  const hasDrop = firstPrice && current < firstPrice;
  const dropPct = hasDrop ? Math.round(((firstPrice - current) / firstPrice) * 100) : 0;

  return (
    <div className={`bg-white rounded-xl px-4 py-3 flex items-center gap-4 border transition-shadow hover:shadow-sm ${isAtLowest ? 'border-green-400' : 'border-gray-200'}`}>

      {product.image ? (
        <img src={product.image} alt={title} className="w-12 h-12 object-contain rounded-lg bg-gray-50 flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
      )}

      <div className="w-32 flex-shrink-0 flex flex-col gap-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" title={title}>{title}</p>
        <div className="flex items-center gap-1">
          {product.isPrime && (
            <span className="text-[10px] font-extrabold italic tracking-wide text-white bg-[#00A8E0] px-1.5 py-0.5 rounded leading-none">
              prime
            </span>
          )}
          {product.color && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
              {product.color}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2 flex-shrink-0">
        <span className={`text-xl font-black tracking-tight ${isAtLowest ? 'text-green-700' : 'text-gray-900'}`}>
          {currency}{current.toLocaleString()}
        </span>
        {hasDrop && (
          <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
            ▼{dropPct}%
          </span>
        )}
      </div>

      {history?.length > 0 && (
        <div className="flex gap-4 flex-shrink-0 hidden lg:flex">
          {[...history].reverse().slice(0, 3).map((entry, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className={`font-mono text-xs ${i === 0 ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {currency}{entry.price.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">
                {new Date(entry.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' })}
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">
                {new Date(entry.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 flex-shrink-0 w-28 text-right hidden sm:block">
        {isAtLowest ? '✅ Lowest ever' : `Low: ${currency}${lowest.toLocaleString()}`}
      </p>

      {product.nextCheck && (
        <p className="text-xs text-gray-300 flex-shrink-0 w-16 text-right font-mono hidden md:block">
          {countdown || 'soon'}
        </p>
      )}

      <div className="flex items-center gap-3 flex-shrink-0">
        <a
          href={url?.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline whitespace-nowrap"
        >
          Amazon →
        </a>
        <a
          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product.upc || title)}&_sop=15`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[#e53238] hover:underline whitespace-nowrap"
        >
          eBay →
        </a>
        <button
          onClick={async () => { setChecking(true); await onCheck(_id); setChecking(false); }}
          disabled={checking}
          className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
          title="Check price now"
        >
          {checking ? '⏳' : '🔄'}
        </button>
        <button
          onClick={() => onDelete(_id)}
          title="Stop tracking"
          className="text-gray-300 hover:text-red-500 transition-colors text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
