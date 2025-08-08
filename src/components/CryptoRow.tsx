import React, { useState, useEffect } from 'react';
import type { CryptoCurrency } from '../types';
import { formatCurrency, formatPercentChange } from '../utils';

interface CryptoRowProps {
  crypto: CryptoCurrency;
  isFavorite?: boolean;
  onToggleFavorite?: (cryptoId: string) => void;
}

const CryptoRow: React.FC<CryptoRowProps> = ({ crypto, isFavorite = false, onToggleFavorite }) => {
  const [previousPrice, setPreviousPrice] = useState<string | null>(null);
  const [priceClass, setPriceClass] = useState('');

  const { formatted: changeFormatted, isPositive } = formatPercentChange(crypto.percentChange24Hr);
  
  // Get first letter of crypto name for icon
  const iconText = crypto.symbol.slice(0, 2).toUpperCase();

  // Track price changes for animations
  useEffect(() => {
    if (previousPrice !== null && previousPrice !== crypto.priceUsd) {
      const prevPriceNum = parseFloat(previousPrice);
      const currentPriceNum = parseFloat(crypto.priceUsd);
      
      if (currentPriceNum > prevPriceNum) {
        setPriceClass('price-up');
      } else if (currentPriceNum < prevPriceNum) {
        setPriceClass('price-down');
      }
      
      // Clear the class after animation
      const timer = setTimeout(() => setPriceClass(''), 600);
      return () => clearTimeout(timer);
    }
    setPreviousPrice(crypto.priceUsd);
  }, [crypto.priceUsd, previousPrice]);
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click if there's a row click handler
    
    // Add haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50); // Short vibration
    }
    
    onToggleFavorite?.(crypto.id);
  };
  
  return (
    <div className="crypto-row">
      <div className="crypto-rank">#{crypto.rank}</div>
      
      <div className="crypto-icon">
        {iconText}
      </div>
      
      <div className="crypto-info">
        <div className="crypto-name">{crypto.name}</div>
        <div className="crypto-symbol">{crypto.symbol}</div>
        <div className="crypto-stats">
          <span className="crypto-market-cap">
            Cap: {formatCurrency(crypto.marketCapUsd, 0)}
          </span>
          <span className="stats-separator">•</span>
          <span className="crypto-volume">
            Vol: {formatCurrency(crypto.volumeUsd24Hr, 0)}
          </span>
        </div>
      </div>
      
      <div className="crypto-price-section">
        <div className={`crypto-price ${priceClass}`}>
          {formatCurrency(crypto.priceUsd, crypto.priceUsd.includes('.') && parseFloat(crypto.priceUsd) < 1 ? 6 : 2)}
        </div>
        <div className={`percentage-change ${isPositive ? 'positive' : 'negative'}`}>
          {changeFormatted}
        </div>
      </div>

      {onToggleFavorite && (
        <button 
          className={`favorite-button ${isFavorite ? 'favorited' : ''}`}
          onClick={handleFavoriteClick}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          ★
        </button>
      )}
    </div>
  );
};

export default CryptoRow;
