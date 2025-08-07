import React from 'react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeTab, 
  onTabChange 
}) => {
  const tabs = [
    { id: 'home', icon: '⌂', label: 'Home' },
    { id: 'portfolio', icon: '△', label: 'Portfolio' },
    { id: 'favorites', icon: '★', label: 'Favorites' },
    { id: 'wallet', icon: '▣', label: 'Wallet' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <div className="nav-icon">{tab.icon}</div>
          <div className="nav-label">{tab.label}</div>
        </button>
      ))}
    </nav>
  );
};

export default BottomNavigation;