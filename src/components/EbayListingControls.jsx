import { useNavigate } from 'react-router-dom';
import { AUTO_LIST_STEP_LABELS } from '../utils/productGroupHelpers';

const STEP_ORDER = ['preparing-images', 'title', 'images', 'description', 'listing', 'photos', 'verifying', 'saving'];

export default function EbayListingControls({
  variants, groupEbayId, isMultiVariation,
  editingEbay, setEditingEbay, ebayInput, setEbayInput, savingEbay, myListings,
  saveEbayListing, openEbayEdit,
  fixVariationPhotos, fixingPhotos, fixPhotosStatus, fixPhotosError,
  redoDescription, redoingDescription, redoDescriptionStatus,
  onAutoList, autoListing, autoListStep, autoListError,
  priceConfirming, customPrices, setCustomPrices, onConfirmList, onCancelPriceConfirm,
  autoListSuccess, amazonUrl,
}) {
  const navigate = useNavigate();
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
        {autoListSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-200 text-xs animate-slide-up">
            <span className="text-emerald-700 font-bold whitespace-nowrap">✅ Listed!</span>
            <span className="text-emerald-600 text-[11px] truncate flex-1 min-w-0">{autoListSuccess.title}</span>
            <a href={`https://www.ebay.com/itm/${autoListSuccess.listingId}`} target="_blank" rel="noopener noreferrer"
              className="text-emerald-700 font-bold whitespace-nowrap hover:underline flex-shrink-0">
              View ↗
            </a>
          </div>
        )}
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <a href={`https://www.ebay.com/itm/${groupEbayId}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-ebay text-white hover:bg-ebay-dark transition-colors whitespace-nowrap">
            My Listing ↗
          </a>
          <button onClick={() => openEbayEdit(groupEbayId)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[13px] transition-colors" title="Edit eBay listing">✏️</button>
          {isMultiVariation && (
            <button onClick={fixVariationPhotos} disabled={fixingPhotos}
              className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors whitespace-nowrap">
              {fixingPhotos ? '📸 Uploading…' : '🖼️ Fix Variation Photos'}
            </button>
          )}
          <button onClick={redoDescription} disabled={redoingDescription}
            className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-40 transition-colors whitespace-nowrap">
            {redoingDescription ? '✍️ Generating…' : redoDescriptionStatus === 'ok' ? '✓ Updated' : redoDescriptionStatus === 'fail' ? '⚠ Failed' : '✍️ Redo Description'}
          </button>
        </div>
        {fixPhotosStatus === 'ok' && <p className="text-[10px] text-emerald-600 font-semibold">Photos updated ✓</p>}
        {fixPhotosStatus === 'fail' && <p className="text-[10px] text-red-500 break-words">{fixPhotosError || 'Failed ⚠'}</p>}
      </div>
    );
  }

  // Price confirmation step — shown before auto-list kicks off
  if (priceConfirming) {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-50 ring-1 ring-inset ring-blue-200 min-w-[220px]">
        <p className="text-[11px] font-bold text-blue-800">Review eBay prices before listing</p>
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
          {variants.map(v => (
            <div key={v._id} className="flex items-center gap-2">
              {variants.length > 1 && (
                <span className="text-[11px] text-slate-600 flex-1 truncate min-w-0">{v.variant || 'Default'}</span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <span className="text-[11px] text-slate-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={customPrices[v._id] ?? ''}
                  onChange={e => setCustomPrices(prev => ({ ...prev, [v._id]: e.target.value }))}
                  className="w-20 px-2 py-1 text-xs border border-blue-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-right font-mono"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirmList}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all">
            Confirm &amp; List
          </button>
          <button onClick={onCancelPriceConfirm}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const hasPrime = variants.some(v => v.isPrime);
  const currentStepIdx = STEP_ORDER.indexOf(autoListStep);

  return (
    <div className="flex flex-col gap-1">
      {autoListing ? (
        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl ring-1 ring-inset bg-blue-50 ring-blue-200">
          {/* Step progress dots */}
          <div className="flex items-center">
            {STEP_ORDER.map((step, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              return (
                <div key={step} className="flex items-center">
                  <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 transition-colors ${
                    done ? 'bg-blue-500 text-white' :
                    active ? 'bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-300' :
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  {i < STEP_ORDER.length - 1 && (
                    <div className={`w-3 h-px flex-shrink-0 ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[11px] text-blue-700 font-semibold leading-snug">
            {AUTO_LIST_STEP_LABELS[autoListStep] || '⏳ Listing…'}
          </span>
        </div>
      ) : autoListError ? (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-col gap-0.5 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 ring-inset bg-red-50 text-red-600 ring-red-200">
            <span>⚠️ Listing failed</span>
            <span className="text-[10px] font-normal break-words">{autoListError.slice(0, 120)}</span>
          </div>
          <button onClick={onAutoList}
            className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-full ring-1 ring-inset ring-blue-200 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap">
            🔄 Retry Auto List
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={onAutoList}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm">
            🤖 Auto list{!hasPrime && <span className="text-[10px] opacity-75 ml-0.5">(No Prime)</span>}
          </button>
          {amazonUrl && (
            <button onClick={() => navigate(`/auction?url=${encodeURIComponent(amazonUrl)}`)}
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors whitespace-nowrap shadow-sm">
              🔨 Auto Auction
            </button>
          )}
        </div>
      )}
      <button onClick={() => openEbayEdit('')}
        className="text-[10px] text-slate-400 text-center hover:text-ebay transition-colors">
        + link existing listing manually
      </button>
    </div>
  );
}
