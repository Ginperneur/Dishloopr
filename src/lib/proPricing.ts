export const OWNER_PRO_PRICES = {
  monthly: {
    priceId: 'price_1TdPdO3EXkDnjHC3dK2LdvFT',
    productId: 'prod_UcexWZ1nctKBx6',
    amount: 29,
    currency: 'EUR',
    interval: 'month' as const,
    label: '€29 / maand',
  },
  yearly: {
    priceId: 'price_1TdPeD3EXkDnjHC3J5T79Qe7',
    productId: 'prod_UceyK8ftbccGJq',
    amount: 290,
    currency: 'EUR',
    interval: 'year' as const,
    label: '€290 / jaar',
    savingsLabel: '2 maanden gratis',
  },
} as const;

export type ProBillingInterval = keyof typeof OWNER_PRO_PRICES;