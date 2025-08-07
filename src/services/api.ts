import axios from 'axios';
import type { CryptoCurrency } from '../types';

// Use CoinGecko API which has excellent CORS support and is free
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Rate limiting and caching
let lastApiCallTime = 0;
const API_RATE_LIMIT = 6000; // 6 seconds between main API calls to avoid 429 errors
const searchCache = new Map<string, { data: CryptoCurrency[]; timestamp: number }>();
const CACHE_DURATION = 600000; // 10 minute cache for search results
const mainDataCache = { data: null as CryptoCurrency[] | null, timestamp: 0 };
const MAIN_CACHE_DURATION = 120000; // 2 minute cache for main data

// Store the loaded cryptocurrencies for client-side filtering
let loadedCryptos: CryptoCurrency[] = [];

/**
 * Fetch top cryptocurrencies from CoinGecko API (free, no API key required)
 * Implements aggressive caching and rate limiting to avoid 429 errors
 */
export async function fetchTopCryptocurrencies(limit = 100): Promise<CryptoCurrency[]> {
  // Check cache first
  const currentTime = Date.now();
  if (mainDataCache.data && currentTime - mainDataCache.timestamp < MAIN_CACHE_DURATION) {
    console.log('Returning cached cryptocurrency data');
    loadedCryptos = mainDataCache.data;
    return mainDataCache.data.slice(0, limit);
  }

  // Rate limiting - ensure we don't make requests too frequently
  if (currentTime - lastApiCallTime < API_RATE_LIMIT) {
    console.log('Rate limited - using cached data or waiting');
    if (mainDataCache.data) {
      loadedCryptos = mainDataCache.data;
      return mainDataCache.data.slice(0, limit);
    }
    // If no cached data, wait for rate limit
    const waitTime = API_RATE_LIMIT - (currentTime - lastApiCallTime);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastApiCallTime = Date.now();
  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching real cryptocurrency data from CoinGecko... (attempt ${attempt}/${maxRetries})`);
      const response = await axios.get(`${API_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h'
        },
        timeout: 20000 // Increased timeout to 20 seconds
      });

      console.log('Successfully fetched real cryptocurrency data!');
      const cryptos = response.data.map((coin: any, index: number) => ({
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

      // Cache the successful response
      mainDataCache.data = cryptos;
      mainDataCache.timestamp = Date.now();
      
      // Store for client-side filtering
      loadedCryptos = cryptos;
      return cryptos;
    } catch (error: any) {
      lastError = error;
      console.error(`Error fetching cryptocurrency data (attempt ${attempt}/${maxRetries}):`, error);
      
      // If it's a 429 error (rate limit), wait longer before retry
      if (error.response?.status === 429) {
        const delay = attempt * 10000; // 10s, 20s, 30s for rate limit errors
        console.log(`Rate limited - waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt < maxRetries) {
        const delay = attempt * 3000; // 3s, 6s, 9s for other errors
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If all retries failed but we have cached data, return it
  if (mainDataCache.data) {
    console.log('All retries failed, but returning cached data');
    loadedCryptos = mainDataCache.data;
    return mainDataCache.data.slice(0, limit);
  }
  
  console.error('All retry attempts failed and no cached data available:', lastError);
  throw new Error('Failed to fetch cryptocurrency data after multiple attempts. Please check your internet connection or try again later.');
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
 * Search cryptocurrencies by filtering the already loaded data (client-side search)
 * This avoids API rate limits and provides instant results
 */
export async function searchCryptocurrencies(query: string): Promise<CryptoCurrency[]> {
  try {
    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached search results for:', query);
      return cached.data;
    }

    // If query is too short, don't search
    if (query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    console.log('Filtering cryptocurrencies for:', query);

    // First try to filter from already loaded data (instant results)
    const filteredResults = loadedCryptos.filter(crypto => 
      crypto.name.toLowerCase().includes(lowerQuery) ||
      crypto.symbol.toLowerCase().includes(lowerQuery) ||
      crypto.symbol.toLowerCase().startsWith(lowerQuery) ||
      crypto.name.toLowerCase().startsWith(lowerQuery)
    ).slice(0, 20); // Limit to top 20 results

    // Always cache and return local results - avoid API calls that cause 429 errors
    searchCache.set(cacheKey, { data: filteredResults, timestamp: Date.now() });
    console.log('Successfully filtered and cached results for:', query);
    return filteredResults;

  } catch (error) {
    console.error('Error searching cryptocurrencies:', error);
    
    // Try to return cached results even if stale, or empty array
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    return cached?.data || [];
  }
}
