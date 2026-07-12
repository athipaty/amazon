import { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Fetches eBay active-listing price stats (median/lowest/count) for a given product title/UPC.
// Shared by the add-product preview check and the Research tab.
//
// `/api/ebay/sold` is intentionally not called here — this eBay account isn't approved for the
// Marketplace Insights API it depends on, so every call just fails with invalid_scope. Since
// failures aren't cached (only successful lookups are), calling it on every variant click was
// pure wasted round trips to eBay with nothing to show for it. `sold` is kept in the return
// shape (always null) so CompetitorPriceCheck's existing "sold" branches degrade the same way
// they already do — flip this back on once Marketplace Insights access is actually granted.
export default function useCompetitorCheck(title, upc) {
  const [comp, setComp] = useState(null);       // { count, lowest, median, avg }
  const [compLoading, setCompLoading] = useState(false);
  const sold = null;

  useEffect(() => {
    if (!title) { setComp(null); return; }
    let cancelled = false;
    setCompLoading(true);
    setComp(null);
    const q = upc ? { upc } : { title };
    axios.get(`${API}/api/ebay/competitors`, { params: q }).then(res => {
      if (cancelled) return;
      setComp(res.data);
    }).catch(() => {
      if (cancelled) return;
    }).finally(() => {
      if (cancelled) return;
      setCompLoading(false);
    });
    return () => { cancelled = true; };
  }, [upc, title]);

  return { comp, sold, compLoading };
}
