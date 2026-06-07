import axios from 'axios';

// Stacked alert/info banners shown above the product list: eBay connection issues,
// token-expiry warnings, the overnight auto-discovery summary, and the transient status message.
export default function TrackerBanners({
  apiUrl,
  ebayConnected, ebayTokenDaysLeft,
  discoveryBanner, setDiscoveryBanner,
  statusMsg,
}) {
  return (
    <>
      {!ebayConnected && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-red-700 shadow-soft">
          <span className="flex-shrink-0">⚠️</span>
          eBay token expired — prices won't sync until you
          <a href={`${apiUrl}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect eBay</a>.
        </div>
      )}
      {ebayConnected && ebayTokenDaysLeft !== null && ebayTokenDaysLeft <= 30 && (
        <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-4 text-sm border shadow-soft ${ebayTokenDaysLeft <= 7 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <span className="flex-shrink-0">⚠️</span>
          eBay token expires in <strong className="mx-1">{ebayTokenDaysLeft} day{ebayTokenDaysLeft !== 1 ? 's' : ''}</strong> —
          <a href={`${apiUrl}/api/ebay/auth/login`} className="underline font-semibold ml-1">reconnect now</a> to avoid disruption.
        </div>
      )}

      {discoveryBanner?.length > 0 && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-800 shadow-soft">
          <span className="flex-shrink-0 text-base">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1">Auto-discovery added {discoveryBanner.length} new listing{discoveryBanner.length !== 1 ? 's' : ''} overnight</p>
            <ul className="space-y-0.5">
              {discoveryBanner.map((item, i) => (
                <li key={i} className="text-xs text-emerald-700 truncate">
                  <span className="font-medium">+${item.profit?.toFixed(2)}</span> — {item.title}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => {
              setDiscoveryBanner(null);
              axios.post(`${apiUrl}/api/tracker/settings/dismiss-discovery`).catch(() => {});
            }}
            className="flex-shrink-0 text-emerald-400 hover:text-emerald-600 text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-emerald-100 transition-colors"
          >✕</button>
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-amber-800 shadow-soft">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          {statusMsg}
        </div>
      )}
    </>
  );
}
