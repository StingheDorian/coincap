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
 * Smart Search: Comprehensive cryptocurrency search with intelligent fallback
 * 1. First searches loaded data (instant results)
 * 2. If no results found, searches CoinGecko's full database (10,000+ coins)
 * 3. Implements aggressive caching to minimize API calls
 */
export async function searchCryptocurrencies(query: string): Promise<CryptoCurrency[]> {
  try {
    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Smart Search: Returning cached search results for:', query);
      return cached.data;
    }

    // If query is too short, don't search
    if (query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    console.log('Smart Search: Starting search for:', query);
    console.log('Smart Search: Available loaded cryptos:', loadedCryptos.length);

    // Step 1: Filter from already loaded data (instant results)
    // Also check mainDataCache.data as backup
    const availableCryptos = loadedCryptos.length > 0 ? loadedCryptos : (mainDataCache.data || []);
    console.log('Smart Search: Using crypto data source with', availableCryptos.length, 'cryptos');
    
    // Enhanced search logic - prioritize exact matches, then partial matches
    const exactMatches = availableCryptos.filter(crypto => 
      crypto.symbol.toLowerCase() === lowerQuery ||
      crypto.name.toLowerCase() === lowerQuery
    );
    
    const symbolStartMatches = availableCryptos.filter(crypto => 
      crypto.symbol.toLowerCase().startsWith(lowerQuery) &&
      !exactMatches.some(exact => exact.id === crypto.id)
    );
    
    const nameStartMatches = availableCryptos.filter(crypto => 
      crypto.name.toLowerCase().startsWith(lowerQuery) &&
      !exactMatches.some(exact => exact.id === crypto.id) &&
      !symbolStartMatches.some(symbol => symbol.id === crypto.id)
    );
    
    const partialMatches = availableCryptos.filter(crypto => 
      (crypto.name.toLowerCase().includes(lowerQuery) || 
       crypto.symbol.toLowerCase().includes(lowerQuery)) &&
      !exactMatches.some(exact => exact.id === crypto.id) &&
      !symbolStartMatches.some(symbol => symbol.id === crypto.id) &&
      !nameStartMatches.some(name => name.id === crypto.id)
    );
    
    // Combine results in order of relevance
    const localResults = [
      ...exactMatches,
      ...symbolStartMatches,
      ...nameStartMatches,
      ...partialMatches
    ].slice(0, 20);

    console.log(`Smart Search: Found ${localResults.length} local results for "${query}"`);

    // If we found good local results, return them
    if (localResults.length >= 1) { // Lowered threshold from 3 to 1
      console.log(`Smart Search: Returning ${localResults.length} local results`);
      searchCache.set(cacheKey, { data: localResults, timestamp: Date.now() });
      return localResults;
    }

    // If no local data available, return empty results
    if (availableCryptos.length === 0) {
      console.log('Smart Search: No local crypto data available yet');
      return [];
    }

    // Step 2: Only search comprehensive database for very specific cases to avoid rate limits
    console.log('Smart Search: No local results found. Checking if comprehensive search is worth the API call...');
    
    // Only do API search for longer, more specific queries to reduce rate limit hits
    if (query.length < 3) {
      console.log('Smart Search: Query too short for API search, returning empty results');
      return [];
    }

    // Rate limiting check for API search - be more conservative
    const currentTime = Date.now();
    if (currentTime - lastApiCallTime < API_RATE_LIMIT * 1.5) { // 1.5x rate limit for search (9 seconds)
      console.log('Smart Search: Rate limited, returning local results only');
      searchCache.set(cacheKey, { data: localResults, timestamp: Date.now() });
      return localResults;
    }

    try {
      lastApiCallTime = Date.now();
      
      // Use CoinGecko's search endpoint for comprehensive results
      console.log('Smart Search: Making API call to CoinGecko search endpoint');
      const searchResponse = await axios.get(`${API_BASE_URL}/search`, {
        params: { query: query },
        timeout: 10000
      });

      const searchHits = searchResponse.data.coins || [];
      console.log(`Smart Search: API search found ${searchHits.length} potential matches`);
      
      if (searchHits.length === 0) {
        console.log('Smart Search: No results in comprehensive database');
        searchCache.set(cacheKey, { data: localResults, timestamp: Date.now() });
        return localResults;
      }

      // Get detailed market data for the found coins (limit to top 10 to avoid rate limits)
      const coinIds = searchHits.slice(0, 10).map((coin: any) => coin.id).join(',');
      console.log('Smart Search: Fetching market data for:', coinIds);
      
      // Wait a moment to avoid rapid consecutive API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const marketResponse = await axios.get(`${API_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: coinIds,
          order: 'market_cap_desc',
          per_page: 10,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h'
        },
        timeout: 15000
      });

      const comprehensiveResults = marketResponse.data.map((coin: any) => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        rank: String(coin.market_cap_rank || 999),
        priceUsd: coin.current_price ? String(coin.current_price) : '0',
        percentChange24Hr: coin.price_change_percentage_24h ? String(coin.price_change_percentage_24h) : '0',
        marketCapUsd: coin.market_cap ? String(coin.market_cap) : '0',
        volumeUsd24Hr: coin.total_volume ? String(coin.total_volume) : '0',
        supply: coin.circulating_supply ? String(coin.circulating_supply) : '0',
        maxSupply: coin.max_supply ? String(coin.max_supply) : null
      }));

      console.log(`Smart Search: Got ${comprehensiveResults.length} detailed results from API`);

      // Combine local and comprehensive results, prioritizing by market cap
      const combinedResults = [...localResults, ...comprehensiveResults]
        .filter((crypto, index, self) => 
          index === self.findIndex(c => c.id === crypto.id) // Remove duplicates
        )
        .sort((a, b) => {
          const aMarketCap = parseFloat(a.marketCapUsd) || 0;
          const bMarketCap = parseFloat(b.marketCapUsd) || 0;
          return bMarketCap - aMarketCap; // Sort by market cap descending
        })
        .slice(0, 20); // Limit to top 20 results

      console.log(`Smart Search: Final result: ${combinedResults.length} total results (${localResults.length} local + ${comprehensiveResults.length} comprehensive)`);
      
      // Cache the combined results
      searchCache.set(cacheKey, { data: combinedResults, timestamp: Date.now() });
      return combinedResults;

    } catch (apiError: any) {
      console.error('Smart Search: API search failed, using local results:', apiError);
      
      // If API search fails, return local results
      searchCache.set(cacheKey, { data: localResults, timestamp: Date.now() });
      return localResults;
    }

  } catch (error) {
    console.error('Smart Search: Error during search:', error);
    
    // Try to return cached results even if stale, or empty array
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    return cached?.data || [];
  }
}
