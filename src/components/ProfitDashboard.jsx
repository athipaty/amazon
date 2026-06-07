import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function MarginBar({ margin }) {
  const color = margin >= 25 ? 'bg-emerald-500' : margin >= 15 ? 'bg-amber-400' : 'bg-red-400';
  const width = Math.min(100, Math.max(0, margin * 2));
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-10 text-right ${margin >= 25 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
        {margin}%
      </span>
    </div>
  );
}

export default function ProfitDashboard({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('profit'); // profit | margin | amazon | ebay
  const [sortDir, setSortDir] = useState(-1); // -1 desc, 1 asc

  useEffect(() => {
    fetch(`${API}/api/tracker/profit-summary`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleSort(key) {
    if (sort === key) setSortDir(d => d * -1);
    else { setSort(key); setSortDir(-1); }
  }

  const sorted = data?.listings ? [...data.listings].sort((a, b) => {
    const map = { profit: 'avgProfit', margin: 'avgMargin', amazon: 'avgAmazon', ebay: 'avgEbay' };
    return (a[map[sort]] - b[map[sort]]) * sortDir;
  }) : [];

  const s = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm overflow-y-auto py-6 px-3 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lift w-full max-w-4xl animate-slide-up" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">📊 Profit Dashboard</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xl font-light leading-none transition-colors">✕</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
        )}

        {!loading && !s && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">No data available</div>
        )}

        {!loading && s && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-slate-100">
              <div className="bg-blue-50 rounded-xl p-3.5 ring-1 ring-inset ring-blue-100">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Total Listings</p>
                <p className="text-2xl font-black text-blue-700">{s.totalListings}</p>
                <p className="text-[11px] text-blue-400 mt-0.5">{s.totalVariants} variants</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3.5 ring-1 ring-inset ring-emerald-100">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Avg Margin</p>
                <p className="text-2xl font-black text-emerald-700">{s.avgMargin}%</p>
                <p className="text-[11px] text-emerald-500 mt-0.5">{s.highMargin} listings ≥ 25%</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3.5 ring-1 ring-inset ring-purple-100">
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-1">Potential Profit</p>
                <p className="text-2xl font-black text-purple-700">${s.totalPotentialProfit}</p>
                <p className="text-[11px] text-purple-400 mt-0.5">if each variant sells once</p>
              </div>
              <div className={`rounded-xl p-3.5 ring-1 ring-inset ${s.thinMargin > 0 ? 'bg-red-50 ring-red-100' : 'bg-slate-50 ring-slate-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${s.thinMargin > 0 ? 'text-red-400' : 'text-slate-400'}`}>Thin Margin</p>
                <p className={`text-2xl font-black ${s.thinMargin > 0 ? 'text-red-600' : 'text-slate-400'}`}>{s.thinMargin}</p>
                <p className={`text-[11px] mt-0.5 ${s.thinMargin > 0 ? 'text-red-400' : 'text-slate-400'}`}>listings below 15%</p>
              </div>
            </div>

            {/* Table */}
            <div className="px-5 pb-5">
              <div className="overflow-x-auto mt-4 scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide pr-3">Product</th>
                      {[['amazon','Amazon'],['ebay','eBay'],['profit','Profit'],['margin','Margin']].map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)}
                          className="text-right pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none whitespace-nowrap px-2">
                          {label} {sort === key ? (sortDir === -1 ? '↓' : '↑') : ''}
                        </th>
                      ))}
                      <th className="text-left pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wide pl-3 w-32">Margin bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sorted.map(l => (
                      <tr key={l.listingId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-slate-800 text-[12px] leading-tight line-clamp-1">{l.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{l.variantCount} variant{l.variantCount !== 1 ? 's' : ''} · #{l.listingId}</p>
                        </td>
                        <td className="py-2.5 text-right px-2 text-slate-500 text-[12px]">${l.avgAmazon}</td>
                        <td className="py-2.5 text-right px-2 text-blue-600 font-medium text-[12px]">${l.avgEbay}</td>
                        <td className="py-2.5 text-right px-2 font-bold text-[12px] text-emerald-600">+${l.avgProfit}</td>
                        <td className="py-2.5 px-2 w-36">
                          <MarginBar margin={l.avgMargin} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
