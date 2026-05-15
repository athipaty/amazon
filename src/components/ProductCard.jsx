export default function ProductCard({ product, onDelete }) {
  const { _id, title, url, currency, current, lowest, history } = product;

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
          Next check: {new Date(product.nextCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-orange-600 hover:underline mt-1"
      >
        View on Amazon →
      </a>
    </div>
  );
}
