import { getProvider } from '../utils';
import { getMockVestedTokens, shouldShowMockVesting } from './mockVesting';
import { getAllBlastStakingPositions, isBlastMobileEnvironment } from './blastMobile';

// Common ERC-20 tokens on Blast network
const BLAST_TOKENS = {
  // Native tokens
  ETH: '0x0000000000000000000000000000000000000000', // Native ETH
  BLAST: '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad', // BLAST token
  
  // Popular tokens (add more as needed)
  USDB: '0x4300000000000000000000000000000000000003', // USD Blast
  WETH: '0x4300000000000000000000000000000000000004', // Wrapped ETH
};

// Blast staking and vesting contracts
const BLAST_VESTING_CONTRACTS = {
  // Blast Points staking
  BLAST_POINTS_STAKING: '0x2fc95838c71e76ec69ff817983BFf17c710F34E0',
  
  // Blast token vesting contracts (these are examples - you'll need actual addresses)
  BLAST_TEAM_VESTING: '0x1234567890123456789012345678901234567890',
  BLAST_COMMUNITY_VESTING: '0x2345678901234567890123456789012345678901',
  
  // Yield farming contracts
  BLAST_ETH_YIELD: '0x4300000000000000000000000000000000000002',
  BLAST_USDB_YIELD: '0x4300000000000000000000000000000000000001',
};

export interface WalletBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  contractAddress: string;
  isNative: boolean;
  isVested?: boolean; // For locked/staked tokens
  vestingInfo?: VestingInfo;
}

export interface VestingInfo {
  totalAmount: string;
  claimedAmount: string;
  claimableAmount: string;
  vestingStart: number;
  vestingEnd: number;
  unlockSchedule: string; // e.g., "Linear" or "Cliff + Linear"
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
 * Get vested/locked token information for a specific contract
 */
export async function getVestedTokenBalance(
  walletAddress: string,
  contractAddress: string,
  tokenSymbol: string,
  tokenName: string
): Promise<WalletBalance | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;

    // Standard vesting contract function signatures
    const getCurrentBalanceSelector = '0x70a08231'; // balanceOf(address)
    const getTotalVestedSelector = '0x6fb32c4b'; // Common vesting contract method
    const getClaimableSelector = '0x402914f5'; // Common claimable amount method

    // Get current balance in vesting contract
    const balanceData = await provider.request({
      method: 'eth_call',
      params: [{
        to: contractAddress,
        data: getCurrentBalanceSelector + walletAddress.slice(2).padStart(64, '0')
      }, 'latest']
    });

    const balance = BigInt(balanceData || '0x0');
    
    if (balance === BigInt(0)) {
      return null; // No vested tokens
    }

    // Try to get additional vesting info (may fail if contract doesn't support these methods)
    let vestingInfo: VestingInfo | undefined;
    
    try {
      // Attempt to get total vested amount
      const totalVestedData = await provider.request({
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: getTotalVestedSelector + walletAddress.slice(2).padStart(64, '0')
        }, 'latest']
      });
      
      // Attempt to get claimable amount
      const claimableData = await provider.request({
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: getClaimableSelector + walletAddress.slice(2).padStart(64, '0')
        }, 'latest']
      });

      const totalVested = BigInt(totalVestedData || '0x0');
      const claimable = BigInt(claimableData || '0x0');
      const claimed = totalVested - balance;

      vestingInfo = {
        totalAmount: (Number(totalVested) / Math.pow(10, 18)).toFixed(6),
        claimedAmount: (Number(claimed) / Math.pow(10, 18)).toFixed(6),
        claimableAmount: (Number(claimable) / Math.pow(10, 18)).toFixed(6),
        vestingStart: 0, // Would need contract-specific logic
        vestingEnd: 0, // Would need contract-specific logic
        unlockSchedule: 'Linear' // Default assumption
      };
    } catch (e) {
      console.warn('Could not fetch detailed vesting info for', contractAddress);
    }

    const balanceInToken = Number(balance) / Math.pow(10, 18); // Assume 18 decimals for most tokens

    return {
      symbol: tokenSymbol,
      name: tokenName,
      balance: balanceInToken.toFixed(6),
      decimals: 18,
      contractAddress,
      isNative: false,
      isVested: true,
      vestingInfo
    };
  } catch (error) {
    console.error('Error getting vested token balance:', error);
    return null;
  }
}

/**
 * Scan for potential staking positions across multiple possible contracts
 * This is a more aggressive scan for any contracts holding user tokens
 */
/**
 * Placeholder for future Blast Mobile staking integration
 * TODO: Implement proper Blast Mobile API integration for real staking positions
 */
export async function scanForStakingPositions(_walletAddress: string): Promise<WalletBalance[]> {
  // Remove fake staking detection - this was creating fake "weird staked amounts"
  console.log('🔍 STAKING: Skipping generic contract scanning - need Blast Mobile API integration');
  return [];
}

/**
 * Get staked token balance from official Blast staking contracts
 */
