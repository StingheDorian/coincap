import { getProvider } from '../utils';
import { getMockVestedTokens, shouldShowMockVesting } from './mockVesting';

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

// Official Blast staking contracts from Blast documentation
const BLAST_STAKING_CONTRACTS = {
  // Official yield managers from Blast docs
  ETH_YIELD_MANAGER: '0x98078db053902644191f93988341E31289E1C8FE', // ETH Yield Manager (L1)
  USD_YIELD_MANAGER: '0xa230285d5683C74935aD14c446e137c8c8828438', // USD Yield Manager (L1)
  
  // L2 Bridge contracts that might hold staked tokens
  L2_BLAST_BRIDGE: '0x4300000000000000000000000000000000000005', // L2 Blast Bridge
  L2_STANDARD_BRIDGE: '0x4200000000000000000000000000000000000010', // L2 Standard Bridge
  
  // Yield providers
  LIDO_YIELD_PROVIDER: '0x4316A00D31da1313617DbB04fD92F9fF8D1aF7Db', // Lido Yield Provider
  DSR_YIELD_PROVIDER: '0x0733F618118bF420b6b604c969498ecf143681a8', // DSR Yield Provider
  
  // Additional potential staking contracts (these might hold staked positions)
  BLAST_POINTS_STAKING: '0x2fc95838c71e76ec69ff817983BFf17c710F34E0', // Blast Points contract
  
  // Try scanning these L2 contracts for deposits
  L2_CROSS_DOMAIN_MESSENGER: '0x4200000000000000000000000000000000000007',
  L2_TO_L1_MESSAGE_PASSER: '0x4200000000000000000000000000000000000016',
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
export async function scanForStakingPositions(walletAddress: string): Promise<WalletBalance[]> {
  const stakingPositions: WalletBalance[] = [];
  
  console.log('🔍 STAKING SCAN: Starting comprehensive staking scan for wallet:', walletAddress);
  
  try {
    const provider = await getProvider();
    if (!provider) {
      console.log('❌ STAKING SCAN: No provider available');
      return stakingPositions;
    }
    
    console.log('✅ STAKING SCAN: Provider connected, scanning contracts...');

    // Known staking/deposit contract patterns on Blast
    const possibleStakingContracts = [
      // Blast native staking possibilities
      '0x4300000000000000000000000000000000000001', // Blast system contract
      '0x4300000000000000000000000000000000000002', // Blast yield contract (ETH)
      '0x4300000000000000000000000000000000000003', // USDB system contract  
      '0x4300000000000000000000000000000000000004', // WETH system contract
      
      // Blast Points and staking contracts
      '0x2fc95838c71e76ec69ff817983BFf17c710F34E0', // Blast Points staking
      '0x3fc95838c71e76ec69ff817983BFf17c710F34E1', // Alternative Blast contract
      
      // Common DeFi staking pool patterns (these are generic examples)
      '0xA230285d5683C74935aD14c446e137c8c8828438', // Example staking pool
      '0xB230285d5683C74935aD14c446e137c8c8828439', // Example USDB pool
      '0xC230285d5683C74935aD14c446e137c8c882843A', // Example yield farm
      '0xD230285d5683C74935aD14c446e137c8c882843B', // Example liquidity mining
      
      // Blast Mobile specific contracts (these might be different)
      '0x1000000000000000000000000000000000000001', // Potential Blast Mobile staking
      '0x2000000000000000000000000000000000000001', // Potential Blast Mobile yield
      '0x5000000000000000000000000000000000000001', // Potential Earn App contract
      '0x6000000000000000000000000000000000000001', // Potential reward contract
      
      // Additional scanning - let's also check the token contracts themselves
      BLAST_TOKENS.BLAST, // BLAST token contract might track staked balances
      BLAST_TOKENS.USDB,  // USDB contract might track yield positions
      BLAST_TOKENS.WETH,  // WETH contract might have staking
    ];

    // Check each contract for user deposits
    console.log(`🔍 STAKING SCAN: Checking ${possibleStakingContracts.length} potential staking contracts...`);
    
    const contractPromises = possibleStakingContracts.map(async (contractAddress, index) => {
      console.log(`🔍 STAKING SCAN: [${index + 1}/${possibleStakingContracts.length}] Checking contract: ${contractAddress}`);
      
      try {
        // Try different method signatures for staking/deposit contracts
        const methods = [
          '0x70a08231', // balanceOf(address) - most common
          '0x18160ddd', // totalSupply() - might show staked amount
          '0xf7c618c1', // earned(address) - rewards earned
          '0x3d18b912', // getReward() - claimable rewards
          '0xe3161dae', // stakingBalance(address) - specific staking balance
        ];

        for (const methodSig of methods) {
          try {
            console.log(`🔍 STAKING SCAN: Trying method ${methodSig} on contract ${contractAddress}`);
            const data = await provider.request({
              method: 'eth_call',
              params: [{
                to: contractAddress,
                data: methodSig + walletAddress.slice(2).padStart(64, '0')
              }, 'latest']
            });

            const balance = BigInt(data || '0x0');
            console.log(`📊 STAKING SCAN: Contract ${contractAddress} method ${methodSig} returned balance: ${balance.toString()}`);
            
            if (balance > BigInt(0)) {
              const balanceInToken = Number(balance) / Math.pow(10, 18);
              console.log(`🎯 STAKING SCAN: Found non-zero balance! ${balanceInToken} tokens in contract ${contractAddress}`);
              
              // Only include meaningful balances
              if (balanceInToken > 0.000001) {
                console.log(`✅ STAKING SCAN: Balance is significant enough to include (${balanceInToken})`);
                
                // Try to determine token type from contract address
                let tokenSymbol = 'UNKNOWN';
                let tokenName = 'Unknown Staked Token';
                
                if (contractAddress.includes('4300000000000000000000000000000000000001')) {
                  tokenSymbol = 'sBLAST';
                  tokenName = 'Staked BLAST';
                } else if (contractAddress.includes('4300000000000000000000000000000000000003')) {
                  tokenSymbol = 'sUSDB';
                  tokenName = 'Staked USDB';
                } else if (contractAddress.includes('2fc95838c71e76ec69ff817983BFf17c710F34E0')) {
                  tokenSymbol = 'BLAST PTS';
                  tokenName = 'Blast Points (Staked)';
                } else {
                  tokenSymbol = `STAKED-${contractAddress.slice(0, 6)}`;
                  tokenName = `Staked Position (${contractAddress.slice(0, 8)}...)`;
                }

                console.log(`🚀 STAKING SCAN: Creating staking position entry for ${tokenSymbol} (${tokenName}) with balance ${balanceInToken}`);

                return {
                  symbol: tokenSymbol,
                  name: tokenName,
                  balance: balanceInToken.toFixed(6),
                  decimals: 18,
                  contractAddress,
                  isNative: false,
                  isVested: true,
                  vestingInfo: {
                    totalAmount: balanceInToken.toFixed(6),
                    claimedAmount: '0',
                    claimableAmount: balanceInToken.toFixed(6),
                    vestingStart: Date.now() - 86400000,
                    vestingEnd: Date.now() + 86400000 * 365,
                    unlockSchedule: 'Stakeable (method: ' + methodSig + ')'
                  }
                };
              }
            }
          } catch (methodError) {
            console.log(`⚠️ STAKING SCAN: Method ${methodSig} failed on contract ${contractAddress}:`, methodError);
            // Method not supported by this contract, continue
            continue;
          }
        }
      } catch (contractError) {
        console.log(`❌ STAKING SCAN: Contract ${contractAddress} failed completely:`, contractError);
        // Contract doesn't exist or other error, continue
        return null;
      }
      
      console.log(`🔍 STAKING SCAN: No balance found in contract ${contractAddress}`);
      return null;
    });

    console.log(`⏳ STAKING SCAN: Waiting for all ${contractPromises.length} contract checks to complete...`);
    const results = await Promise.all(contractPromises);
    
    results.forEach((result, index) => {
      if (result) {
        console.log(`✅ STAKING SCAN: Adding position from contract check ${index}:`, result);
        stakingPositions.push(result);
      }
    });

    console.log(`🎯 STAKING SCAN: FINAL RESULT - Found ${stakingPositions.length} staking positions total!`);
    
  } catch (error) {
    console.error('Error scanning for staking positions:', error);
  }

  return stakingPositions;
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

    // Get vested/staked token balances
    const vestingPromises = [
      // Check for Blast Points
      getBlastPointsBalance(walletAddress),
      
      // Check for vested BLAST tokens
      getVestedTokenBalance(walletAddress, BLAST_VESTING_CONTRACTS.BLAST_TEAM_VESTING, 'vBLAST', 'Vested BLAST (Team)'),
      getVestedTokenBalance(walletAddress, BLAST_VESTING_CONTRACTS.BLAST_COMMUNITY_VESTING, 'vBLAST', 'Vested BLAST (Community)'),
      
      // Check for yield farming positions
      getVestedTokenBalance(walletAddress, BLAST_VESTING_CONTRACTS.BLAST_ETH_YIELD, 'yETH', 'Yield ETH Position'),
      getVestedTokenBalance(walletAddress, BLAST_VESTING_CONTRACTS.BLAST_USDB_YIELD, 'yUSDB', 'Yield USDB Position'),
      
      // Check for staked tokens in official Blast staking contracts
      getStakedTokenBalance(walletAddress, BLAST_STAKING_CONTRACTS.BLAST_POINTS_STAKING, 'BLAST', 'Staked BLAST'),
      getStakedTokenBalance(walletAddress, BLAST_TOKENS.USDB, 'USDB', 'Staked USDB'),
      getStakedTokenBalance(walletAddress, BLAST_STAKING_CONTRACTS.ETH_YIELD_MANAGER, 'ETH', 'ETH Yield Position'),
      getStakedTokenBalance(walletAddress, BLAST_STAKING_CONTRACTS.USD_YIELD_MANAGER, 'USDB', 'USDB Yield Position'),
      getStakedTokenBalance(walletAddress, BLAST_STAKING_CONTRACTS.L2_BLAST_BRIDGE, 'BLAST', 'BLAST Bridge Position'),
      getStakedTokenBalance(walletAddress, BLAST_STAKING_CONTRACTS.LIDO_YIELD_PROVIDER, 'ETH', 'Lido Staking Position'),
    ];

    const vestingBalances = await Promise.all(vestingPromises);
    vestingBalances.forEach(balance => {
      if (balance) balances.push(balance);
    });

    // Scan for additional staking positions (more aggressive detection)
    try {
      console.log('🚀 WALLET: Starting staking position scan...');
      const stakingPositions = await scanForStakingPositions(walletAddress);
      stakingPositions.forEach(position => {
        // Avoid duplicates - check if we already have this contract address
        const exists = balances.some(b => b.contractAddress === position.contractAddress);
        if (!exists) {
          console.log('✅ WALLET: Adding new staking position to portfolio:', position);
          balances.push(position);
        } else {
          console.log('⚠️ WALLET: Skipping duplicate staking position:', position.contractAddress);
        }
      });
      console.log(`🎯 WALLET: Added ${stakingPositions.length} staking positions to portfolio`);
    } catch (error) {
      console.error('❌ WALLET: Error scanning for staking positions:', error);
    }

    // Add mock vesting data for demonstration in development
    if (shouldShowMockVesting(walletAddress)) {
      const mockVesting = getMockVestedTokens(walletAddress);
      balances.push(...mockVesting);
      console.log('Added mock vesting data for demonstration:', mockVesting.length, 'positions');
    }

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
