// fix-all-photos.js
// Runs Fix Variation Photos for every multi-variant eBay listing.
// Mirrors the frontend fixVariationPhotos() flow: refresh images → upload → variation-photos.

const BASE = 'http://localhost:5000';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectDimension(variants) {
  const colorRe = /\b(red|blue|green|black|white|gray|grey|pink|purple|yellow|orange|brown|beige|ivory|cream|navy|teal|turquoise|coral|silver|gold|rose|lavender|mint|charcoal|natural|carbonized|walnut|bamboo|oak|mahogany|cherry|maple|ebony)\b/i;
  if (variants.some(v => (v.variant || '').match(/\d+["'.×xX]/))) return 'Size';
  if (variants.some(v => (v.variant || '').match(colorRe))) return 'Color';
  return 'Style';
}

async function fixListing(listingId, variants) {
  const baseSlug = (variants[0]?.specs?.asin || String(variants[0]?._id).slice(-8)).toLowerCase().replace(/[^a-z0-9]/g, '');
  const variantDimension = detectDimension(variants);

  // Step 1: Refresh images from Amazon for each variant (sequential, gentle pace)
  const refreshed = [];
  for (const v of variants) {
    const r = await api('POST', `/api/tracker/${v._id}/refresh-images`);
    const imgs = r.data?.images?.length ? r.data.images : (v.images?.length ? v.images : [v.image].filter(Boolean));
    refreshed.push({ ...v, images: imgs });
    await sleep(1200); // gentle Amazon rate limit
  }

  // Step 2: Upload each variant's images to Cloudinary
  const variantCloudinaryImages = [];
  for (const v of refreshed) {
    const varImgs = [...new Set([v.image, ...(v.images || [])].filter(Boolean))].slice(0, 8);
    if (!varImgs.length) { variantCloudinaryImages.push([]); continue; }
    const varSlug = baseSlug + '-fix-' + (v.variant || String(variants.indexOf(v))).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const r = await api('POST', '/api/ebay/upload-images', { imageUrls: varImgs, slug: varSlug });
    variantCloudinaryImages.push(r.data?.cloudinaryUrls || []);
    await sleep(500);
  }

  // Step 3: Call variation-photos (backend auto-detects dimension from eBay)
  const variantPayload = variants.map((v, i) => ({
    label: v.variant || `Variant ${i + 1}`,
    images: variantCloudinaryImages[i] || [],
    image: variantCloudinaryImages[i]?.[0] || null,
  })).filter(v => v.images.length);

  if (!variantPayload.length) return { ok: false, error: 'no images after upload' };

  const r = await api('POST', '/api/ebay/listing/variation-photos', {
    listingId,
    variantDimension,
    variants: variantPayload,
  });
  return r;
}

(async () => {
  // Load all tracker products
  const { data: products } = await api('GET', '/api/tracker');
  if (!Array.isArray(products)) { console.error('Failed to load tracker data'); process.exit(1); }

  // Group by eBay listing ID, keep only multi-variant
  const groups = {};
  for (const p of products) {
    if (!p.ebayListingId) continue;
    if (!groups[p.ebayListingId]) groups[p.ebayListingId] = [];
    groups[p.ebayListingId].push(p);
  }
  const multi = Object.entries(groups).filter(([, g]) => g.length > 1);
  console.log(`Found ${multi.length} multi-variant listings to fix.\n`);

  const results = [];
  for (let i = 0; i < multi.length; i++) {
    const [listingId, variants] = multi[i];
    const title = variants[0]?.title?.slice(0, 55) || listingId;
    const dim = detectDimension(variants);
    process.stdout.write(`[${i + 1}/${multi.length}] ${listingId} (${variants.length}v, ${dim}) ${title}… `);
    try {
      const r = await fixListing(listingId, variants);
      if (r.ok && r.data?.ok) {
        console.log(`✓  updated=${r.data.updated} dim="${r.data.dimension}"`);
        results.push({ listingId, ok: true, updated: r.data.updated, dimension: r.data.dimension });
      } else {
        console.log(`✗  ${JSON.stringify(r.data).slice(0, 120)}`);
        results.push({ listingId, ok: false, error: r.data?.error || 'unknown' });
      }
    } catch (e) {
      console.log(`✗  ${e.message}`);
      results.push({ listingId, ok: false, error: e.message });
    }
    await sleep(800);
  }

  console.log('\n─────────────────────────────────────────');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`Done: ${passed}/${multi.length} fixed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach(f => console.log(' ', f.listingId, '-', f.error));
  }
})();
