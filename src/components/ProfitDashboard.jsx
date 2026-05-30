import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function MarginBar({ margin }) {
  const color = margin >= 25 ? 'bg-green-500' : margin >= 15 ? 'bg-amber-400' : 'bg-red-400';
  const width = Math.min(100, Math.max(0, margin * 2));
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-10 text-right ${margin >= 25 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6 px-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Profit Dashboard</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none">✕</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
        )}

        {!loading && s && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-gray-100">
              <div className="bg-blue-50 rounded-xl p-3.5">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Total Listings</p>
                <p className="text-2xl font-black text-blue-700">{s.totalListings}</p>
                <p className="text-[11px] text-blue-400 mt-0.5">{s.totalVariants} variants</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3.5">
                <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide mb-1">Avg Margin</p>
                <p className="text-2xl font-black text-green-700">{s.avgMargin}%</p>
                <p className="text-[11px] text-green-400 mt-0.5">{s.highMargin} listings ≥ 25%</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3.5">
                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Potential Profit</p>
                <p className="text-2xl font-black text-purple-700">${s.totalPotentialProfit}</p>
                <p className="text-[11px] text-purple-400 mt-0.5">if each variant sells once</p>
              </div>
              <div className={`rounded-xl p-3.5 ${s.thinMargin > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${s.thinMargin > 0 ? 'text-red-400' : 'text-gray-400'}`}>Thin Margin</p>
                <p className={`text-2xl font-black ${s.thinMargin > 0 ? 'text-red-600' : 'text-gray-400'}`}>{s.thinMargin}</p>
                <p className={`text-[11px] mt-0.5 ${s.thinMargin > 0 ? 'text-red-400' : 'text-gray-400'}`}>listings below 15%</p>
              </div>
            </div>

            {/* Table */}
            <div className="px-5 pb-5">
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-3">Product</th>
                      {[['amazon','Amazon'],['ebay','eBay'],['profit','Profit'],['margin','Margin']].map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)}
                          className="text-right pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600 select-none whitespace-nowrap px-2">
                          {label} {sort === key ? (sortDir === -1 ? '↓' : '↑') : ''}
                        </th>
                      ))}
                      <th className="text-left pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide pl-3 w-32">Margin bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sorted.map(l => (
                      <tr key={l.listingId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-gray-800 text-[12px] leading-tight line-clamp-1">{l.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{l.variantCount} variant{l.variantCount !== 1 ? 's' : ''} · #{l.listingId}</p>
                        </td>
                        <td className="py-2.5 text-right px-2 text-gray-500 text-[12px]">${l.avgAmazon}</td>
                        <td className="py-2.5 text-right px-2 text-blue-600 font-medium text-[12px]">${l.avgEbay}</td>
                        <td className="py-2.5 text-right px-2 font-bold text-[12px] text-green-600">+${l.avgProfit}</td>
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
