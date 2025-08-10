/**
 * Robust storage service for iOS iframe environments
 * Uses multiple persistence strategies including cloud storage for GitHub Pages deployment
 * Works with static hosting (GitHub Pages, Netlify, Vercel)
 */

import { JSONBinStorage } from './cloudStorage';

// Strategy 1: IndexedDB (most reliable in iOS iframes)
class IndexedDBStorage {
  private dbName = 'CoinCapDB';
  private dbVersion = 1;
  private storeName = 'favorites';
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    if (!('indexedDB' in window)) {
      console.log('IndexedDB not supported');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = () => {
          console.log('IndexedDB open failed:', request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('IndexedDB initialized successfully');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
            console.log('IndexedDB object store created');
          }
        };
      } catch (error) {
        console.log('IndexedDB init error:', error);
        resolve(false);
      }
    });
  }

  async save(favorites: string[]): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const data = {
          id: 'user-favorites',
          favorites: favorites,
          timestamp: Date.now()
        };

        const request = store.put(data);
        
        request.onsuccess = () => {
          console.log('IndexedDB: Favorites saved successfully');
          resolve(true);
        };

        request.onerror = () => {
          console.log('IndexedDB: Save failed:', request.error);
          resolve(false);
        };
      } catch (error) {
        console.log('IndexedDB: Save error:', error);
        resolve(false);
      }
    });
  }

  async load(): Promise<string[] | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get('user-favorites');

        request.onsuccess = () => {
          const result = request.result;
          if (result && result.favorites) {
            console.log('IndexedDB: Favorites loaded successfully:', result.favorites.length, 'items');
            resolve(result.favorites);
          } else {
            console.log('IndexedDB: No favorites found');
            resolve(null);
          }
        };

        request.onerror = () => {
          console.log('IndexedDB: Load failed:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.log('IndexedDB: Load error:', error);
        resolve(null);
      }
    });
  }
}

// Strategy 2: Enhanced memory storage with backup
class MemoryStorage {
  private favorites: Set<string> = new Set();
  private lastSaved: number = 0;
  
  save(favorites: string[]): void {
    this.favorites = new Set(favorites);
    this.lastSaved = Date.now();
    console.log('Memory: Favorites saved:', favorites.length, 'items');
  }
  
  load(): string[] | null {
    if (this.favorites.size === 0) return null;
    const result = Array.from(this.favorites);
    console.log('Memory: Favorites loaded:', result.length, 'items');
    return result;
  }
  
  clear(): void {
    this.favorites.clear();
    this.lastSaved = 0;
  }
  
  getAge(): number {
    return this.lastSaved ? Date.now() - this.lastSaved : 0;
  }
}

// Strategy 3: Traditional storage with better error handling
class TraditionalStorage {
  async save(favorites: string[]): Promise<boolean> {
    const data = JSON.stringify({
      favorites,
      timestamp: Date.now(),
      version: '1.0'
    });

    // Try multiple storage methods
    const methods = [
      () => { localStorage.setItem('crypto-favorites-v2', data); return 'localStorage'; },
      () => { sessionStorage.setItem('crypto-favorites-v2', data); return 'sessionStorage'; }
    ];

    for (const method of methods) {
      try {
        const source = method();
        console.log(`Traditional: Favorites saved to ${source}`);
        return true;
      } catch (error) {
        console.log(`Traditional: Storage method failed:`, error);
      }
    }

    return false;
  }

  async load(): Promise<string[] | null> {
    const sources = [
      () => localStorage.getItem('crypto-favorites-v2'),
      () => sessionStorage.getItem('crypto-favorites-v2'),
      // Fallback to old format
      () => localStorage.getItem('crypto-favorites'),
      () => sessionStorage.getItem('crypto-favorites')
    ];

    for (const source of sources) {
      try {
        const data = source();
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const favorites = parsed.favorites || parsed; // Handle both new and old format
            if (Array.isArray(favorites)) {
              console.log('Traditional: Favorites loaded:', favorites.length, 'items');
              return favorites;
            }
          } catch (parseError) {
            console.log('Traditional: Parse failed for stored data');
          }
        }
      } catch (error) {
        console.log('Traditional: Storage access failed:', error);
      }
    }

    return null;
  }
}

