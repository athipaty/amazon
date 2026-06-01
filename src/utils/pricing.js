const EBAY_FEE_RATE  = 0.1325;
const EBAY_FEE_FIXED = 0.30;
const MIN_PROFIT     = 4.50;  // hard floor for normal mode
const PROMO_RATE     = 0.05;
const SALE_MARGIN    = 0.02;

// Normal mode: tiered multiplier — cheaper products get higher markup
// Sale mode: flat 2% margin formula
export function calcEbayPrice(amazonPrice, saleMode = false) {
  if (saleMode) {
    const price = (amazonPrice + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE - PROMO_RATE - SALE_MARGIN);
    return Math.floor(price) + 0.99;
  }
  let multiplier;
  if (amazonPrice < 10)      multiplier = 2.2;
  else if (amazonPrice < 20) multiplier = 1.7;
  else if (amazonPrice < 35) multiplier = 1.55;
  else if (amazonPrice < 60) multiplier = 1.45;
  else                       multiplier = 1.35;

  const tieredPrice = amazonPrice * multiplier;
  const minPrice    = (amazonPrice + MIN_PROFIT + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE);
  return Math.floor(Math.max(tieredPrice, minPrice)) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * EBAY_FEE_RATE + EBAY_FEE_FIXED).toFixed(2);
}
