import React from 'react';
import type { CryptoCurrency } from '../types';
import { formatCurrency, formatPercentChange } from '../utils';

interface CryptoCardProps {
  crypto: CryptoCurrency;
}

const CryptoCard: React.FC<CryptoCardProps> = ({ crypto }) => {
  const { formatted: changeFormatted, isPositive } = formatPercentChange(crypto.percentChange24Hr);
  
  return (
    <div className="crypto-card">
      <div className="crypto-header">
        <div className="crypto-info">
          <div className="crypto-name">{crypto.name}</div>
          <div className="crypto-symbol">{crypto.symbol}</div>
        </div>
        <div className="crypto-price">
          {formatCurrency(crypto.priceUsd, 4)}
        </div>
      </div>
      
      <div className="crypto-details">
        <div className="detail-item">
          <div className="detail-label">24h Change</div>
          <div className={`detail-value percentage-change ${isPositive ? 'positive' : 'negative'}`}>
            {changeFormatted}
          </div>
        </div>
        
        <div className="detail-item">
          <div className="detail-label">Market Cap</div>
          <div className="detail-value">
            {formatCurrency(crypto.marketCapUsd)}
          </div>
        </div>
        
        <div className="detail-item">
          <div className="detail-label">Volume (24h)</div>
          <div className="detail-value">
            {formatCurrency(crypto.volumeUsd24Hr)}
          </div>
        </div>
        
        <div className="detail-item">
          <div className="detail-label">Rank</div>
          <div className="detail-value">#{crypto.rank}</div>
        </div>
      </div>
    </div>
  );
};

export default CryptoCard;
