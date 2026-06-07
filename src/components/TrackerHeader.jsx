// Top header card: brand, status pills, "Check All", and the admin/utility row
// (Sale Mode, Retry Errors, Clean Orphans).
export default function TrackerHeader({
  sellingLimits,
  saleModeActive, saleMode, saleModeResetting, saleModeResult, saleModeConfirm,
  handleSaleMode, setSaleModeConfirm,
  checking, handleCheckNow,
  products,
  retrying, retryProgress, handleRetryErrors,
  cleaningOrphans, orphanResult, handleCleanOrphans,
}) {
  const errorCount = products.filter(p => ['error', 'unavailable', 'out_of_stock'].includes(p.status)).length;

  return (
    <header className="mb-4 md:mb-6">
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/70 rounded-2xl shadow-soft px-4 py-3.5 md:px-5 md:py-4">
        {/* Main row: brand + status pills + primary action */}
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
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider whitespace-nowrap ring-1 ring-inset ${
                  saleModeActive
                    ? 'bg-ebay text-white ring-ebay-dark'
                    : 'bg-slate-50 text-slate-400 ring-slate-200'
                }`}>
                  {saleModeActive ? '🔥 SALE MODE' : 'NORMAL'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 md:px-4 md:py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-soft hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap flex-shrink-0"
          >
            <span className={checking ? 'animate-spin inline-block' : ''}>↻</span>
            <span className="hidden sm:inline">{checking ? 'Checking…' : 'Check All'}</span>
          </button>
        </div>

        {/* Admin/utility row: scrollable on mobile, visually de-emphasized vs primary action */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={handleSaleMode}
            onBlur={() => setSaleModeConfirm(false)}
            disabled={saleMode || saleModeResetting || checking}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5
              ${saleMode || saleModeResetting ? (saleModeActive ? 'bg-ebay text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200') :
                saleModeConfirm ? (saleModeActive ? 'bg-ebay-dark text-white hover:bg-red-800' : 'bg-emerald-500 text-white hover:bg-emerald-600') :
                saleModeActive ? 'bg-ebay text-white hover:bg-ebay-dark' :
                'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'}`}
          >
            {saleModeActive && !saleMode && !saleModeResetting && !saleModeConfirm && (
              <span className="bg-white/90 text-ebay text-[9px] font-black px-1 py-0.5 rounded leading-none">SALE</span>
            )}
            {saleMode ? 'Repricing…'
              : saleModeResetting ? 'Resetting prices…'
              : saleModeResult?.error ? '⚠ Failed'
              : saleModeResult && !saleModeActive ? `✓ Normal ${saleModeResult.done}/${saleModeResult.total}`
              : saleModeResult ? `✓ Done ${saleModeResult.done}/${saleModeResult.total}`
              : saleModeConfirm && saleModeActive ? 'Tap to confirm end sale'
              : saleModeConfirm ? 'Tap again to confirm'
              : saleModeActive ? '🔥 Sale ON — tap to end'
              : '🏷️ Sale Mode (2% profit)'}
          </button>
          {errorCount > 0 && (
            <button
              onClick={handleRetryErrors}
              disabled={retrying || checking}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
            >
              {retrying
                ? retryProgress ? `↻ Retrying… ${retryProgress.done}/${retryProgress.total}` : '↻ Retrying…'
                : retryProgress ? `✓ Done ${retryProgress.done}/${retryProgress.total}`
                : `⚠ Retry Errors (${errorCount})`}
            </button>
          )}
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
