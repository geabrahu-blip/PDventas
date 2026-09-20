export const calculateDecantPrices = (retailPrice: number) => {
  // 5ml: <= 450 -> 40. Increment by 5 for every 100 above 450.
  let price5ml = 40;
  if (retailPrice > 450) {
    const increments = Math.floor((retailPrice - 450.01) / 100) + 1;
    price5ml = 40 + increments * 5;
  }

  // 10ml: (5ml_price * 2) - 5
  const price10ml = price5ml * 2 - 5;

  // 30ml: (10ml_price * 3) - 5
  const price30ml = price10ml * 3 - 5;

  return {
    '5ml': price5ml,
    '10ml': price10ml,
    '30ml': price30ml,
  };
};