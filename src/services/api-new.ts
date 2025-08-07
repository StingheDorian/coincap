import axios from 'axios';
import type { CryptoCurrency } from '../types';

// Use CoinGecko API which has excellent CORS support and is free
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Fetch top cryptocurrencies from CoinGecko API (free, no API key required)
 */
export async function fetchTopCryptocurrencies(limit = 20): Promise<CryptoCurrency[]> {
  try {
    console.log('Fetching real cryptocurrency data from CoinGecko...');
    const response = await axios.get(`${API_BASE_URL}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h'
      },
      timeout: 10000
    });

    console.log('Successfully fetched real cryptocurrency data!');
    return response.data.map((coin: any, index: number) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      rank: String(index + 1),
      priceUsd: coin.current_price ? String(coin.current_price) : '0',
      percentChange24Hr: coin.price_change_percentage_24h ? String(coin.price_change_percentage_24h) : '0',
      marketCapUsd: coin.market_cap ? String(coin.market_cap) : '0',
      volumeUsd24Hr: coin.total_volume ? String(coin.total_volume) : '0',
      supply: coin.circulating_supply ? String(coin.circulating_supply) : '0',
      maxSupply: coin.max_supply ? String(coin.max_supply) : null
    }));
  } catch (error) {
    console.error('Error fetching cryptocurrency data:', error);
    throw new Error('Failed to fetch real cryptocurrency data. Please check your internet connection.');
  }
}

/**
 * Fetch specific cryptocurrency by ID from CoinGecko
 */
export async function fetchCryptocurrencyById(id: string): Promise<CryptoCurrency | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/coins/${id}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false
      },
      timeout: 10000
    });

    const coin = response.data;
    const marketData = coin.market_data;

    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      rank: String(marketData.market_cap_rank || 0),
      priceUsd: marketData.current_price?.usd ? String(marketData.current_price.usd) : '0',
      percentChange24Hr: marketData.price_change_percentage_24h ? String(marketData.price_change_percentage_24h) : '0',
      marketCapUsd: marketData.market_cap?.usd ? String(marketData.market_cap.usd) : '0',
      volumeUsd24Hr: marketData.total_volume?.usd ? String(marketData.total_volume.usd) : '0',
      supply: marketData.circulating_supply ? String(marketData.circulating_supply) : '0',
      maxSupply: marketData.max_supply ? String(marketData.max_supply) : null
    };
  } catch (error) {
    console.error(`Error fetching cryptocurrency ${id}:`, error);
    return null;
  }
}

/**
 * Search cryptocurrencies by name or symbol using CoinGecko
 */
export async function searchCryptocurrencies(query: string): Promise<CryptoCurrency[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        query: query
      },
      timeout: 10000
    });

    // Get detailed data for top 10 search results
    const coinIds = response.data.coins.slice(0, 10).map((coin: any) => coin.id);
    
    if (coinIds.length === 0) {
      return [];
    }

    const detailsResponse = await axios.get(`${API_BASE_URL}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        ids: coinIds.join(','),
        order: 'market_cap_desc',
        sparkline: false,
        price_change_percentage: '24h'
      },
      timeout: 10000
    });

    return detailsResponse.data.map((coin: any, index: number) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      rank: String(coin.market_cap_rank || index + 1),
      priceUsd: coin.current_price ? String(coin.current_price) : '0',
      percentChange24Hr: coin.price_change_percentage_24h ? String(coin.price_change_percentage_24h) : '0',
      marketCapUsd: coin.market_cap ? String(coin.market_cap) : '0',
      volumeUsd24Hr: coin.total_volume ? String(coin.total_volume) : '0',
      supply: coin.circulating_supply ? String(coin.circulating_supply) : '0',
      maxSupply: coin.max_supply ? String(coin.max_supply) : null
    }));
  } catch (error) {
    console.error('Error searching cryptocurrencies:', error);
    return [];
  }
}
