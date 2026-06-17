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

export const AUTO_LIST_STEP_LABELS = {
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

