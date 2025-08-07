import { getProvider } from '../utils';

// Common ERC-20 tokens on Blast network
const BLAST_TOKENS = {
  // Native tokens
  ETH: '0x0000000000000000000000000000000000000000', // Native ETH
  BLAST: '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad', // BLAST token
  
  // Popular tokens (add more as needed)
  USDB: '0x4300000000000000000000000000000000000003', // USD Blast
  WETH: '0x4300000000000000000000000000000000000004', // Wrapped ETH
};

export interface WalletBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  contractAddress: string;
  isNative: boolean;
}

/**
 * Get ETH balance from wallet
 */
export async function getETHBalance(walletAddress: string): Promise<WalletBalance | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;

    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [walletAddress, 'latest']
    });

    // Convert from hex to decimal and from wei to ETH
    const balanceInWei = BigInt(balance);
    const balanceInETH = Number(balanceInWei) / Math.pow(10, 18);

    return {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: balanceInETH.toFixed(6),
      decimals: 18,
      contractAddress: BLAST_TOKENS.ETH,
      isNative: true
    };
  } catch (error) {
    console.error('Error getting ETH balance:', error);
    return null;
  }
}

/**
 * Get ERC-20 token balance
 */
export async function getTokenBalance(
  walletAddress: string, 
  tokenAddress: string
): Promise<WalletBalance | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;

    // Get token decimals
    const decimalsData = await provider.request({
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: '0x313ce567' // decimals() function selector
      }, 'latest']
    });

    // Get token symbol
    const symbolData = await provider.request({
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: '0x95d89b41' // symbol() function selector
      }, 'latest']
    });

    // Get token name
    const nameData = await provider.request({
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: '0x06fdde03' // name() function selector
      }, 'latest']
    });

    // Get balance
    const balanceData = await provider.request({
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: '0x70a08231' + walletAddress.slice(2).padStart(64, '0') // balanceOf(address) function
      }, 'latest']
    });

    const decimals = parseInt(decimalsData, 16);
    const balance = BigInt(balanceData);
    const balanceInToken = Number(balance) / Math.pow(10, decimals);

    // Decode symbol and name (simple hex to string conversion)
    const symbol = hexToString(symbolData);
    const name = hexToString(nameData);

    return {
      symbol: symbol || 'UNKNOWN',
      name: name || 'Unknown Token',
      balance: balanceInToken.toFixed(6),
      decimals,
      contractAddress: tokenAddress,
      isNative: false
    };
  } catch (error) {
    console.error('Error getting token balance:', error);
    return null;
  }
}

/**
 * Get all wallet balances (ETH + known tokens)
 */
export async function getAllWalletBalances(walletAddress: string): Promise<WalletBalance[]> {
  const balances: WalletBalance[] = [];

  try {
    // Get ETH balance
    const ethBalance = await getETHBalance(walletAddress);
    if (ethBalance && parseFloat(ethBalance.balance) > 0) {
      balances.push(ethBalance);
    }

    // Get token balances for known Blast tokens
    const tokenPromises = Object.entries(BLAST_TOKENS)
      .filter(([tokenSymbol]) => tokenSymbol !== 'ETH') // Skip ETH as we already got it
      .map(async ([, address]) => {
        const balance = await getTokenBalance(walletAddress, address);
        if (balance && parseFloat(balance.balance) > 0.000001) { // Only include if balance > 0.000001
          return balance;
        }
        return null;
      });

    const tokenBalances = await Promise.all(tokenPromises);
    tokenBalances.forEach(balance => {
      if (balance) balances.push(balance);
    });

  } catch (error) {
    console.error('Error getting wallet balances:', error);
  }

  return balances;
}

/**
 * Simple hex to string converter for contract calls
 */
function hexToString(hex: string): string {
  try {
    // Remove 0x prefix and decode hex
    const cleanHex = hex.replace('0x', '');
    let result = '';
    
    // Skip the first 64 characters (32 bytes) which contain length info
    const dataStart = 128; // 64 chars for offset + 64 chars for length
    
    for (let i = dataStart; i < cleanHex.length; i += 2) {
      const hexChar = cleanHex.substr(i, 2);
      const charCode = parseInt(hexChar, 16);
      if (charCode === 0) break; // Stop at null terminator
      if (charCode >= 32 && charCode <= 126) { // Only printable ASCII
        result += String.fromCharCode(charCode);
      }
    }
    
    return result.trim();
  } catch (error) {
    return '';
  }
}
