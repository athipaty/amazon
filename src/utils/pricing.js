const EBAY_FEE_RATE = 0.1325;
const EBAY_FEE_FIXED = 0.30;
const MIN_PROFIT = 4.50;

export function calcEbayPrice(amazonPrice) {
  let multiplier;
  if (amazonPrice < 10)      multiplier = 2.2;
  else if (amazonPrice < 20) multiplier = 1.7;
  else if (amazonPrice < 35) multiplier = 1.55;
  else if (amazonPrice < 60) multiplier = 1.45;
  else                        multiplier = 1.35;

  const tieredPrice = amazonPrice * multiplier;
  // Hard floor: ensure minimum profit after eBay fees
  const minPrice = (amazonPrice + MIN_PROFIT + EBAY_FEE_FIXED) / (1 - EBAY_FEE_RATE);
  return Math.floor(Math.max(tieredPrice, minPrice)) + 0.99;
}

export function calcEbayFee(ebayPrice) {
  return +(ebayPrice * EBAY_FEE_RATE + EBAY_FEE_FIXED).toFixed(2);
}
