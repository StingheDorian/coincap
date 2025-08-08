import type { WalletBalance } from './wallet';

/**
 * Mock vested tokens for demonstration purposes
 * This can be used for testing the UI when actual vesting contracts don't have data
 */
export function getMockVestedTokens(walletAddress: string): WalletBalance[] {
  // Generate some mock vested tokens for demo
  const mockVestedTokens: WalletBalance[] = [
    {
      symbol: 'vBLAST',
      name: 'Vested BLAST (Team)',
      balance: '15000.000000',
      decimals: 18,
      contractAddress: '0x1234567890123456789012345678901234567890',
      isNative: false,
      isVested: true,
      vestingInfo: {
        totalAmount: '50000.000000',
        claimedAmount: '35000.000000',
        claimableAmount: '5000.000000',
        vestingStart: Date.now() - 86400000 * 180, // Started 180 days ago
        vestingEnd: Date.now() + 86400000 * 180, // Ends in 180 days
        unlockSchedule: 'Linear (Daily)'
      }
    },
    {
      symbol: 'BLAST PTS',
      name: 'Blast Points (Staked)',
      balance: '125000',
      decimals: 18,
      contractAddress: '0x2fc95838c71e76ec69ff817983BFf17c710F34E0',
      isNative: false,
      isVested: true,
      vestingInfo: {
        totalAmount: '125000',
        claimedAmount: '0',
        claimableAmount: '125000',
        vestingStart: Date.now() - 86400000 * 30, // Started 30 days ago
        vestingEnd: Date.now() + 86400000 * 60, // Ends in 60 days
        unlockSchedule: 'Continuous Rewards'
      }
    },
    {
      symbol: 'yETH',
      name: 'Yield ETH Position',
      balance: '2.500000',
      decimals: 18,
      contractAddress: '0x4300000000000000000000000000000000000002',
      isNative: false,
      isVested: true,
      vestingInfo: {
        totalAmount: '2.500000',
        claimedAmount: '0.150000',
        claimableAmount: '0.025000',
        vestingStart: Date.now() - 86400000 * 7, // Started 7 days ago
        vestingEnd: Date.now() + 86400000 * 30, // Ends in 30 days
        unlockSchedule: 'Yield Generation'
      }
    }
  ];

  // Only return mock data for demo purposes - you can remove this in production
  // or add logic to determine when to show mock data
  const isDemoMode = walletAddress.toLowerCase().includes('demo') || 
                     process.env.NODE_ENV === 'development';
  
  return isDemoMode ? mockVestedTokens : [];
}

/**
 * Check if we should show mock vesting data
 * This could be based on environment, wallet address, or user preferences
 */
export function shouldShowMockVesting(walletAddress: string): boolean {
  // Show mock data in development or for demo wallets
  return process.env.NODE_ENV === 'development' || 
         walletAddress.toLowerCase().includes('demo') ||
         walletAddress === '0x0000000000000000000000000000000000000000';
}