// Platform detection for optimized storage strategy
function detectPlatform(): { platform: string; isIframe: boolean; storageReliability: string } {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIframe = window !== window.top;
  
  let platform = 'unknown';
  let storageReliability = 'good';
  
  if (userAgent.includes('android')) {
    platform = 'android';
    storageReliability = isIframe ? 'good' : 'excellent'; // Android iframe storage is generally reliable
  } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    platform = 'ios';
    storageReliability = isIframe ? 'limited' : 'good'; // iOS iframe storage is more restricted
  } else if (userAgent.includes('chrome')) {
    platform = 'chrome';
    storageReliability = 'excellent';
  } else if (userAgent.includes('firefox')) {
    platform = 'firefox';
    storageReliability = 'excellent';
  } else if (userAgent.includes('safari')) {
    platform = 'safari';
    storageReliability = isIframe ? 'limited' : 'good';
  }
  
  return { platform, isIframe, storageReliability };
}

// Main storage manager that coordinates all strategies
export class FavoritesStorage {
  private indexedDB = new IndexedDBStorage();
  private memory = new MemoryStorage();
  private traditional = new TraditionalStorage();
  private cloud = new JSONBinStorage(); // Simple cloud storage for GitHub Pages
  private initialized = false;
  private platformInfo = detectPlatform();

  async init(): Promise<void> {
    console.log('🏪 Initializing robust storage system...');
    console.log('📱 Platform detected:', this.platformInfo);
    
    // Initialize IndexedDB (excellent for Android, best option for iOS iframe)
    const indexedDBReady = await this.indexedDB.init();
    
    // Initialize cloud storage (works great with GitHub Pages)
    const cloudReady = await this.cloud.init();
    
    // Android-specific optimizations
    if (this.platformInfo.platform === 'android') {
      console.log('🤖 Android detected: Storage should work excellently');
      if (this.platformInfo.isIframe) {
        console.log('📱 Android iframe: IndexedDB + localStorage + cloud all reliable');
      }
    }
    
    // iOS-specific messaging
    if (this.platformInfo.platform === 'ios' && this.platformInfo.isIframe) {
      console.log('🍎 iOS iframe detected: Using enhanced persistence strategy with cloud backup');
    }
    
    console.log(`Storage systems ready: IndexedDB=${indexedDBReady}, Cloud=${cloudReady}, Platform=${this.platformInfo.platform}, Reliability=${this.platformInfo.storageReliability}`);
    this.initialized = true;
  }

  async saveFavorites(favorites: string[]): Promise<void> {
    if (!this.initialized) {
      console.warn('Storage not initialized, saving to memory only');
      this.memory.save(favorites);
      return;
    }

    console.log(`💾 Saving ${favorites.length} favorites using multi-layer strategy...`);
    console.log(`📱 Platform: ${this.platformInfo.platform} (${this.platformInfo.storageReliability} reliability)`);
    
    // Always save to memory first (instant)
    this.memory.save(favorites);
    
    // Platform-optimized saving strategy
    const savePromises: Promise<boolean>[] = [];
    
    // IndexedDB - priority for all platforms, especially iOS iframe
    savePromises.push(this.indexedDB.save(favorites));
    
    // Traditional storage - very reliable on Android, good fallback for others
    savePromises.push(this.traditional.save(favorites));
    
    // Cloud storage - perfect for GitHub Pages deployment, works everywhere
    savePromises.push(this.cloud.save(favorites));
    
    // On Android, we can be more aggressive with parallel saves since storage is more reliable
    if (this.platformInfo.platform === 'android') {
      console.log('🤖 Android: Using optimized parallel save strategy with cloud backup');
    } else if (this.platformInfo.platform === 'ios' && this.platformInfo.isIframe) {
      console.log('🍎 iOS iframe: Using cloud storage as primary backup');
    }

    try {
      const results = await Promise.allSettled(savePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`💾 Favorites saved to ${successful + 1} storage systems (including memory)`);
      
      if (successful === 0) {
        console.warn('⚠️ All persistent storage methods failed, data only in memory');
      } else if (successful >= 2) {
        console.log('✅ High reliability: Favorites saved to multiple persistent storage systems');
      }
    } catch (error) {
      console.warn('Some storage methods failed:', error);
    }
  }

