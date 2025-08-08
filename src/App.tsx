import { useState, useEffect, useCallback } from 'react';
import './App.css';
import CryptoRow from './components/CryptoRow';
import BottomNavigation from './components/BottomNavigation';
import LoadingSkeleton from './components/LoadingSkeleton';
import WalletConnect from './components/WalletConnect';
import SearchBar from './components/SearchBar';
import { fetchTopCryptocurrencies, searchCryptocurrencies, fetchMissingFavorites } from './services/api';
import { autoConnectWallet } from './utils';
import { getAllWalletBalances, type WalletBalance } from './services/wallet';
import { autoConnectBlastWallet as connectBlastMobile, isBlastMobileEnvironment } from './services/blastMobile';
import type { CryptoCurrency } from './types';

// Debounce utility function
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      callback(...args);
    }, delay);
    
    setDebounceTimer(timer);
  }, [callback, delay, debounceTimer]);
}

function App() {
  const [cryptos, setCryptos] = useState<CryptoCurrency[]>([]);
  const [allCryptos, setAllCryptos] = useState<CryptoCurrency[]>([]); // Store all loaded cryptos
  const [missingFavorites, setMissingFavorites] = useState<CryptoCurrency[]>([]); // Store favorites not in top 250
  const [displayCount, setDisplayCount] = useState(20); // How many to show in home tab
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CryptoCurrency[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullCurrentY, setPullCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Detect Blast Mobile environment and provide user-friendly messaging
  useEffect(() => {
    const isIframe = window !== window.top;
    const hasBlastSDK = typeof (window as any).BlastSDK !== 'undefined';
    const isBlastEnv = isIframe || hasBlastSDK || window.location.href.includes('blast.io');
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    console.log('Environment detected:', { isBlastEnv, isIframe, hasBlastSDK, isIOSDevice });
    
    // Clear any URL hash for better Blast Mobile compatibility
    if (window.location.hash) {
      console.log('Clearing URL hash for better Blast Mobile compatibility');
      window.history.replaceState(null, '', window.location.pathname);
    }
    
    // Set iframe-friendly styles
    if (isIframe) {
      document.body.classList.add('iframe-mode');
      document.documentElement.classList.add('iframe-mode');
      console.log('Added iframe-mode class to body and html');
      
      // Notify parent frame that app is ready
      window.parent?.postMessage({ type: 'APP_READY', source: 'blast-crypto' }, '*');
    } else {
      document.body.classList.remove('iframe-mode');
      document.documentElement.classList.remove('iframe-mode');
    }

    // Show iOS storage limitation notice
    if (isIOSDevice && isBlastEnv) {
      console.log('📱 iOS + Blast Mobile: Favorites will persist during your session but may not survive app closure due to iOS limitations');
      
      // Store the platform info for potential user messaging
      sessionStorage.setItem('platform-info', JSON.stringify({
        isIOSDevice,
        isBlastEnv,
        storageNotice: 'Favorites persist during session but may not survive app closure on iOS'
      }));
    }
  }, []);



  // Simple storage function that works reliably across platforms
  const saveFavorites = useCallback((favoritesSet: Set<string>) => {
    try {
      const favoritesArray = Array.from(favoritesSet);
      const favoritesJson = JSON.stringify(favoritesArray);
      
      // Try localStorage first, fall back to sessionStorage
      try {
        localStorage.setItem('crypto-favorites', favoritesJson);
        console.log('Favorites saved:', favoritesArray.length, 'items');
      } catch (e) {
        console.warn('localStorage failed, using sessionStorage:', e);
        try {
          sessionStorage.setItem('crypto-favorites', favoritesJson);
          console.log('Favorites saved to session storage:', favoritesArray.length, 'items');
        } catch (e2) {
          console.warn('Both storage methods failed:', e2);
        }
      }
      
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, []);

  const loadFavorites = useCallback(() => {
    try {
      let favoritesSet = new Set<string>();
      
      // Try localStorage first, then sessionStorage
      try {
        let savedFavorites = localStorage.getItem('crypto-favorites');
        let loadSource = 'localStorage';
        
        if (!savedFavorites) {
          savedFavorites = sessionStorage.getItem('crypto-favorites');
          loadSource = 'sessionStorage';
        }
        
        if (savedFavorites) {
          const favoritesList: string[] = JSON.parse(savedFavorites);
          favoritesSet = new Set<string>(favoritesList);
          console.log(`Favorites loaded from ${loadSource}:`, favoritesList.length, 'items');
        }
      } catch (e) {
        console.warn('Storage load failed:', e);
      }
      
      // Update state
      if (favoritesSet.size > 0) {
        setFavorites(favoritesSet);
        console.log('✅ Total favorites loaded:', favoritesSet.size);
      }
      
      return favoritesSet;
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return new Set<string>();
    }
  }, []);

  // Simple storage test for debugging
  const testStorage = useCallback(() => {
    console.log('=== Storage Test ===');
    
    try {
      localStorage.setItem('test', 'works');
      const test = localStorage.getItem('test');
      console.log('localStorage:', test === 'works' ? '✅ Works' : '❌ Failed');
      localStorage.removeItem('test');
    } catch (e) {
      console.log('localStorage: ❌ Failed -', e);
    }
    
    try {
      sessionStorage.setItem('test', 'works');
      const test = sessionStorage.getItem('test');
      console.log('sessionStorage:', test === 'works' ? '✅ Works' : '❌ Failed');
      sessionStorage.removeItem('test');
    } catch (e) {
      console.log('sessionStorage: ❌ Failed -', e);
    }
    
    console.log('Current favorites:', Array.from(favorites));
    
    const platformInfo = sessionStorage.getItem('platform-info');
    if (platformInfo) {
      const info = JSON.parse(platformInfo);
      console.log('Platform info:', info);
    }
  }, [favorites]);

  // Expose testStorage globally for debugging in Blast Mobile
  useEffect(() => {
    (window as any).testCryptoStorage = testStorage;
  }, [testStorage]);

  // Load favorites from storage on component mount
  useEffect(() => {
    loadFavorites();
  }, []);

  // Save favorites to storage whenever favorites change (including when cleared)
  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites, saveFavorites]);

  // Load missing favorites (favorites not in top 250) whenever favorites or allCryptos change
  useEffect(() => {
    const loadMissingFavorites = async () => {
      if (favorites.size === 0 || allCryptos.length === 0) {
        console.log('🔍 FAVORITES: No favorites or allCryptos to check, clearing missing favorites');
        setMissingFavorites([]);
        return;
      }

      // Find favorites that are not in the current allCryptos list
      const currentCryptoIds = new Set(allCryptos.map(crypto => crypto.id));
      const missingFavoriteIds = Array.from(favorites).filter(id => !currentCryptoIds.has(id));

      console.log('🔍 FAVORITES: Analysis', {
        totalFavorites: favorites.size,
        allCryptosCount: allCryptos.length,
        currentCryptoIds: Array.from(currentCryptoIds).slice(0, 10), // First 10 for debugging
        allFavoriteIds: Array.from(favorites),
        missingFavoriteIds
      });

      if (missingFavoriteIds.length > 0) {
        console.log(`🔍 FAVORITES: Loading ${missingFavoriteIds.length} missing favorites:`, missingFavoriteIds);
        try {
          const missing = await fetchMissingFavorites(missingFavoriteIds, allCryptos);
          setMissingFavorites(missing);
          console.log(`✅ FAVORITES: Successfully loaded ${missing.length} missing favorites`, missing.map(m => `${m.name} (${m.id})`));
        } catch (error) {
          console.error('❌ FAVORITES: Failed to load missing favorites:', error);
          setMissingFavorites([]);
        }
      } else {
        console.log('✅ FAVORITES: All favorites are in current dataset, no missing favorites to load');
        setMissingFavorites([]);
      }
    };

    loadMissingFavorites();
  }, [favorites, allCryptos]);

  const toggleFavorite = (cryptoId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      
      if (newFavorites.has(cryptoId)) {
        newFavorites.delete(cryptoId);
        console.log(`Removed ${cryptoId} from favorites`);
      } else {
        newFavorites.add(cryptoId);
        console.log(`Added ${cryptoId} to favorites`);
      }
      
      console.log('Current favorites count:', newFavorites.size);
      console.log('All favorites:', Array.from(newFavorites));
      
      return newFavorites;
    });
  };

  useEffect(() => {
    loadCryptocurrencies();
    // Auto-connect to Blast Mobile wallet
    autoConnectBlastWallet();
  }, []);

  // Auto-refresh crypto data every 2 minutes when on home tab (reduced from 30 seconds to avoid rate limiting)
  useEffect(() => {
    if (activeTab !== 'home') return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing cryptocurrency data...');
      loadCryptocurrencies();
    }, 120000); // 2 minutes instead of 30 seconds to avoid 429 errors

    return () => clearInterval(interval);
  }, [activeTab, displayCount]);

  // Update displayed cryptos when displayCount or allCryptos changes
  useEffect(() => {
    if (allCryptos.length > 0) {
      setCryptos(allCryptos.slice(0, displayCount));
    }
  }, [displayCount, allCryptos]);

  const autoConnectBlastWallet = async () => {
    try {
      console.log('🚀 BLAST: Starting Blast Mobile auto-connect...');
      
      // Try Blast Mobile auto-connect first
      let connectedAccount = null;
      
      if (isBlastMobileEnvironment()) {
        console.log('📱 BLAST: Using Blast Mobile auto-connect');
        connectedAccount = await connectBlastMobile();
      }
      
      // Fallback to standard wallet connect if Blast Mobile fails
      if (!connectedAccount) {
        console.log('🔄 FALLBACK: Using standard auto-connect');
        const accounts = await autoConnectWallet();
        if (accounts && accounts.length > 0) {
          connectedAccount = accounts[0];
        }
      }
      
      if (connectedAccount) {
        setWalletAddress(connectedAccount);
        console.log('✅ WALLET: Connected to', connectedAccount);
        
        // Scan wallet for balances (now includes real Blast staking data)
        await scanWalletBalances(connectedAccount);
        
        // Listen for account changes
        if (window.ethereum) {
          window.ethereum.on('accountsChanged', async (accounts: string[]) => {
            if (accounts.length > 0) {
              setWalletAddress(accounts[0]);
              await scanWalletBalances(accounts[0]);
              console.log('Account changed to:', accounts[0]);
            } else {
              setWalletAddress(null);
              setWalletBalances([]);
              console.log('Wallet disconnected');
            }
          });

          window.ethereum.on('chainChanged', (chainId: string) => {
            console.log('Chain changed to:', chainId);
            // Optionally reload or handle chain changes
          });
        }
      }
    } catch (error) {
      console.log('Auto-connect failed, running in view-only mode:', error);
    }
  };

  const scanWalletBalances = async (address: string) => {
    try {
      setIsLoadingWallet(true);
      console.log('Scanning wallet balances and vested positions for:', address);
      const balances = await getAllWalletBalances(address);
      setWalletBalances(balances);
      console.log('Found wallet balances and vested positions:', balances);
    } catch (error) {
      console.error('Error scanning wallet:', error);
      setWalletBalances([]);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // Pull-to-refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTab === 'home') {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeTab === 'home' && pullStartY > 0) {
      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - pullStartY;
      
      if (pullDistance > 0 && window.scrollY === 0) {
        setPullCurrentY(pullDistance);
        setIsPulling(pullDistance > 80);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (activeTab === 'home' && isPulling && !isPullRefreshing) {
      setIsPullRefreshing(true);
      
      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      
      try {
        await loadCryptocurrencies();
        if (walletAddress) {
          await scanWalletBalances(walletAddress);
        }
      } finally {
        setIsPullRefreshing(false);
        setIsPulling(false);
        setPullStartY(0);
        setPullCurrentY(0);
      }
    } else {
      setIsPulling(false);
      setPullStartY(0);
      setPullCurrentY(0);
    }
  };

  // Scroll to top when switching to home tab
  useEffect(() => {
    if (activeTab === 'home') {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [activeTab]);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const contentContainer = document.querySelector('.content-container');
    
    const handleScroll = () => {
      if (contentContainer) {
        setShowScrollTop(contentContainer.scrollTop > 300);
      }
    };

    if (contentContainer) {
      contentContainer.addEventListener('scroll', handleScroll);
      return () => contentContainer.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab]);

  // Smooth scroll to top function
  const scrollToTop = () => {
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
      contentContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
    }
  };

    const loadCryptocurrencies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTopCryptocurrencies(250); // Load 250 cryptocurrencies for better coverage
      setAllCryptos(data); // Store all cryptocurrencies
      setCryptos(data.slice(0, displayCount)); // Show current displayCount in the main view
      
      // Scroll to top after data loads to ensure #1 is visible
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Error loading cryptocurrencies:', err);
      
      // More specific error messages for different scenarios
      if (err.message?.includes('429') || err.response?.status === 429) {
        setError('API rate limit reached. Data will auto-refresh in a few minutes, or try manual refresh later.');
      } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        setError('Network issue detected. Please check your connection and try again.');
      } else {
        setError('Failed to load cryptocurrency data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchCryptocurrencies(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search function - waits 800ms for comprehensive search
  const debouncedSearch = useDebounce(performSearch, 800);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      debouncedSearch(query);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      console.log('Manual refresh triggered...');
      await loadCryptocurrencies();
      
      // Also refresh wallet balances if connected
      if (walletAddress) {
        await scanWalletBalances(walletAddress);
      }
    } catch (err) {
      console.error('Manual refresh failed:', err);
    }
  };

  const loadMoreCryptos = () => {
    const newCount = Math.min(displayCount + 20, allCryptos.length);
    setDisplayCount(newCount);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="screen-content">
            <div className="search-container">
              <SearchBar
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search 250+ cryptocurrencies..."
                isLoading={loading || isSearching}
              />
              {isSearching && searchQuery && (
                <div style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.8rem', 
                  color: '#98DD28',
                  textAlign: 'center',
                  background: 'rgba(152, 221, 40, 0.1)',
                  border: '1px solid rgba(152, 221, 40, 0.3)',
                  borderRadius: '4px',
                  margin: '0.5rem 1rem'
                }}>
                  🔍 Smart Search: Searching cryptocurrency database...
                </div>
              )}
            </div>
            
            <div className="content-area">
              {error && (
                <div style={{ padding: '1rem' }}>
                  <div className="error" style={{ 
                    background: 'rgba(255, 107, 107, 0.1)', 
                    border: '1px solid rgba(255, 107, 107, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>⚠️ Connection Issue</div>
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</div>
                    <button 
                      onClick={loadCryptocurrencies}
                      disabled={loading}
                      style={{ 
                        padding: '0.5rem 1rem', 
                        background: loading ? '#666' : '#FCFC03', 
                        color: '#11140C', 
                        border: '2px solid #75835D',
                        borderRadius: '4px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {loading ? 'Loading...' : 'Try Again'}
                    </button>
                  </div>
                </div>
              )}
              
              {loading ? (
                <LoadingSkeleton count={10} />
              ) : (
                <>
                  <div className="crypto-list">
                    {(searchQuery ? searchResults : cryptos).map((crypto) => (
                      <CryptoRow 
                        key={crypto.id} 
                        crypto={crypto} 
                        isFavorite={favorites.has(crypto.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                    {searchQuery && searchResults.length === 0 && !isSearching && !loading && (
                      <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ color: '#FCFC03', marginBottom: '0.5rem' }}>
                          No cryptocurrencies found for "{searchQuery}"
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#9BA885' }}>
                          Searched through 250+ top cryptocurrencies
                        </div>
                      </div>
                    )}
                    {searchQuery && searchResults.length > 0 && (
                      <div style={{ 
                        padding: '0.5rem 1rem', 
                        fontSize: '0.8rem', 
                        color: '#98DD28',
                        textAlign: 'center',
                        background: 'rgba(152, 221, 40, 0.1)',
                        borderBottom: '1px solid rgba(152, 221, 40, 0.3)'
                      }}>
                        📊 Found {searchResults.length} results for "{searchQuery}"
                      </div>
                    )}
                  </div>
                  
                  {/* Load More Button - only show when not searching and there are more cryptos to load */}
                  {!searchQuery && displayCount < allCryptos.length && (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        onClick={loadMoreCryptos}
                        style={{ 
                          padding: '0.75rem 1.5rem', 
                          background: 'linear-gradient(135deg, #FCFC03 0%, #98DD28 100%)', 
                          color: '#11140C', 
                          border: '2px solid #75835D',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(252, 252, 3, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        Load More ({allCryptos.length - displayCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 'favorites':
        const favoriteCryptos = allCryptos.filter(crypto => favorites.has(crypto.id));
        const allFavoriteCryptos = [...favoriteCryptos, ...missingFavorites];
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isIframe = window !== window.top;
        
        // Debug logging for favorites display
        console.log('🎯 FAVORITES DISPLAY:', {
          favoritesSet: Array.from(favorites),
          favoriteCryptos: favoriteCryptos.map(c => `${c.name} (${c.id})`),
          missingFavorites: missingFavorites.map(c => `${c.name} (${c.id})`),
          allFavoriteCryptos: allFavoriteCryptos.map(c => `${c.name} (${c.id})`),
          allCryptosCount: allCryptos.length
        });
        
        return (
          <div className="screen-content no-search">
            <div className="content-area">
              {favorites.size === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#FCFC03' }}>
                  <h2 style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    ★ Favorites
                  </h2>
                  <p style={{ marginBottom: '1rem' }}>No favorites yet!</p>
                  <p style={{ fontSize: '0.875rem', opacity: '0.8' }}>
                    Tap the star (★) next to any cryptocurrency to add it to your favorites.
                  </p>
                  {isIOSDevice && isIframe && (
                    <div style={{ 
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: 'linear-gradient(135deg, rgba(152, 221, 40, 0.1) 0%, rgba(252, 252, 3, 0.05) 100%)',
                      border: '2px solid rgba(152, 221, 40, 0.3)',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      color: '#98DD28',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>📱</span>
                        <strong>iOS Note</strong>
                      </div>
                      <div style={{ lineHeight: 1.4 }}>
                        Favorites will persist during your session but may not survive app closure due to iOS limitations.
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, #98DD28, transparent)',
                        opacity: 0.6
                      }}></div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #404833' }}>
                    <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FCFC03' }}>
                      ★ My Favorites ({favorites.size})
                    </h2>
                    {isIOSDevice && isIframe && (
                      <div style={{ 
                        marginTop: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: 'linear-gradient(135deg, rgba(152, 221, 40, 0.15) 0%, rgba(252, 252, 3, 0.08) 100%)',
                        border: '1px solid rgba(152, 221, 40, 0.4)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#98DD28',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <span style={{ fontSize: '1rem' }}>📱</span>
                        <span>iOS: Favorites saved for this session</span>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent, #98DD28, transparent)',
                          opacity: 0.7
                        }}></div>
                      </div>
                    )}
                  </div>
                  <div className="crypto-list">
                    {allFavoriteCryptos.map((crypto) => (
                      <CryptoRow 
                        key={crypto.id} 
                        crypto={crypto} 
                        isFavorite={true}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                    {favoriteCryptos.length === 0 && favorites.size > 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#FCFC03', opacity: '0.7' }}>
                        Some of your favorite cryptocurrencies are not in the current dataset.
                        <br />
                        <small>Try refreshing to load updated data.</small>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 'portfolio':
        return (
          <div className="screen-content no-search">
            <div className="content-area">
              {/* Wallet Holdings Section */}
              {walletAddress ? (
                <>
                  <div style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #404833', background: 'linear-gradient(135deg, #11140C 0%, #404833 100%)' }}>
                    <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FCFC03' }}>
                      💰 Portfolio Overview
                    </h2>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: '0.9' }}>
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </div>
                    {isLoadingWallet && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#98DD28' }}>
                        🔍 Scanning wallet & vested positions...
                      </div>
                    )}
                  </div>
                
                {walletBalances.length > 0 ? (
                  <>
                    {/* Separate regular tokens from vested tokens */}
                    {(() => {
                      const regularTokens = walletBalances.filter(balance => !balance.isVested);
                      const vestedTokens = walletBalances.filter(balance => balance.isVested);
                      
                      return (
                        <>
                          {/* Regular Token Holdings */}
                          {regularTokens.length > 0 && (
                            <>
                              <div style={{ padding: '1rem', borderBottom: '1px solid #404833', background: 'rgba(252, 252, 3, 0.05)' }}>
                                <h3 style={{ margin: '0', color: '#FCFC03', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  💎 Active Holdings ({regularTokens.length})
                                </h3>
                              </div>
                              <div className="crypto-list">
                                {regularTokens.map((balance) => (
                                  <div key={balance.contractAddress} className="crypto-row" style={{ borderLeft: '3px solid #98DD28' }}>
                                    <div className="crypto-rank">💎</div>
                                    
                                    <div className="crypto-icon" style={{ background: balance.isNative ? 'linear-gradient(135deg, #627EEA 0%, #404833 100%)' : 'linear-gradient(135deg, #FCFC03 0%, #75835D 100%)' }}>
                                      {balance.symbol.slice(0, 2)}
                                    </div>
                                    
                                    <div className="crypto-info">
                                      <div className="crypto-name">{balance.name}</div>
                                      <div className="crypto-symbol">{balance.symbol}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#98DD28', marginTop: '0.25rem' }}>
                                        Holdings: {balance.balance} {balance.symbol}
                                      </div>
                                    </div>
                                    
                                    <div className="crypto-price-section">
                                      <div className="crypto-price">
                                        {parseFloat(balance.balance).toFixed(6)}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#98DD28' }}>
                                        {balance.isNative ? 'Native Token' : 'ERC-20 Token'}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* Vested/Locked Token Holdings */}
                          {vestedTokens.length > 0 && (
                            <>
                              <div style={{ padding: '1rem', borderBottom: '1px solid #404833', background: 'rgba(152, 221, 40, 0.1)' }}>
                                <h3 style={{ margin: '0', color: '#98DD28', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  🔒 Vested & Staked Positions ({vestedTokens.length})
                                </h3>
                                <div style={{ fontSize: '0.8rem', color: '#9BA885', marginTop: '0.25rem' }}>
                                  Locked tokens, staking rewards, and vesting schedules
                                </div>
                              </div>
                              <div className="crypto-list">
                                {vestedTokens.map((balance) => (
                                  <div key={balance.contractAddress} className="crypto-row" style={{ 
                                    borderLeft: '3px solid #FCFC03',
                                    background: 'linear-gradient(135deg, rgba(152, 221, 40, 0.1) 0%, rgba(252, 252, 3, 0.05) 100%)'
                                  }}>
                                    <div className="crypto-rank" style={{ color: '#FCFC03' }}>🔒</div>
                                    
                                    <div className="crypto-icon" style={{ 
                                      background: 'linear-gradient(135deg, #FCFC03 0%, #98DD28 100%)',
                                      border: '2px solid #98DD28'
                                    }}>
                                      {balance.symbol.slice(0, 2)}
                                    </div>
                                    
                                    <div className="crypto-info">
                                      <div className="crypto-name" style={{ color: '#FCFC03' }}>{balance.name}</div>
                                      <div className="crypto-symbol" style={{ color: '#98DD28' }}>{balance.symbol}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#98DD28', marginTop: '0.25rem' }}>
                                        {balance.vestingInfo ? (
                                          <>
                                            Total: {balance.vestingInfo.totalAmount} | 
                                            Claimable: {balance.vestingInfo.claimableAmount}
                                          </>
                                        ) : (
                                          `Locked: ${balance.balance} ${balance.symbol}`
                                        )}
                                      </div>
                                      {balance.vestingInfo && (
                                        <div style={{ fontSize: '0.7rem', color: '#9BA885', marginTop: '0.25rem' }}>
                                          Schedule: {balance.vestingInfo.unlockSchedule}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="crypto-price-section">
                                      <div className="crypto-price" style={{ color: '#FCFC03' }}>
                                        {parseFloat(balance.balance).toFixed(6)}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#98DD28' }}>
                                        Vested/Locked
                                      </div>
                                      {balance.vestingInfo && balance.vestingInfo.claimableAmount !== '0.000000' && (
                                        <div style={{ 
                                          fontSize: '0.7rem', 
                                          color: '#FCFC03', 
                                          marginTop: '0.25rem',
                                          padding: '0.25rem',
                                          background: 'rgba(252, 252, 3, 0.2)',
                                          borderRadius: '4px',
                                          border: '1px solid #FCFC03'
                                        }}>
                                          ⚡ Claimable: {parseFloat(balance.vestingInfo.claimableAmount).toFixed(4)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : isLoadingWallet ? (
                  <LoadingSkeleton count={3} />
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#9BA885', fontSize: '0.875rem' }}>
                    No token balances or vested positions found
                  </div>
                )}
                </>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#FCFC03' }}>
                  <h2 style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    💰 Portfolio
                  </h2>
                  <p style={{ marginBottom: '1rem' }}>Connect your wallet to view holdings</p>
                  <p style={{ fontSize: '0.875rem', opacity: '0.8' }}>
                    Your crypto portfolio, including vested tokens and staking positions, will appear here once connected.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'wallet':
        return (
          <div className="screen-content no-search">
            <div className="content-area" style={{ padding: '1rem' }}>
              <div style={{ textAlign: 'center', color: '#FCFC03' }}>
                <h2 style={{ margin: '1rem 0' }}>💰 Wallet</h2>
                {walletAddress ? (
                <div>
                  <div style={{ 
                    background: 'rgba(252, 252, 3, 0.1)', 
                    padding: '1.5rem', 
                    borderRadius: '12px', 
                    margin: '1rem 0',
                    border: '1px solid #404833'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ color: '#98DD28', fontSize: '1.1rem' }}>🟢 Connected to Blast</span>
                    </div>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      wordBreak: 'break-all',
                      color: '#FCFC03'
                    }}>
                      {walletAddress}
                    </div>
                  </div>
                  
                  {walletBalances.length > 0 && (
                    <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                      <h3 style={{ color: '#FCFC03', marginBottom: '1rem' }}>Token Balances</h3>
                      {walletBalances.map((balance) => (
                        <div key={balance.symbol} style={{
                          background: 'rgba(64, 72, 51, 0.3)',
                          padding: '1rem',
                          margin: '0.5rem 0',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ color: '#FCFC03' }}>{balance.symbol}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#9BA885' }}>{balance.name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#FCFC03', fontWeight: 'bold' }}>
                              {parseFloat(balance.balance).toFixed(6)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '1rem', color: '#9BA885' }}>No wallet connected</p>
                  <div style={{ marginTop: '1rem' }}>
                    <WalletConnect onWalletChange={setWalletAddress} />
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div style={{ width: '44px' }}></div> {/* Spacer for balance */}
        <h1>CryptoCap</h1>
        <button 
          className="refresh-button"
          onClick={handleRefresh}
          disabled={loading}
          title={loading ? 'Refreshing...' : 'Refresh data'}
          style={{
            animation: loading ? 'spin 1s linear infinite' : 'none'
          }}
        >
          {loading ? '🔄' : '↻'}
        </button>
      </header>

      <main 
        className="content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: activeTab === 'home' && isPulling ? `translateY(${Math.min(pullCurrentY * 0.5, 40)}px)` : 'none',
          transition: isPullRefreshing ? 'transform 0.3s ease' : 'none'
        }}
      >
        {/* Pull-to-refresh indicator */}
        {activeTab === 'home' && (isPulling || isPullRefreshing) && (
          <div style={{
            position: 'absolute',
            top: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            color: '#FCFC03',
            fontSize: '2rem',
            animation: isPullRefreshing ? 'spin 1s linear infinite' : 'none'
          }}>
            {isPullRefreshing ? '🔄' : isPulling ? '⬇️' : ''}
          </div>
        )}
        {renderContent()}
      </main>

      <BottomNavigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Scroll to top button */}
      {showScrollTop && (
        <button 
          className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
          onClick={scrollToTop}
          title="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default App;
