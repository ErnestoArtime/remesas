import type { Order } from '../models/order';

export interface PublicOrderStatus {
  reference: string;
  paymentStatus: string;
  deliveryStatus?: string;
  confirmations: number;
  minConfirmations: number;
  confirmationProgress: number;
  amountReceivedUsd?: number;
  asset?: string;
  network?: string;
  txHash?: string;
  explorerUrl?: string;
  estimatedDelivery: string;
  updatedAt: string;
}

export function toPublicOrderStatus(order: Order): PublicOrderStatus {
  return {
    reference: order.reference,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    confirmations: order.confirmations ?? 0,
    minConfirmations: order.minConfirmations ?? 0,
    confirmationProgress: order.confirmationProgress ?? 0,
    amountReceivedUsd: order.paidAmount,
    asset: order.paidAsset,
    network: order.paidNetwork,
    txHash: order.txHash,
    explorerUrl: explorerUrl(order.paidNetwork, order.txHash),
    estimatedDelivery: order.quote.estimatedDelivery,
    updatedAt: order.lastPaymentEventAt || order.createdAt,
  };
}

function explorerUrl(network?: string, txHash?: string): string | undefined {
  if (!network || !txHash) return undefined;
  const baseUrls: Record<string, string> = {
    bsc: 'https://bscscan.com/tx/',
    ethereum: 'https://etherscan.io/tx/',
    eth: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    pol: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    arb: 'https://arbiscan.io/tx/',
    base: 'https://basescan.org/tx/',
    tron: 'https://tronscan.org/#/transaction/',
    trx: 'https://tronscan.org/#/transaction/',
    solana: 'https://solscan.io/tx/',
    sol: 'https://solscan.io/tx/',
    bitcoin: 'https://mempool.space/tx/',
    btc: 'https://mempool.space/tx/',
  };
  const base = baseUrls[network.toLowerCase()];
  return base ? `${base}${encodeURIComponent(txHash)}` : undefined;
}
