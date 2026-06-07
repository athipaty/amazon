// URL input + the "N variants found — select which to track" preview panel shown
// after pasting a multi-variant Amazon listing URL.
export default function AddProductPanel({
  url, setUrl, adding, addError, preview, previewRef,
  handleAdd, handleTrackSelected,
  selectedAsins, toggleVariant, setSelectedAsins,
  addingVariants, addProgress,
  setPreview,
}) {
  return (
    <>
      <div className="mb-4">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm pointer-events-none">🔗</span>
            <input
              type="text"
              placeholder="Paste an Amazon product URL to track…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={adding || !!preview}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amazon focus:ring-4 focus:ring-amazon/10 transition-all disabled:bg-slate-50 placeholder:text-slate-400 shadow-soft"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !url.trim() || !!preview}
            className="px-5 py-2.5 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-soft"
          >
            {adding ? 'Loading…' : 'Track Price'}
          </button>
        </form>
        {addError && <p className="text-red-500 text-sm mt-2 px-1">{addError}</p>}
      </div>

      {preview && (
        <div ref={previewRef} className="mb-5 bg-white border border-amber-200 rounded-2xl p-5 shadow-card animate-slide-up">
          <div className="flex justify-between items-start mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">
                  {preview.variants.length} variants found — select which to track
                </p>
                {preview.isPrime
                  ? <span className="inline-flex items-center gap-1 bg-[#00A8E0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Prime</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">✗ No Prime</span>
                }
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{preview.title}</p>
            </div>
            <button
              onClick={() => { setPreview(null); setSelectedAsins(new Set()); }}
              className="text-slate-300 hover:text-slate-500 text-xl leading-none ml-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-1 mt-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {preview.variants.map(v => (
              <label
                key={v.asin}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAsins.has(v.asin)}
                  onChange={e => toggleVariant(v.asin, e.target.checked)}
                  className="w-4 h-4 accent-amazon flex-shrink-0"
                />
                {v.image && (
                  <img src={v.image} alt={v.label} className="w-9 h-9 object-contain rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0" />
                )}
                <span className="text-sm text-slate-700 flex-1">{v.label}</span>
                {v.price != null
                  ? <span className="text-sm font-bold text-slate-900 flex-shrink-0">{preview.currency}{v.price.toLocaleString()}</span>
                  : <span className="text-xs text-slate-400 flex-shrink-0">price varies</span>
                }
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {selectedAsins.size === 0 && !addingVariants && (
              <p className="text-sm text-amber-600 font-medium">Select at least one variant to track</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleTrackSelected}
                disabled={addingVariants || selectedAsins.size === 0}
                className="px-4 py-2 bg-gradient-to-b from-amber-400 to-amazon text-slate-900 font-bold text-sm rounded-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-soft"
              >
                {addingVariants ? addProgress : selectedAsins.size === 0 ? 'Track Selected' : `Track Selected (${selectedAsins.size})`}
              </button>
              <button
                onClick={() => setSelectedAsins(new Set(preview.variants.map(v => v.asin)))}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAsins(new Set())}
                disabled={addingVariants}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
