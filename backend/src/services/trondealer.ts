import { TronDealer } from '@areitosa/trondealer-sdk';

const apiKey = process.env.TRONDEALER_API_KEY;

function getClient(): TronDealer {
  if (!apiKey) {
    throw new Error('TRONDEALER_API_KEY no configurada');
  }
  return new TronDealer({ apiKey });
}

export const tronService = {
  async assignWallet(label: string): Promise<string> {
    const client = getClient();
    const result = await client.wallets.assign({ label });
    return result.wallet.address;
  },

  checkConfig(): boolean {
    return !!apiKey;
  },
};
