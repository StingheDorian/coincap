# Vested Token Integration - Blast Mobile Portfolio

## Overview

The CryptoCap app now supports viewing vested tokens, locked positions, and staking rewards directly in your Blast Mobile portfolio. This provides a comprehensive view of all your crypto assets, including those that are temporarily locked or earning yield.

## Features Added

### 🔒 Vested Token Detection
- **Team Vesting**: View BLAST tokens allocated through team vesting contracts
- **Community Vesting**: Monitor community allocation vesting schedules
- **Yield Positions**: Track ETH and USDB yield farming positions
- **Blast Points**: Display staked Blast Points and earned rewards

### 📊 Enhanced Portfolio View
The portfolio tab now shows two distinct sections:

#### 💎 Active Holdings
- Standard ERC-20 tokens and native ETH
- Immediately available for trading/transfer
- Real-time balance updates

#### 🔒 Vested & Staked Positions
- Locked tokens with vesting schedules
- Staking positions earning rewards
- Claimable amounts highlighted
- Vesting timeline information

### 📋 Vesting Information Display
For each vested position, you can see:
- **Total Amount**: Complete allocation size
- **Current Balance**: Currently locked amount
- **Claimable Amount**: Tokens ready to claim
- **Vesting Schedule**: Linear, cliff, or continuous
- **Timeline**: Start and end dates (when available)

## Technical Implementation

### Contract Integration
The app checks these Blast ecosystem contracts:
- Blast Points Staking: `0x2fc95838c71e76ec69ff817983BFf17c710F34E0`
- Team Vesting Contracts (configurable)
- Community Vesting Contracts (configurable) 
- ETH Yield Positions: `0x4300000000000000000000000000000000000002`
- USDB Yield Positions: `0x4300000000000000000000000000000000000001`

### Mock Data for Development
In development mode, the app shows sample vested positions to demonstrate the UI:
- **15,000 vBLAST** - Team vesting with linear daily unlock
- **125,000 Blast Points** - Staked points earning continuous rewards
- **2.5 yETH** - Yield position generating ETH rewards

## User Experience

### Visual Indicators
- 🔒 **Lock icon** for vested tokens
- 💎 **Diamond icon** for active holdings
- ⚡ **Lightning icon** for claimable amounts
- **Color coding**: Yellow borders for vested, green for active

### Interactive Elements
- **Tap to view details** of vesting schedules
- **Pull-to-refresh** updates all positions
- **Real-time scanning** when wallet connects

### Mobile Optimization
- **Touch-friendly** buttons and information display
- **Responsive layout** adapts to screen size
- **Smooth animations** for loading states
- **Haptic feedback** on refresh actions

## Benefits for Users

### Complete Portfolio View
Users can now see their entire Blast ecosystem exposure in one place:
- Liquid assets for immediate use
- Locked assets building long-term value
- Yield-generating positions
- Staking rewards accumulation

### Better Financial Planning
- **Vesting schedules** help plan future liquidity
- **Claimable amounts** show available rewards
- **Total allocations** provide complete picture
- **Timeline view** assists with decision making

### Blast Ecosystem Integration
- **Native Blast Mobile** support
- **Real contract data** from Blast network
- **Official Blast** styling and UX patterns
- **Seamless wallet** integration

## Security & Privacy

### Contract Interactions
- **Read-only** operations - no signing required
- **Standard ERC-20** interfaces for compatibility
- **Fallback handling** for unsupported contracts
- **Error resilience** maintains app functionality

### Data Protection
- **No personal data** stored externally
- **Local processing** of wallet information
- **Transparent contract** addresses displayed
- **User control** over wallet connection

## Future Enhancements

### Potential Additions
- **Claim functionality** for ready tokens
- **Vesting calendar** view
- **Price integration** for USD values
- **Historical tracking** of claimed amounts
- **Notification system** for unlock events

### Advanced Features
- **Multi-wallet** support
- **Custom vesting** contract addition
- **Export functionality** for records
- **Analytics dashboard** for yield tracking

---

**Ready to explore your complete Blast Mobile portfolio! 🚀**
