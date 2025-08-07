import React from 'react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeTab, 
  onTabChange 
}) => {
  // Debug logging
  console.log('BottomNavigation render - activeTab:', activeTab);

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
          data-active={activeTab === tab.id}
          style={{
            backgroundColor: activeTab === tab.id ? '#FCFC03' : '',
            color: activeTab === tab.id ? '#11140C' : '#FCFC03'
          }}
        >
          <div className="nav-icon">{tab.icon}</div>
          <div className="nav-label">{tab.label}</div>
        </button>
      ))}
    </nav>
  );
};

export default BottomNavigation;