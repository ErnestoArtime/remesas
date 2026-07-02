interface FeeTier {
  maximum: number;
  percentage: number;
  minimumFee: number;
}

const feeTiers: FeeTier[] = [
  { maximum: 99.99, percentage: 8, minimumFee: 5 },
  { maximum: 299.99, percentage: 6.5, minimumFee: 0 },
  { maximum: 699.99, percentage: 5, minimumFee: 0 },
  { maximum: 1500, percentage: 4, minimumFee: 0 },
];

interface CalculateParams {
  amountDelivered: number;
  deliverySpeed: 'standard' | 'priority';
}

interface CalculatedQuote {
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPay: number;
  feePercentage: number;
  estimatedDelivery: string;
}

export function calculateQuote(params: CalculateParams): CalculatedQuote {
  const amount = Math.min(Math.max(params.amountDelivered || 0, 0), 1500);
  const tier = feeTiers.find((item) => amount <= item.maximum) ?? feeTiers.at(-1)!;
  const serviceFee = Math.max((amount * tier.percentage) / 100, tier.minimumFee);
  const priorityFee = params.deliverySpeed === 'priority' ? 5 : 0;
  const deliveryFee = 3 + priorityFee;

  return {
    amountDelivered: round(amount),
    serviceFee: round(serviceFee),
    deliveryFee: round(deliveryFee),
    totalToPay: round(amount + serviceFee + deliveryFee),
    feePercentage: tier.percentage,
    estimatedDelivery: params.deliverySpeed === 'priority' ? 'Hasta 6 horas' : 'En 24 horas',
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
