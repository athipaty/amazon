import { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Fetches eBay active-listing price stats (median/lowest/count) and sold comps for a
// given product title/UPC. Shared by the add-product preview check and the Research tab.
export default function useCompetitorCheck(title, upc) {
  const [comp, setComp] = useState(null);       // { count, lowest, median, avg }
  const [sold, setSold] = useState(null);        // { count, avg, min, max }
  const [compLoading, setCompLoading] = useState(false);

  useEffect(() => {
    if (!title) { setComp(null); setSold(null); return; }
    let cancelled = false;
    setCompLoading(true);
    setComp(null);
    setSold(null);
    const q = upc ? { upc } : { title };
    Promise.allSettled([
      axios.get(`${API}/api/ebay/competitors`, { params: q }),
      axios.get(`${API}/api/ebay/sold`, { params: { q: title.split(' ').slice(0, 6).join(' ') } }),
    ]).then(([compRes, soldRes]) => {
      if (cancelled) return;
      if (compRes.status === 'fulfilled') setComp(compRes.value.data);
      if (soldRes.status === 'fulfilled') setSold(soldRes.value.data);
      setCompLoading(false);
    });
    return () => { cancelled = true; };
  }, [upc, title]);

  return { comp, sold, compLoading };
}
