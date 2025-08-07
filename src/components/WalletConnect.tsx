import React, { useState } from 'react';
import { autoConnectWallet } from '../utils';

interface WalletConnectProps {
  onWalletChange: (address: string | null) => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onWalletChange }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      const accounts = await autoConnectWallet();
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        onWalletChange(address);
      }
    } catch (error) {
      console.error('Wallet connect failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    onWalletChange(null);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnecting) {
    return <div className="wallet-status">🔗 Connecting...</div>;
  }

  if (walletAddress) {
    return (
      <div className="wallet-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🟢 {formatAddress(walletAddress)}</span>
        <button 
          onClick={handleDisconnectWallet}
          style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: 'none', 
            color: 'white', 
            padding: '0.25rem 0.5rem', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-status">
      <button 
        onClick={handleConnectWallet}
        style={{ 
          background: 'rgba(255,255,255,0.2)', 
          border: 'none', 
          color: 'white', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '4px',
          fontSize: '0.75rem',
          cursor: 'pointer'
        }}
      >
        Connect Wallet
      </button>
    </div>
  );
};

export default WalletConnect;
