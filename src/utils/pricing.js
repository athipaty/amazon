const EBAY_FEE_RATE    = 0.1325;
const EBAY_FEE_FIXED   = 0.30;
const PROMO_RATE       = 0.05;  // 5% promoted listings
const NORMAL_MARGIN    = 0.02;  // 2% net profit — standard pricing
const SALE_MARGIN      = 0.02;  // 2% net profit — sale pricing (change here to differentiate)

// Price = (cost + fixed_fee) / (1 - ebay_fee% - promo% - margin%)
export function calcEbayPrice(amazonPrice, saleMode = false) {
  const margin = saleMode ? SALE_MARGIN : NORMAL_MARGIN;
  const price = (amazonPrice + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE - PROMO_RATE - margin);
  return Math.floor(price) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * EBAY_FEE_RATE + EBAY_FEE_FIXED).toFixed(2);
}
