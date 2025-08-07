# CoinCap - Crypto Tracker for Blast Mobile

A mobile-optimized cryptocurrency tracking app designed to run within the Blast Mobile PWA environment. Built with React, TypeScript, and Vite.

## Features

- 📱 **Mobile-First Design**: Optimized for touch interfaces with bottom navigation
- 🔗 **Blast Mobile Integration**: Auto-connects to Blast wallet with iframe support  
- 📊 **Real-time Crypto Data**: Displays live cryptocurrency prices, market caps, and 24h changes
- 🔍 **Search Functionality**: Search and discover cryptocurrencies
- 💰 **Wallet Integration**: Connects with Blast Mobile's injected wallet provider
- ⚡ **Fast Performance**: Built with Vite for optimal loading speed

## Blast Mobile Integration

This app is specifically designed for the Blast Mobile environment and includes:

- **iframe-ffi library** integration for Blast Mobile compatibility
- **Auto-connect wallet** functionality using Blast's injected provider
- **Content Security Policy** configuration for iframe embedding
- **Mobile-optimized UI/UX** following Blast Mobile best practices

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Mock Data Mode

The app includes comprehensive mock cryptocurrency data that displays automatically if the API is unavailable. This ensures the app always works and provides a great demonstration experience with realistic data including:

- Top 10 cryptocurrencies (Bitcoin, Ethereum, Tether, BNB, Solana, etc.)
- Current market prices and 24-hour changes
- Market capitalizations and trading volumes
- Search functionality across all mock data

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── CryptoCard.tsx   # Individual crypto display card
│   ├── BottomNavigation.tsx # Mobile bottom navigation
│   ├── LoadingSkeleton.tsx  # Loading state component
│   └── WalletConnect.tsx    # Blast wallet integration
├── services/            # API and external services
│   └── api.ts          # CoinCap API integration
├── types/              # TypeScript type definitions
│   └── index.ts        # Crypto data and wallet types
├── utils/              # Utility functions
│   └── index.ts        # Wallet utils and formatters
├── App.tsx             # Main application component
├── App.css             # Mobile-optimized styles
└── main.tsx           # Application entry point
```

### API Integration

The app uses the [CoinCap API](https://coincap.io/) for cryptocurrency data:
- Real-time price data
- Market capitalization
- 24-hour volume and price changes
- Search functionality

### Testing in Blast Mobile

1. **Local Testing**: Run the development server and submit your local URL (`http://localhost:3000`) to Blast TestFlight
2. **Remote Testing**: Deploy to a staging environment with HTTPS and submit the URL to Blast TestFlight
3. **Production**: Submit your production HTTPS URL to Blast Mobile for app store listing

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in both browser and Blast Mobile environment
5. Submit a pull request

## License

MIT License

## Resources

- [Blast Mobile Integration Guide](https://docs.blast.io/mobile/integration)
- [CoinCap API Documentation](https://docs.coincap.io/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
