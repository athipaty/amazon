// Top header card: brand, status pills, and the admin/utility row (Clean Orphans).
// Price checks run on their own 5-minute schedule server-side, so there's no manual
// "Check All" trigger here — just a passive indicator while a scheduled check is running.
export default function TrackerHeader({
  sellingLimits,
  checking,
  cleaningOrphans, orphanResult, handleCleanOrphans,
}) {
  return (
    <header className="mb-4 md:mb-6">
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/70 rounded-2xl shadow-soft px-4 py-3.5 md:px-5 md:py-4">
        {/* Main row: brand + status pills */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amazon text-white text-lg shadow-soft flex-shrink-0">
              📦
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                Amazon Price Tracker
              </h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {sellingLimits && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ring-1 ring-inset ${
                    sellingLimits.remaining <= 10 ? 'bg-red-50 text-red-600 ring-red-200' :
                    sellingLimits.remaining <= 30 ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                    'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  }`}>
                    {sellingLimits.used}/{sellingLimits.limit} listings
                  </span>
                )}
              </div>
            </div>
          </div>
          {checking && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap flex-shrink-0">
              <span className="animate-spin inline-block">↻</span> Checking…
            </span>
          )}
        </div>

        {/* Admin/utility row: scrollable on mobile, visually de-emphasized vs primary action */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={handleCleanOrphans}
            disabled={cleaningOrphans || checking}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
          >
            {cleaningOrphans ? '🔍 Scanning…'
              : orphanResult?.error ? '⚠ Failed'
              : orphanResult?.found === 0 ? '✓ No orphans'
              : orphanResult?.found > 0 ? `✓ Ended ${orphanResult.ended}/${orphanResult.found}`
              : '🧹 Clean Orphans'}
          </button>
        </div>
      </div>
    </header>
  );
}
