# Copilot Instructions for CoinMarketCap Blast Mobile App

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React TypeScript project built with Vite for displaying CoinMarketCap cryptocurrency data within the Blast Mobile PWA environment.

## Key Technologies & Patterns
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: CSS Modules or Tailwind for mobile-first responsive design
- **API Integration**: CoinMarketCap API for cryptocurrency data
- **Blockchain Integration**: Blast Mobile iframe-ffi SDK for wallet connectivity
- **Mobile Optimization**: PWA-ready, touch-friendly UI with bottom navigation

## Development Guidelines
- Follow mobile-first design principles
- Use bottom navigation instead of top/hamburger menus
- Ensure large touch targets (minimum 44px)
- Implement skeleton loading states
- Use lazy loading for images and components
- Optimize for iframe environment (Blast Mobile runs dapps in iframes)
- Handle wallet auto-connect with Blast Mobile's injected provider
- Configure CSP headers for iframe compatibility

## API Integration Notes
- CoinMarketCap API requires API key management
- Implement error handling for rate limits
- Cache data appropriately to reduce API calls
- Handle offline scenarios gracefully

## Blast Mobile Integration
- Include Blast iframe-ffi library in index.html
- Implement optional wallet connection functionality
- Handle EIP-6492 smart account signatures if needed
- Support transaction batching (EIP-5792) for enhanced UX
- Configure Content Security Policy for iframe embedding
- App works fully without wallet connection for viewing crypto data
