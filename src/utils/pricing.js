const EBAY_FEE_RATE  = 0.1325;
const EBAY_FEE_FIXED = 0.30;
const PROMO_RATE     = 0.05; // 5% promoted listings
const TARGET_MARGIN  = 0.02; // 2% net profit after all fees

// Price = (cost + fixed_fee) / (1 - ebay_fee% - promo% - margin%)
// Gives ~2% net profit after eBay fee + promo fee
export function calcEbayPrice(amazonPrice) {
  const price = (amazonPrice + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE - PROMO_RATE - TARGET_MARGIN);
  return Math.floor(price) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * EBAY_FEE_RATE + EBAY_FEE_FIXED).toFixed(2);
}
