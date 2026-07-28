// Pure helpers shared across the eBay listing flows in ProductGroupCard:
// detecting the right eBay variation dimension and formatting spec entries.

// Use 'Style' for compound labels (contain / + or start with digit) so eBay doesn't
// reject them as invalid Color values. Check complexity BEFORE checking for color words.
export function detectVariantDimension(variants) {
  const labels = variants.map(v => v.variant || '');
  if (labels.some(l => /\d+["'.×xX]/.test(l))) return 'Size';
  if (labels.some(l => /[\/+]/.test(l) || /^\d/.test(l))) return 'Style';
  if (labels.some(l => /\b(red|blue|green|black|white|gray|grey|pink|purple|yellow|orange|brown|beige|ivory|cream|navy|teal|turquoise|coral|silver|gold|rose|lavender|mint|charcoal|natural|carbonized|walnut|bamboo|oak|mahogany|cherry|maple|ebony)\b/i.test(l))) return 'Color';
  return 'Style';
}

// Returns up to 2 eBay variation dimension names for a tracked variant group. Prefers
// structured `attributes` (stored per-SKU from Amazon, e.g. Color + PackageQuantity) when
// >=2 distinct dimensions are present across the group. Falls back to the single flattened-
// label heuristic above for older products tracked before `attributes` existed, or for
// genuinely single-dimension Amazon listings.
export function detectVariantDimensions(variants) {
  const dimSet = [];
  for (const v of variants) {
    for (const a of (v.attributes || [])) {
      if (a.dimension && !dimSet.includes(a.dimension)) dimSet.push(a.dimension);
    }
  }
  if (dimSet.length >= 2) {
    if (dimSet.length > 2) {
      console.warn(`detectVariantDimensions: ${dimSet.length} dims found (${dimSet.join(', ')}) — eBay supports at most 2; using first 2.`);
    }
    return dimSet.slice(0, 2);
  }
  return [detectVariantDimension(variants)];
}

// Per-variant { name, value } pairs matching detectVariantDimensions' output order — one
// entry per eBay variation dimension. For single-dimension groups this reproduces today's
// behavior exactly (one entry, value = the flattened variant string).
export function variantSpecifics(variant, dimensions) {
  if (dimensions.length === 1) {
    return [{ name: dimensions[0], value: variant.variant || '' }];
  }
  return dimensions.map(dim => ({
    name: dim,
    value: variant.attributes?.find(a => a.dimension === dim)?.value || '',
  }));
}

export const AUTO_LIST_STEP_LABELS = {
  'preparing-images': '📸 Saving images to storage…',
  images: '📸 Uploading images…',
  title: '✍️ Writing title…',
  description: '📝 Writing description…',
  listing: '📤 Creating listing…',
  photos: '🖼️ Pushing photos…',
  verifying: '🔍 Verifying prices…',
  saving: '💾 Saving listing ID…',
  done: '✅ Listed on eBay!',
  error: '⚠️ Listing failed',
};

export const SKIP_SPEC_KEYS = new Set(['asin', 'upc']);
export function fmtKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
export function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' · ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => val != null).map(([k, val]) => `${fmtKey(k)}: ${val}`).join(' · ');
  return String(v);
}

