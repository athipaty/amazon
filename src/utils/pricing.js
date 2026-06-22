const EBAY_FEE_RATE  = 0.1325;
const EBAY_FEE_FIXED = 0.30;
const PROMO_RATE     = 0.05;
const MARGIN         = 0.07;
const AMAZON_TAX     = 0.085;

export function calcEbayPrice(amazonPrice) {
  const cost = amazonPrice * (1 + AMAZON_TAX);
  return Math.floor((cost + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE - PROMO_RATE - MARGIN)) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * (EBAY_FEE_RATE + PROMO_RATE) + EBAY_FEE_FIXED).toFixed(2);
}

export function trueCost(amazonPrice) {
  return amazonPrice * (1 + AMAZON_TAX);
}
