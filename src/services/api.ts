import axios from 'axios';
import type { CryptoCurrency } from '../types';

// Use CoinGecko API which has excellent CORS support and is free
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Rate limiting for search requests
let lastSearchTime = 0;
const SEARCH_RATE_LIMIT = 2000; // 2 seconds between search requests (more conservative)
const searchCache = new Map<string, { data: CryptoCurrency[]; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minute cache (longer cache)

// Store the loaded cryptocurrencies for client-side filtering
let loadedCryptos: CryptoCurrency[] = [];

/**
 * Fetch top cryptocurrencies from CoinGecko API (free, no API key required)
 */
export async function fetchTopCryptocurrencies(limit = 100): Promise<CryptoCurrency[]> {
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
        timeout: 15000 // Increased timeout
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

      // Store for client-side filtering
      loadedCryptos = cryptos;
      return cryptos;
    } catch (error) {
      lastError = error;
      console.error(`Error fetching cryptocurrency data (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('All retry attempts failed:', lastError);
  throw new Error('Failed to fetch cryptocurrency data after multiple attempts. Please check your internet connection.');
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

    // If we have good local results, return them
    if (filteredResults.length >= 3) {
      // Cache the results
      searchCache.set(cacheKey, { data: filteredResults, timestamp: Date.now() });
      console.log('Successfully filtered and cached results for:', query);
      return filteredResults;
    }

    // If we have few or no local results, try API search for more comprehensive results
    const currentTime = Date.now();
    if (currentTime - lastSearchTime < SEARCH_RATE_LIMIT) {
      console.log('Rate limited - returning local results only');
      // Still cache and return local results even if few
      searchCache.set(cacheKey, { data: filteredResults, timestamp: currentTime });
      return filteredResults;
    }

    // Try API search for more comprehensive results
    console.log('Searching API for more comprehensive results:', query);
    lastSearchTime = currentTime;

    try {
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: {
          query: query
        },
        timeout: 8000
      });

      // Get detailed data for top 10 search results
      const coinIds = response.data.coins.slice(0, 10).map((coin: any) => coin.id);
      
      if (coinIds.length === 0) {
        // Return local results if API has nothing
        searchCache.set(cacheKey, { data: filteredResults, timestamp: currentTime });
        return filteredResults;
      }

      const detailsResponse = await axios.get(`${API_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: coinIds.join(','),
          order: 'market_cap_desc',
          sparkline: false,
          price_change_percentage: '24h'
        },
        timeout: 8000
      });

      const apiResults = detailsResponse.data.map((coin: any, index: number) => ({
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

      // Combine local and API results, removing duplicates
      const combinedResults = [...filteredResults];
      apiResults.forEach((apiResult: CryptoCurrency) => {
        if (!combinedResults.find(local => local.id === apiResult.id)) {
          combinedResults.push(apiResult);
        }
      });

      const finalResults = combinedResults.slice(0, 20);
      searchCache.set(cacheKey, { data: finalResults, timestamp: currentTime });
      console.log('Successfully combined local and API search results for:', query);
      return finalResults;

    } catch (apiError) {
      console.error('API search failed, returning local results:', apiError);
      // Cache and return local results if API fails
      searchCache.set(cacheKey, { data: filteredResults, timestamp: currentTime });
      return filteredResults;
    }
  } catch (error) {
    console.error('Error searching cryptocurrencies:', error);
    
    // Try to return cached results even if stale, or empty array
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    return cached?.data || [];
  }
}
