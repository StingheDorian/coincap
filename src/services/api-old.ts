import type { CryptoCurrency } from '../types';

// For demo purposes, we'll use mock data to avoid CORS issues and provide instant loading
// In production, you would integrate with a real cryptocurrency API

// Mock data as fallback with more realistic data
const mockCryptoData: CryptoCurrency[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    rank: '1',
    priceUsd: '65432.10',
    percentChange24Hr: '2.34',
    marketCapUsd: '1284321000000',
    volumeUsd24Hr: '23456789000',
    supply: '19654321',
    maxSupply: '21000000'
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    rank: '2',
    priceUsd: '3187.45',
    percentChange24Hr: '-1.23',
    marketCapUsd: '383876000000',
    volumeUsd24Hr: '15432100000',
    supply: '120456789',
    maxSupply: null
  },
  {
    id: 'tether',
    name: 'Tether USDt',
    symbol: 'USDT',
    rank: '3',
    priceUsd: '1.001',
    percentChange24Hr: '0.01',
    marketCapUsd: '118432100000',
    volumeUsd24Hr: '45678900000',
    supply: '118321000000',
    maxSupply: null
  },
  {
    id: 'bnb',
    name: 'BNB',
    symbol: 'BNB',
    rank: '4',
    priceUsd: '592.18',
    percentChange24Hr: '3.45',
    marketCapUsd: '86432100000',
    volumeUsd24Hr: '1234567000',
    supply: '146234567',
    maxSupply: '200000000'
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    rank: '5',
    priceUsd: '178.76',
    percentChange24Hr: '5.67',
    marketCapUsd: '82210987000',
    volumeUsd24Hr: '2345678000',
    supply: '460654321',
    maxSupply: null
  },
  {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    rank: '6',
    priceUsd: '0.9998',
    percentChange24Hr: '-0.02',
    marketCapUsd: '34210987000',
    volumeUsd24Hr: '4345678000',
    supply: '34212000000',
    maxSupply: null
  },
  {
    id: 'xrp',
    name: 'XRP',
    symbol: 'XRP',
    rank: '7',
    priceUsd: '0.6234',
    percentChange24Hr: '1.89',
    marketCapUsd: '35432100000',
    volumeUsd24Hr: '1567890000',
    supply: '56843210987',
    maxSupply: '100000000000'
  },
  {
    id: 'lido-staked-ether',
    name: 'Lido Staked Ether',
    symbol: 'STETH',
    rank: '8',
    priceUsd: '3180.92',
    percentChange24Hr: '-1.18',
    marketCapUsd: '30987654000',
    volumeUsd24Hr: '234567890',
    supply: '9743210',
    maxSupply: null
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    symbol: 'DOGE',
    rank: '9',
    priceUsd: '0.1234',
    percentChange24Hr: '4.56',
    marketCapUsd: '18210987000',
    volumeUsd24Hr: '567890123',
    supply: '147654321098',
    maxSupply: null
  },
  {
    id: 'toncoin',
    name: 'Toncoin',
    symbol: 'TON',
    rank: '10',
    priceUsd: '6.87',
    percentChange24Hr: '2.34',
    marketCapUsd: '17432100000',
    volumeUsd24Hr: '345678901',
    supply: '2537654321',
    maxSupply: '5000000000'
  }
];

/**
 * Fetch top cryptocurrencies - using mock data for demo
 */
export async function fetchTopCryptocurrencies(limit = 20): Promise<CryptoCurrency[]> {
  // Simulate API delay for realistic loading experience
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('Loading cryptocurrency data...');
  return mockCryptoData.slice(0, limit);
}

/**
 * Fetch specific cryptocurrency by ID
 */
export async function fetchCryptocurrencyById(id: string): Promise<CryptoCurrency | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return from mock data
  return mockCryptoData.find(crypto => crypto.id === id) || null;
}

/**
 * Search cryptocurrencies by name or symbol
 */
export async function searchCryptocurrencies(query: string): Promise<CryptoCurrency[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Filter mock data
  const lowerQuery = query.toLowerCase();
  return mockCryptoData.filter(crypto => 
    crypto.name.toLowerCase().includes(lowerQuery) || 
    crypto.symbol.toLowerCase().includes(lowerQuery)
  );
}