export async function getStakedTokenBalance(
  walletAddress: string,
  stakingContract: string,
  tokenSymbol: string,
  tokenName: string
): Promise<WalletBalance | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;

    // Check balance in staking contract
    const balanceData = await provider.request({
      method: 'eth_call',
      params: [{
        to: stakingContract,
        data: '0x70a08231' + walletAddress.slice(2).padStart(64, '0') // balanceOf(address)
      }, 'latest']
    });

    const balance = BigInt(balanceData || '0x0');
    
    if (balance === BigInt(0)) {
      return null; // No staked tokens
    }

    // Try to get staking rewards/claimable amount
    let claimableAmount = '0';
    try {
      // Common staking contract method for pending rewards
      const rewardsData = await provider.request({
        method: 'eth_call',
        params: [{
          to: stakingContract,
          data: '0xf40f0f52' + walletAddress.slice(2).padStart(64, '0') // pendingRewards(address)
        }, 'latest']
      });
      
      const rewards = BigInt(rewardsData || '0x0');
      claimableAmount = (Number(rewards) / Math.pow(10, 18)).toFixed(6);
    } catch (e) {
      // Some contracts might not have this method
      console.log('Could not fetch rewards for staking contract:', stakingContract);
    }

    const balanceInToken = Number(balance) / Math.pow(10, 18); // Assume 18 decimals

    return {
      symbol: `s${tokenSymbol}`, // Prefix with 's' for staked
      name: `Staked ${tokenName}`,
      balance: balanceInToken.toFixed(6),
      decimals: 18,
      contractAddress: stakingContract,
      isNative: false,
      isVested: true, // Treat staked tokens as vested since they're locked
      vestingInfo: {
        totalAmount: balanceInToken.toFixed(6),
        claimedAmount: '0',
        claimableAmount: claimableAmount,
        vestingStart: Date.now() - 86400000, // Unknown start time, assume recent
        vestingEnd: Date.now() + 86400000 * 365, // Assume long-term staking
        unlockSchedule: 'Stakeable (can unstake anytime)'
      }
    };
  } catch (error) {
    console.error('Error getting staked token balance:', error);
    return null;
  }
}

/**
 * Get Blast Points balance (special case for Blast ecosystem)
 */
export async function getBlastPointsBalance(walletAddress: string): Promise<WalletBalance | null> {
  try {
    const provider = await getProvider();
    if (!provider) return null;

    // Blast Points are tracked differently - this is a simplified example
    // In reality, you'd need to call the actual Blast Points API or contract
    
    // For demonstration, let's check if the user has any Blast Points staked
    const pointsStakingContract = BLAST_VESTING_CONTRACTS.BLAST_POINTS_STAKING;
    
    const balanceData = await provider.request({
      method: 'eth_call',
      params: [{
        to: pointsStakingContract,
        data: '0x70a08231' + walletAddress.slice(2).padStart(64, '0') // balanceOf
      }, 'latest']
    });

    const balance = BigInt(balanceData || '0x0');
    
    if (balance === BigInt(0)) {
      return null;
    }

    const balanceInPoints = Number(balance) / Math.pow(10, 18);

    return {
      symbol: 'BLAST PTS',
      name: 'Blast Points (Staked)',
      balance: balanceInPoints.toFixed(0), // Points are usually whole numbers
      decimals: 18,
      contractAddress: pointsStakingContract,
      isNative: false,
      isVested: true,
      vestingInfo: {
        totalAmount: balanceInPoints.toFixed(0),
        claimedAmount: '0',
        claimableAmount: balanceInPoints.toFixed(0),
        vestingStart: Date.now() - 86400000, // Example: started yesterday
        vestingEnd: Date.now() + 86400000 * 30, // Example: ends in 30 days
        unlockSchedule: 'Continuous'
      }
    };
  } catch (error) {
    console.error('Error getting Blast Points balance:', error);
    return null;
  }
}
export async function getAllWalletBalances(walletAddress: string): Promise<WalletBalance[]> {
  const balances: WalletBalance[] = [];

  try {
    console.log('🔍 WALLET: Starting comprehensive balance scan for', walletAddress);
    
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

    // Get REAL Blast Mobile staking and vesting positions
    console.log('🚀 BLAST: Fetching real staking/vesting positions...');
    try {
      const blastStakingPositions = await getAllBlastStakingPositions(walletAddress);
      if (blastStakingPositions.length > 0) {
        console.log('✅ BLAST: Found', blastStakingPositions.length, 'real staking/vesting positions');
        balances.push(...blastStakingPositions);
      } else {
        console.log('📊 BLAST: No real staking/vesting positions found');
      }
    } catch (error) {
      console.error('❌ BLAST: Error fetching real staking positions:', error);
      
      // Fallback: Try basic Blast Points detection
      console.log('� BLAST: Trying fallback Blast Points detection...');
      const blastPointsBalance = await getBlastPointsBalance(walletAddress);
      if (blastPointsBalance) {
        balances.push(blastPointsBalance);
        console.log('✅ BLAST FALLBACK: Found Blast Points balance');
      }
    }

    // Add mock vesting data for demonstration in development (if no real data found)
    const hasRealVesting = balances.some(b => b.isVested);
    if (!hasRealVesting && shouldShowMockVesting(walletAddress)) {
      const mockVesting = getMockVestedTokens(walletAddress);
      balances.push(...mockVesting);
      console.log('🎭 DEMO: Added mock vesting data for demonstration:', mockVesting.length, 'positions');
    }

    // Check if running in Blast Mobile for better logging
    const isBlastEnv = isBlastMobileEnvironment();
    console.log(`📱 ENVIRONMENT: ${isBlastEnv ? 'Blast Mobile' : 'Standalone'} - Found ${balances.length} total positions`);

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
