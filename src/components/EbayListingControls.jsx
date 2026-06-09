import { AUTO_LIST_STEP_LABELS } from '../utils/productGroupHelpers';

// eBay listing link/edit controls shown in the action row: the inline
// "paste listing ID / pick from my listings" editor, the linked-listing view
// (My Listing link + Fix Variation Photos), or the unlisted state
// (auto-list progress / manual link prompt).
export default function EbayListingControls({
  variants, groupEbayId,
  editingEbay, setEditingEbay, ebayInput, setEbayInput, savingEbay, myListings,
  saveEbayListing, openEbayEdit,
  fixVariationPhotos, fixingPhotos, fixPhotosStatus, fixPhotosError,
  autoListStatus,
}) {
  if (editingEbay) {
    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        {myListings.length > 0 && (
          <select
            autoFocus
            className="w-52 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-ebay focus:ring-2 focus:ring-ebay/15 bg-white transition-all"
            value={ebayInput}
            onChange={e => setEbayInput(e.target.value)}
            disabled={savingEbay}
          >
            <option value="">— pick a listing —</option>
            {myListings.map(l => (
              <option key={l.listingId} value={l.listingId}>
                {l.listingId} · {(l.title || '').slice(0, 40)}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="or paste ID / URL"
            value={ebayInput}
            onChange={e => setEbayInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEbayListing(); if (e.key === 'Escape') setEditingEbay(false); }}
            className="w-52 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-ebay focus:ring-2 focus:ring-ebay/15 transition-all"
            disabled={savingEbay}
          />
          <button onClick={saveEbayListing} disabled={savingEbay}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-ebay text-white text-xs hover:bg-ebay-dark disabled:opacity-40 transition-colors">✓</button>
          <button onClick={() => setEditingEbay(false)} disabled={savingEbay}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-colors">✕</button>
        </div>
      </div>
    );
  }

  if (groupEbayId) {
    return (
      <div className="flex flex-col gap-1">
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-ebay text-white hover:bg-ebay-dark transition-colors whitespace-nowrap">
            My Listing ↗
          </a>
          <button onClick={() => openEbayEdit(groupEbayId)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[13px] transition-colors" title="Edit eBay listing">✏️</button>
          <button onClick={fixVariationPhotos} disabled={fixingPhotos}
            className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors whitespace-nowrap">
            {fixingPhotos ? '📸 Uploading…' : '🖼️ Fix Variation Photos'}
          </button>
        </div>
        {fixPhotosStatus === 'ok' && <p className="text-[10px] text-emerald-600 font-semibold">Photos updated ✓</p>}
        {fixPhotosStatus === 'fail' && <p className="text-[10px] text-red-500 break-words">{fixPhotosError || 'Failed ⚠'}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {(() => {
        // Find active auto-list status for any variant in this group
        const status = variants.map(v => autoListStatus[String(v._id)]).find(Boolean);
        if (status) {
          const isError = status.step === 'error';
          return (
            <div className={`flex flex-col gap-0.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${isError ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
              <span>{AUTO_LIST_STEP_LABELS[status.step] || '⏳ Listing…'}</span>
              {isError && <span className="text-[10px] font-normal text-red-500 break-words">{status.error?.slice(0, 120)}</span>}
            </div>
          );
        }
        const hasPrime = variants.some(v => v.isPrime);
        return (
          <>
            {hasPrime
              ? <span className="text-[10px] text-blue-500 px-1">🤖 Will auto-list when Prime confirmed</span>
              : <span className="text-[10px] text-slate-400 px-1">🚫 No Prime — cannot list on eBay</span>
            }
            <button onClick={() => openEbayEdit('')}
              className="text-[10px] text-slate-400 text-center hover:text-ebay transition-colors">
              + link existing listing manually
            </button>
          </>
        );
      })()}
    </div>
  );
}
