import type { WalletProvider } from '../types';

/**
 * Safe provider access with exponential backoff as recommended by Blast Mobile
 * This ensures the wallet provider is fully initialized before use
 */
export function getProvider(): Promise<WalletProvider | null> {
  return new Promise((resolve) => {
    // Always try to connect if ethereum provider exists (Blast Mobile injects this)
    if (window.ethereum) {
      console.log('Ethereum provider detected - attempting connection');
      return resolve(window.ethereum);
    }
    
    console.log('Waiting for Blast Mobile provider...');
    
    // Recursive function with exponential backoff
    function checkForProvider(attempt = 1, delay = 100) {
      setTimeout(() => {
        if (window.ethereum) {
          console.log('Blast provider ready after', attempt, 'attempts');
          resolve(window.ethereum);
        } else if (attempt < 8) { // Increased attempts for better reliability
          const nextDelay = Math.min(delay * 1.5, 2000); // More gradual backoff
          checkForProvider(attempt + 1, nextDelay);
        } else {
          console.log('Provider not detected after maximum attempts - running in view-only mode');
          resolve(null);
        }
      }, delay);
    }

    // Start the recursive check
    checkForProvider();
  });
}

/**
 * Auto-connect to Blast wallet as recommended for mobile dapps
 */
export async function autoConnectWallet(): Promise<string[] | null> {
  try {
    const provider = await getProvider();
    if (!provider) {
      console.error('Blast provider not available for auto-connect.');
      return null;
    }
    
    // Auto-connect request
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      console.log('Auto-connected to account:', accounts[0]);
      
      // Also get the current chain to verify we're on Blast
      try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        console.log('Connected to chain:', chainId);
        
        // Blast Mainnet: 0x13e31 (81457), Blast Sepolia: 0xa0c71fd (168587663)
        if (chainId === '0x13e31' || chainId === '0xa0c71fd') {
          console.log('Connected to Blast network');
        } else {
          console.log('Not on Blast network, chain ID:', chainId);
        }
      } catch (error) {
        console.log('Could not verify chain ID:', error);
      }
      
      return accounts;
    } else {
      console.warn('Auto-connect did not return accounts.');
      return null;
    }
  } catch (error) {
    console.error('Auto-connect failed:', error);
    return null;
  }
}

/**
 * Get Blast network information
 */
export async function getBlastNetworkInfo(): Promise<{ chainId: string; isBlast: boolean } | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;
    
    const chainId = await provider.request({ method: 'eth_chainId' });
    const isBlast = chainId === '0x13e31' || chainId === '0xa0c71fd';
    
    return { chainId, isBlast };
  } catch (error) {
    console.error('Failed to get network info:', error);
    return null;
  }
}

/**
 * Format currency values for display
 */
export function formatCurrency(value: string, decimals = 2): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(decimals)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(decimals)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(decimals)}K`;
  } else {
    return `$${num.toFixed(decimals)}`;
  }
}

/**
 * Format percentage change with color coding
 */
export function formatPercentChange(value: string): { 
  formatted: string; 
  isPositive: boolean 
} {
  const num = parseFloat(value);
  const isPositive = num >= 0;
  const formatted = `${isPositive ? '+' : ''}${num.toFixed(2)}%`;
  
  return { formatted, isPositive };
}
