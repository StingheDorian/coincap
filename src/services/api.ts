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
 * Supports fetching more than 250 coins by making multiple paginated requests
 */
export async function fetchTopCryptocurrencies(
  limit = 100, 
  onProgress?: (progress: string) => void
): Promise<CryptoCurrency[]> {
  // Check cache first
  const currentTime = Date.now();
  if (mainDataCache.data && currentTime - mainDataCache.timestamp < MAIN_CACHE_DURATION) {
    console.log('Returning cached cryptocurrency data');
    loadedCryptos = mainDataCache.data;
    onProgress?.('Using cached data');
    return mainDataCache.data.slice(0, limit);
  }

  // Rate limiting - ensure we don't make requests too frequently
  if (currentTime - lastApiCallTime < API_RATE_LIMIT) {
    console.log('Rate limited - using cached data or waiting');
    if (mainDataCache.data) {
      loadedCryptos = mainDataCache.data;
      onProgress?.('Rate limited - using cached data');
      return mainDataCache.data.slice(0, limit);
    }
    // If no cached data, wait for rate limit
    const waitTime = API_RATE_LIMIT - (currentTime - lastApiCallTime);
    onProgress?.(`Waiting ${Math.ceil(waitTime / 1000)}s for rate limit...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastApiCallTime = Date.now();
  const maxRetries = 3;
  let lastError: any;
  
  // Calculate how many pages we need (CoinGecko max is 250 per page)
  const perPage = 250;
  const totalPages = Math.ceil(limit / perPage);
  const allCryptos: CryptoCurrency[] = [];
  
  onProgress?.(`Loading ${limit} cryptocurrencies from ${totalPages} page${totalPages > 1 ? 's' : ''}...`);
  
  for (let page = 1; page <= totalPages; page++) {
    const currentPageLimit = page === totalPages ? limit - (page - 1) * perPage : perPage;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        onProgress?.(`Fetching page ${page}/${totalPages} (${allCryptos.length}/${limit} loaded)`);
        console.log(`Fetching cryptocurrency data page ${page}/${totalPages} (attempt ${attempt}/${maxRetries})`);
        
        // Add a small delay between pages to be respectful to the API
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const response = await axios.get(`${API_BASE_URL}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: currentPageLimit,
            page: page,
            sparkline: false,
            price_change_percentage: '24h'
          },
          timeout: 20000 // Increased timeout to 20 seconds
        });

        console.log(`Successfully fetched page ${page}/${totalPages} with ${response.data.length} cryptocurrencies`);
        
        const pageCryptos = response.data.map((coin: any, index: number) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          rank: String((page - 1) * perPage + index + 1),
          priceUsd: coin.current_price ? String(coin.current_price) : '0',
          percentChange24Hr: coin.price_change_percentage_24h ? String(coin.price_change_percentage_24h) : '0',
          marketCapUsd: coin.market_cap ? String(coin.market_cap) : '0',
          volumeUsd24Hr: coin.total_volume ? String(coin.total_volume) : '0',
          supply: coin.circulating_supply ? String(coin.circulating_supply) : '0',
          maxSupply: coin.max_supply ? String(coin.max_supply) : null
        }));

        allCryptos.push(...pageCryptos);
        break; // Success, break out of retry loop
        
      } catch (error: any) {
        lastError = error;
        console.error(`Error fetching page ${page} (attempt ${attempt}/${maxRetries}):`, error);
        
        // If it's a 429 error (rate limit), wait longer before retry
        if (error.response?.status === 429) {
          const delay = attempt * 15000; // 15s, 30s, 45s for rate limit errors
          onProgress?.(`Rate limited on page ${page} - waiting ${Math.ceil(delay / 1000)}s...`);
          console.log(`Rate limited on page ${page} - waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt < maxRetries) {
          const delay = attempt * 3000; // 3s, 6s, 9s for other errors
          onProgress?.(`Retrying page ${page} in ${Math.ceil(delay / 1000)}s...`);
          console.log(`Retrying page ${page} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we failed to get this page after all retries, break and return what we have
    if (allCryptos.length < (page - 1) * perPage + 1) {
      console.error(`Failed to fetch page ${page}, returning ${allCryptos.length} cryptocurrencies`);
      onProgress?.(`Failed to load page ${page}, got ${allCryptos.length} total`);
      break;
    }
  }

  if (allCryptos.length > 0) {
    // Cache the successful response
    mainDataCache.data = allCryptos;
    mainDataCache.timestamp = Date.now();
    
    // Store for client-side filtering
    loadedCryptos = allCryptos;
    onProgress?.(`Successfully loaded ${allCryptos.length} cryptocurrencies!`);
    console.log(`Successfully loaded ${allCryptos.length} cryptocurrencies total`);
    return allCryptos;
  }
  
  // If all retries failed but we have cached data, return it
  if (mainDataCache.data) {
    console.log('All retries failed, but returning cached data');
    loadedCryptos = mainDataCache.data;
    onProgress?.('Using cached data after API failure');
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
