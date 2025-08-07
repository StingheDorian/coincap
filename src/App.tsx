import { useState, useEffect, useCallback } from 'react';
import './App.css';
import CryptoRow from './components/CryptoRow';
import BottomNavigation from './components/BottomNavigation';
import LoadingSkeleton from './components/LoadingSkeleton';
import WalletConnect from './components/WalletConnect';
import SearchBar from './components/SearchBar';
import { fetchTopCryptocurrencies, searchCryptocurrencies } from './services/api';
import { autoConnectWallet, formatCurrency } from './utils';
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

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('crypto-favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    localStorage.setItem('crypto-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const toggleFavorite = (cryptoId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(cryptoId)) {
        newFavorites.delete(cryptoId);
      } else {
        newFavorites.add(cryptoId);
      }
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
      const data = await fetchTopCryptocurrencies(250); // Load more cryptocurrencies for better search
      setAllCryptos(data); // Store all 250 cryptocurrencies
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

  // Debounced search function - waits 500ms after user stops typing
  const debouncedSearch = useDebounce(performSearch, 500);

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
                placeholder="Search cryptocurrencies..."
                isLoading={loading || isSearching}
              />
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
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#FCFC03' }}>
                        No cryptocurrencies found for "{searchQuery}"
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
                    {favoriteCryptos.map((crypto) => (
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
        const portfolioCryptos = allCryptos.filter(crypto => favorites.has(crypto.id));
        return (
          <div className="screen-content no-search">
            <div className="content-area">
              {/* Wallet Holdings Section */}
              {walletAddress && (
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
                
                {/* Separator */}
                <div style={{ height: '1rem', background: '#404833', borderTop: '1px solid #75835D', borderBottom: '1px solid #75835D' }}></div>
              </>
            )}

            {/* Watchlist Section - Always show independently */}
            {favorites.size === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#FCFC03' }}>
                <h2 style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  ⭐ Watchlist
                </h2>
                <p style={{ marginBottom: '1rem' }}>Your watchlist is empty!</p>
                <p style={{ fontSize: '0.875rem', opacity: '0.8' }}>
                  Add cryptocurrencies to your favorites (★) to track them here.
                </p>
              </div>
            ) : (
              <>
                <div style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #404833', background: 'linear-gradient(135deg, #11140C 0%, #404833 100%)' }}>
                  <h2 style={{ margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FCFC03' }}>
                    ⭐ Watchlist ({favorites.size} assets)
                  </h2>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: '0.9' }}>
                    Your favorite cryptocurrencies
                  </div>
                </div>
                <div className="crypto-list">
                  {portfolioCryptos.map((crypto) => (
                    <div key={crypto.id} className="crypto-row" style={{ borderLeft: '3px solid #FCFC03' }}>
                      <div className="crypto-rank">#{crypto.rank}</div>
                      
                      <div className="crypto-icon">
                        {crypto.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      
                      <div className="crypto-info">
                        <div className="crypto-name">{crypto.name}</div>
                        <div className="crypto-symbol">{crypto.symbol}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9BA885', marginTop: '0.25rem' }}>
                          Market Cap: {formatCurrency(crypto.marketCapUsd, 0)}
                        </div>
                      </div>
                      
                      <div className="crypto-price-section">
                        <div className="crypto-price">
                          {formatCurrency(crypto.priceUsd, crypto.priceUsd.includes('.') && parseFloat(crypto.priceUsd) < 1 ? 6 : 2)}
                        </div>
                        <div className={`percentage-change ${parseFloat(crypto.percentChange24Hr) >= 0 ? 'positive' : 'negative'}`}>
                          {parseFloat(crypto.percentChange24Hr) >= 0 ? '+' : ''}{parseFloat(crypto.percentChange24Hr).toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9BA885', marginTop: '0.25rem' }}>
                          24h Vol: {formatCurrency(crypto.volumeUsd24Hr, 0)}
                        </div>
                      </div>

                      <button 
                        className="favorite-button favorited"
                        onClick={() => toggleFavorite(crypto.id)}
                        title="Remove from watchlist"
                      >
                        ★
                      </button>
                    </div>
                  ))}
                  {portfolioCryptos.length === 0 && favorites.size > 0 && (
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
        <h1>CryptoCap</h1>
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
