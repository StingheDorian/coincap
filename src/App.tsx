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

  // Detect Blast Mobile environment
  useEffect(() => {
    const isIframe = window !== window.top;
    const hasBlastSDK = typeof (window as any).BlastSDK !== 'undefined';
    const isBlastEnv = isIframe || hasBlastSDK || window.location.href.includes('blast.io');
    
    console.log('Blast Mobile detected:', isBlastEnv, { isIframe, hasBlastSDK });
    
    // Set iframe-friendly styles
    if (isIframe) {
      document.body.classList.add('iframe-mode');
      document.documentElement.classList.add('iframe-mode'); // Also add to html element
      console.log('Added iframe-mode class to body and html');
      console.log('Body classes:', document.body.className);
      
      // Notify parent frame that app is ready
      window.parent?.postMessage({ type: 'APP_READY', source: 'blast-crypto' }, '*');
    } else {
      // Ensure classes are removed when not in iframe
      document.body.classList.remove('iframe-mode');
      document.documentElement.classList.remove('iframe-mode');
      console.log('Not in iframe, removed iframe-mode classes');
    }

    // Add global function for manual testing
    (window as any).toggleIframeMode = () => {
      document.body.classList.toggle('iframe-mode');
      console.log('Manually toggled iframe mode. Body classes:', document.body.className);
    };
  }, []);

  // Enhanced storage functions for iframe/mobile environments with URL persistence for iOS
  const saveFavorites = useCallback((favoritesSet: Set<string>) => {
    try {
      const favoritesArray = Array.from(favoritesSet);
      const favoritesJson = JSON.stringify(favoritesArray);
      
      // 1. Save to URL hash for iOS persistence (works even when localStorage is cleared)
      try {
        if (favoritesArray.length > 0) {
          const encodedFavorites = encodeURIComponent(favoritesJson);
          const newHash = `#favorites=${encodedFavorites}`;
          
          // Update URL without triggering page reload
          if (window.location.hash !== newHash) {
            window.history.replaceState(null, '', newHash);
            console.log('Favorites saved to URL:', favoritesArray.length, 'items');
          }
        } else {
          // Clear hash if no favorites
          if (window.location.hash.includes('favorites=')) {
            window.history.replaceState(null, '', window.location.pathname);
            console.log('Cleared favorites from URL (empty)');
          }
        }
      } catch (e) {
        console.warn('URL hash save failed:', e);
      }
      
      // 2. Try traditional storage methods for faster access
      let saveSuccess = false;
      let storageMethod = '';
      
      try {
        localStorage.setItem('crypto-favorites', favoritesJson);
        console.log('Favorites saved to localStorage:', favoritesArray.length, 'items');
        saveSuccess = true;
        storageMethod = 'localStorage';
      } catch (e) {
        console.warn('localStorage failed, trying sessionStorage:', e);
        try {
          sessionStorage.setItem('crypto-favorites', favoritesJson);
          saveSuccess = true;
          storageMethod = 'sessionStorage';
        } catch (e2) {
          console.warn('sessionStorage also failed:', e2);
        }
      }
      
      // 3. Backup storage
      try {
        localStorage.setItem('crypto-favorites-backup', favoritesJson);
      } catch (e) {
        console.warn('Backup storage failed:', e);
      }
      
      // 4. Save metadata about storage limitations (especially for iOS)
      if (saveSuccess) {
        try {
          const metadata = {
            storageMethod,
            timestamp: Date.now(),
            isIOSDevice: /iPad|iPhone|iPod/.test(navigator.userAgent),
            inIframe: window.location !== window.parent.location,
            userAgent: navigator.userAgent,
            urlPersistence: true // New flag to indicate URL persistence is active
          };
          localStorage.setItem('crypto-favorites-meta', JSON.stringify(metadata));
          
          // If this is iOS in an iframe, log the solution
          if (metadata.isIOSDevice && metadata.inIframe) {
            console.log('🍎 iOS + iframe detected: Using URL persistence for favorites! Favorites will survive app closure.');
          }
        } catch (e) {
          console.warn('Could not save metadata:', e);
        }
      }
      
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, []);

  const loadFavorites = useCallback(() => {
    try {
      let favoritesSet = new Set<string>();
      let loadSource = '';
      
      // 1. First priority: Load from URL hash (iOS-safe persistence)
      try {
        const hash = window.location.hash;
        if (hash.includes('favorites=')) {
          const encodedFavorites = hash.split('favorites=')[1].split('&')[0]; // Handle multiple hash params
          const decodedFavorites = decodeURIComponent(encodedFavorites);
          const favoritesList: string[] = JSON.parse(decodedFavorites);
          
          if (Array.isArray(favoritesList) && favoritesList.length > 0) {
            favoritesSet = new Set<string>(favoritesList);
            loadSource = 'URL hash';
            console.log('Favorites loaded from URL hash:', favoritesList.length, 'items', favoritesList);
          }
        }
      } catch (e) {
        console.warn('URL hash load failed:', e);
      }
      
      // 2. Fallback: Load from localStorage/sessionStorage
      if (favoritesSet.size === 0) {
        try {
          let savedFavorites = localStorage.getItem('crypto-favorites');
          loadSource = 'localStorage';
          
          if (!savedFavorites) {
            savedFavorites = sessionStorage.getItem('crypto-favorites');
            loadSource = 'sessionStorage';
          }
          
          // 3. Last resort: backup storage
          if (!savedFavorites) {
            savedFavorites = localStorage.getItem('crypto-favorites-backup');
            loadSource = 'backup storage';
          }
          
          if (savedFavorites) {
            const favoritesList: string[] = JSON.parse(savedFavorites);
            favoritesSet = new Set<string>(favoritesList);
            console.log(`Favorites loaded from ${loadSource}:`, favoritesList.length, 'items', favoritesList);
            
            // If loaded from storage but not in URL, sync to URL for future iOS persistence
            if (loadSource !== 'URL hash' && favoritesSet.size > 0) {
              console.log('Syncing favorites to URL for iOS persistence...');
              // Use setTimeout to avoid setState during render
              setTimeout(() => saveFavorites(favoritesSet), 100);
            }
          }
        } catch (e) {
          console.warn('Storage load failed:', e);
        }
      }
      
      // 4. Update state and return
      if (favoritesSet.size > 0) {
        setFavorites(favoritesSet);
        console.log(`✅ Total favorites loaded from ${loadSource}:`, favoritesSet.size);
      }
      
      return favoritesSet;
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return new Set<string>();
    }
  }, [saveFavorites]);

  // Test storage functionality for debugging (now includes URL persistence testing)
  const testStorage = useCallback(() => {
    console.log('=== Enhanced Storage Test for Blast Mobile (with URL persistence) ===');
    
    try {
      // Test localStorage
      localStorage.setItem('test-storage', 'localStorage-works');
      const localTest = localStorage.getItem('test-storage');
      console.log('localStorage test:', localTest === 'localStorage-works' ? '✅ WORKS' : '❌ FAILED');
      localStorage.removeItem('test-storage');
    } catch (e) {
      console.log('localStorage test: ❌ FAILED -', e);
    }
    
    try {
      // Test sessionStorage
      sessionStorage.setItem('test-storage', 'sessionStorage-works');
      const sessionTest = sessionStorage.getItem('test-storage');
      console.log('sessionStorage test:', sessionTest === 'sessionStorage-works' ? '✅ WORKS' : '❌ FAILED');
      sessionStorage.removeItem('test-storage');
    } catch (e) {
      console.log('sessionStorage test: ❌ FAILED -', e);
    }
    
    // Test URL hash persistence
    try {
      const testFavorites = ['bitcoin', 'ethereum'];
      const testJson = JSON.stringify(testFavorites);
      const encodedTest = encodeURIComponent(testJson);
      const testHash = `#favorites=${encodedTest}`;
      
      // Save to URL
      window.history.replaceState(null, '', testHash);
      
      // Read back from URL
      const currentHash = window.location.hash;
      if (currentHash.includes('favorites=')) {
        const extractedEncoded = currentHash.split('favorites=')[1];
        const extractedDecoded = decodeURIComponent(extractedEncoded);
        const extractedFavorites = JSON.parse(extractedDecoded);
        const urlTest = JSON.stringify(extractedFavorites) === testJson;
        console.log('URL hash persistence test:', urlTest ? '✅ WORKS' : '❌ FAILED');
        
        // Restore original hash
        if (favorites.size > 0) {
          const originalFavorites = JSON.stringify(Array.from(favorites));
          const originalEncoded = encodeURIComponent(originalFavorites);
          window.history.replaceState(null, '', `#favorites=${originalEncoded}`);
        } else {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        console.log('URL hash persistence test: ❌ FAILED - could not set hash');
      }
    } catch (e) {
      console.log('URL hash persistence test: ❌ FAILED -', e);
    }
    
    // Test current favorites
    const currentFavorites = Array.from(favorites);
    console.log('Current favorites in memory:', currentFavorites);
    
    // Check URL favorites
    try {
      const hash = window.location.hash;
      if (hash.includes('favorites=')) {
        const encodedFavorites = hash.split('favorites=')[1].split('&')[0];
        const decodedFavorites = decodeURIComponent(encodedFavorites);
        const urlFavorites = JSON.parse(decodedFavorites);
        console.log('Current favorites in URL:', urlFavorites);
      } else {
        console.log('No favorites found in URL hash');
      }
    } catch (e) {
      console.log('Could not read favorites from URL:', e);
    }
    
    // Force reload favorites to test the loading system
    const reloadedFavorites = loadFavorites();
    console.log('Reloaded favorites from storage:', Array.from(reloadedFavorites));
    
    // iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const inIframe = window.location !== window.parent.location;
    console.log('🍎 iOS device:', isIOS ? 'YES' : 'NO');
    console.log('🖼️ In iframe:', inIframe ? 'YES' : 'NO');
    console.log('💾 URL persistence recommended:', (isIOS && inIframe) ? 'YES (iOS + iframe)' : 'NO (storage should work)');
    
    console.log('=== End Enhanced Storage Test ===');
  }, [favorites, loadFavorites]);

  // Expose testStorage globally for debugging in Blast Mobile
  useEffect(() => {
    (window as any).testCryptoStorage = testStorage;
    console.log('Debug: window.testCryptoStorage() available for storage testing');
  }, [testStorage]);

  // Load favorites from storage on component mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Save favorites to storage whenever favorites change
  useEffect(() => {
    if (favorites.size > 0) {
      saveFavorites(favorites);
    }
  }, [favorites, saveFavorites]);

  // Load missing favorites (favorites not in top 250) whenever favorites or allCryptos change
  useEffect(() => {
    const loadMissingFavorites = async () => {
      if (favorites.size === 0 || allCryptos.length === 0) {
        setMissingFavorites([]);
        return;
      }

      // Find favorites that are not in the current allCryptos list
      const currentCryptoIds = new Set(allCryptos.map(crypto => crypto.id));
      const missingFavoriteIds = Array.from(favorites).filter(id => !currentCryptoIds.has(id));

      if (missingFavoriteIds.length > 0) {
        console.log(`Loading ${missingFavoriteIds.length} missing favorites:`, missingFavoriteIds);
        try {
          const missing = await fetchMissingFavorites(missingFavoriteIds, allCryptos);
          setMissingFavorites(missing);
          console.log(`Successfully loaded ${missing.length} missing favorites`);
        } catch (error) {
          console.error('Failed to load missing favorites:', error);
          setMissingFavorites([]);
        }
      } else {
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
      
      // Immediately save to storage for better persistence in iframe environments
      saveFavorites(newFavorites);
      
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
      const accounts = await autoConnectWallet();
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        console.log('Auto-connected to Blast wallet:', accounts[0]);
        
        // Scan wallet for balances
        await scanWalletBalances(accounts[0]);
        
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
      console.log('Scanning wallet balances for:', address);
      const balances = await getAllWalletBalances(address);
      setWalletBalances(balances);
      console.log('Found wallet balances:', balances);
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
                </div>
              ) : (
                <>
                  <div style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #404833' }}>
                    <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FCFC03' }}>
                      ★ My Favorites ({favorites.size})
                    </h2>
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
                      💰 Wallet Holdings
                    </h2>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: '0.9' }}>
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </div>
                    {isLoadingWallet && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#98DD28' }}>
                        🔍 Scanning wallet...
                      </div>
                    )}
                  </div>
                
                {walletBalances.length > 0 ? (
                  <div className="crypto-list">
                    {walletBalances.map((balance) => (
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
                ) : isLoadingWallet ? (
                  <LoadingSkeleton count={3} />
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#9BA885', fontSize: '0.875rem' }}>
                    No token balances found or balances are too small to display
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
                    Your crypto portfolio will appear here once connected.
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
