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

export function getFeeSchedule(): Array<FeeTier & { minimum: number }> {
  let minimum = 20;
  return feeTiers.map((tier) => {
    const item = { ...tier, minimum };
    minimum = Math.round((tier.maximum + 0.01) * 100) / 100;
    return item;
  });
}

interface CalculateParams {
  amountDelivered: number;
  deliverySpeed: 'standard' | 'priority';
  deliveryFee: number;
  estimatedMinHours: number;
  estimatedMaxHours: number;
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
  const deliveryFee = params.deliveryFee + priorityFee;
  const estimatedDelivery = params.deliverySpeed === 'priority'
    ? `Entre ${Math.max(1, Math.min(params.estimatedMinHours, 6))} y ${Math.min(params.estimatedMaxHours, 12)} horas`
    : `Entre ${params.estimatedMinHours} y ${params.estimatedMaxHours} horas`;

  return {
    amountDelivered: round(amount),
    serviceFee: round(serviceFee),
    deliveryFee: round(deliveryFee),
    totalToPay: round(amount + serviceFee + deliveryFee),
    feePercentage: tier.percentage,
    estimatedDelivery,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
