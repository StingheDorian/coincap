export interface CryptoCurrency {
  id: string;
  name: string;
  symbol: string;
  rank: string;
  priceUsd: string;
  percentChange24Hr: string;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  supply: string;
  maxSupply: string | null;
}

export interface CoinCapResponse {
  data: CryptoCurrency[];
  timestamp: number;
}

export interface WalletProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  isConnected: () => boolean;
  on: (event: string, handler: (data: any) => void) => void;
  isBlast?: boolean; // Blast-specific property
}

declare global {
  interface Window {
    ethereum?: WalletProvider;
    blast?: any; // Blast Mobile global object
  }
}
