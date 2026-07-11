// Centered modal confirmation — deliberately NOT an inline button swap.
// An inline Yes/No that appears where the trigger button was is a mis-click trap:
// a second/accidental click lands on "Yes" before anyone reads what it does.
// A modal forces a deliberate action in a different location on screen.
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Yes, continue', cancelLabel = 'Cancel',
  danger = true, loading = false, error = null, onConfirm, onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-card p-5 flex flex-col gap-3"
      >
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {message && <p className="text-[13px] text-slate-500 leading-relaxed">{message}</p>}
        {error && (
          <p className="text-[12px] text-red-500 bg-red-50 ring-1 ring-inset ring-red-200 rounded-lg px-2.5 py-1.5">⚠ {error}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-xs font-semibold px-3.5 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`text-xs font-bold px-3.5 py-2 rounded-full text-white transition-colors disabled:opacity-60 whitespace-nowrap ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-ebay hover:bg-ebay/90'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