  async loadFavorites(): Promise<string[]> {
    if (!this.initialized) {
      await this.init();
    }

    console.log('📤 Loading favorites using platform-optimized strategy...');
    console.log(`📱 Platform: ${this.platformInfo.platform} (${this.platformInfo.storageReliability} reliability)`);

    // Platform-optimized loading strategy
    let loaders: (() => Promise<string[] | null>)[] = [];
    
    if (this.platformInfo.platform === 'android') {
      // Android: localStorage is very reliable, so try it first after memory
      console.log('🤖 Android: Using localStorage-priority strategy with cloud backup');
      loaders = [
        async () => this.memory.load(),
        () => this.traditional.load(), // localStorage works great on Android
        () => this.indexedDB.load(),
        () => this.cloud.load() // Cloud as backup
      ];
    } else if (this.platformInfo.platform === 'ios' && this.platformInfo.isIframe) {
      // iOS iframe: Cloud storage is most reliable for GitHub Pages deployment
      console.log('🍎 iOS iframe: Using cloud-priority strategy for GitHub Pages');
      loaders = [
        async () => this.memory.load(),
        () => this.cloud.load(), // Best for iOS iframe + GitHub Pages
        () => this.indexedDB.load(),
        () => this.traditional.load()
      ];
    } else {
      // Default strategy for desktop/other platforms
      loaders = [
        async () => this.memory.load(),
        () => this.indexedDB.load(),
        () => this.traditional.load(),
        () => this.cloud.load()
      ];
    }

    for (const loader of loaders) {
      try {
        const result = await loader();
        if (result && result.length > 0) {
          // Save to all other storage methods for redundancy
          this.saveFavorites(result);
          return result;
        }
      } catch (error) {
        console.log('Storage loader failed:', error);
      }
    }

    console.log('📤 No favorites found in any storage system');
    return [];
  }

  // Test all storage systems
  async testStorage(): Promise<void> {
    console.log('🧪 Testing storage systems...');
    
    const testData = ['bitcoin', 'ethereum', 'test-coin'];
    
    console.log('Testing IndexedDB...');
    const indexedDBWorks = await this.indexedDB.save(testData);
    console.log('IndexedDB test:', indexedDBWorks ? '✅ Working' : '❌ Failed');
    
    console.log('Testing Traditional storage...');
    const traditionalWorks = await this.traditional.save(testData);
    console.log('Traditional storage test:', traditionalWorks ? '✅ Working' : '❌ Failed');
    
    console.log('Testing Cloud storage...');
    const cloudWorks = await this.cloud.save(testData);
    console.log('Cloud storage test:', cloudWorks ? '✅ Working' : '❌ Failed');
    
    console.log('Testing Memory storage...');
    this.memory.save(testData);
    const memoryResult = this.memory.load();
    console.log('Memory storage test:', memoryResult ? '✅ Working' : '❌ Failed');
    
    // Clean up test data
    try {
      localStorage.removeItem('crypto-favorites-v2');
      sessionStorage.removeItem('crypto-favorites-v2');
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // Get storage status for debugging
  getStorageStatus(): { [key: string]: string | object } {
    return {
      platform: this.platformInfo,
      memory: this.memory.load() ? `${this.memory.load()!.length} items` : 'empty',
      memoryAge: this.memory.getAge() > 0 ? `${Math.round(this.memory.getAge() / 1000)}s ago` : 'never',
      indexedDB: this.indexedDB ? 'initialized' : 'not available',
      traditional: 'available',
      cloud: 'available (JSONBin)',
      recommendation: this.getStorageRecommendation()
    };
  }

  // Get platform-specific storage recommendations
  private getStorageRecommendation(): string {
    if (this.platformInfo.platform === 'android') {
      return this.platformInfo.isIframe 
        ? 'Android iframe: Excellent storage support, cloud backup for GitHub Pages'
        : 'Android native: Perfect storage support with cloud sync';
    } else if (this.platformInfo.platform === 'ios') {
      return this.platformInfo.isIframe
        ? 'iOS iframe: Cloud storage primary, IndexedDB backup - Perfect for GitHub Pages!'
        : 'iOS native: Good storage support with cloud sync';
    } else {
      return 'Desktop: All storage methods available with cloud sync';
    }
  }
}

// Create singleton instance
export const favoritesStorage = new FavoritesStorage();
