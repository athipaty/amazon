const EBAY_FEE_RATE  = 0.1325;
const EBAY_FEE_FIXED = 0.30;
const MIN_PROFIT     = 4.50;  // hard floor for normal mode
const PROMO_RATE     = 0.05;
const SALE_MARGIN    = 0.02;
const AMAZON_TAX     = 0.085; // 8.5% sales tax on Amazon purchases

// Normal mode: tiered multiplier — cheaper products get higher markup
// Sale mode: flat 2% margin formula
export function calcEbayPrice(amazonPrice, saleMode = false) {
  const cost = amazonPrice * (1 + AMAZON_TAX);
  if (saleMode) {
    const price = (cost + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE - PROMO_RATE - SALE_MARGIN);
    return Math.floor(price) + 0.99;
  }
  let multiplier;
  if (cost < 10)      multiplier = 2.2;
  else if (cost < 20) multiplier = 1.7;
  else if (cost < 35) multiplier = 1.55;
  else if (cost < 60) multiplier = 1.45;
  else                multiplier = 1.35;

  const tieredPrice = cost * multiplier;
  const minPrice    = (cost + MIN_PROFIT + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE);
  return Math.floor(Math.max(tieredPrice, minPrice)) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * EBAY_FEE_RATE + EBAY_FEE_FIXED).toFixed(2);
}

export function trueCost(amazonPrice) {
  return amazonPrice * (1 + AMAZON_TAX);
}
