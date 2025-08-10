/**
 * Server-side storage service for GitHub Pages deployment
 * Uses Firebase Firestore (free tier) for reliable favorites persistence
 */

// Simple anonymous user ID generation
function generateAnonymousUserId(): string {
  // Create a persistent anonymous ID based on browser fingerprint
  const browserInfo = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset()
  ].join('|');
  
  // Simple hash function to create consistent ID
  let hash = 0;
  for (let i = 0; i < browserInfo.length; i++) {
    const char = browserInfo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return 'user_' + Math.abs(hash).toString(36);
}

// Strategy 4: Cloud Storage (Firebase Firestore - works with GitHub Pages)
class CloudStorage {
  private userId: string;
  private firebaseConfig = {
    // Use environment variables or public config
    apiKey: "demo-key", // Replace with your Firebase config
    authDomain: "coincap-favorites.firebaseapp.com",
    projectId: "coincap-favorites",
    storageBucket: "coincap-favorites.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  };
  private db: any = null;
  private initialized = false;

  constructor() {
    this.userId = this.getOrCreateUserId();
  }

  private getOrCreateUserId(): string {
    // Try to get existing user ID from localStorage
    try {
      let userId = localStorage.getItem('anonymous-user-id');
      if (!userId) {
        userId = generateAnonymousUserId();
        localStorage.setItem('anonymous-user-id', userId);
        console.log('🆔 Generated new anonymous user ID:', userId);
      } else {
        console.log('🆔 Using existing anonymous user ID:', userId);
      }
      return userId;
    } catch (error) {
      // If localStorage fails, generate temporary ID
      console.log('🆔 localStorage failed, using session-only ID');
      return generateAnonymousUserId();
    }
  }

  async init(): Promise<boolean> {
    try {
      // Check if Firebase is available (CDN loaded)
      if (typeof window !== 'undefined' && (window as any).firebase) {
        const firebase = (window as any).firebase;
        
        // Initialize Firebase if not already done
        if (!firebase.apps.length) {
          firebase.initializeApp(this.firebaseConfig);
        }
        
        this.db = firebase.firestore();
        this.initialized = true;
        console.log('☁️ Cloud storage (Firebase) initialized successfully');
        return true;
      } else {
        console.log('☁️ Firebase not available, using fallback storage');
        return false;
      }
    } catch (error) {
      console.log('☁️ Cloud storage init failed:', error);
      return false;
    }
  }

  async save(favorites: string[]): Promise<boolean> {
    if (!this.initialized || !this.db) {
      console.log('☁️ Cloud storage not initialized');
      return false;
    }

    try {
      const docRef = this.db.collection('user-favorites').doc(this.userId);
      await docRef.set({
        favorites: favorites,
        timestamp: Date.now(),
        lastUpdated: new Date().toISOString(),
        platform: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 'ios' : 
                 navigator.userAgent.includes('Android') ? 'android' : 'desktop'
      });
      
      console.log('☁️ Cloud: Favorites saved successfully to server');
      return true;
    } catch (error) {
      console.log('☁️ Cloud save failed:', error);
      return false;
    }
  }

  async load(): Promise<string[] | null> {
    if (!this.initialized || !this.db) {
      console.log('☁️ Cloud storage not initialized');
      return null;
    }

    try {
      const docRef = this.db.collection('user-favorites').doc(this.userId);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const data = doc.data();
        if (data && data.favorites && Array.isArray(data.favorites)) {
          console.log('☁️ Cloud: Favorites loaded successfully from server:', data.favorites.length, 'items');
          return data.favorites;
        }
      } else {
        console.log('☁️ Cloud: No favorites found on server');
      }
      
      return null;
    } catch (error) {
      console.log('☁️ Cloud load failed:', error);
      return null;
    }
  }

  getUserId(): string {
    return this.userId;
  }
}

// Alternative: JSONBin.io storage (simpler, no setup required)
class JSONBinStorage {
  private userId: string;
  private apiKey = '$2a$10$SvrqFvVX4gPJfpyfAsUFauuFdszDXMurEPMChgZYQ5wTZE4TMJ6im'; // Your actual JSONBin.io API key
  private binId: string | null = null;

  constructor() {
    this.userId = this.getOrCreateUserId();
  }

  private getOrCreateUserId(): string {
    try {
      let userId = localStorage.getItem('anonymous-user-id');
      if (!userId) {
        userId = generateAnonymousUserId();
        localStorage.setItem('anonymous-user-id', userId);
      }
      return userId;
    } catch (error) {
      return generateAnonymousUserId();
    }
  }

  async init(): Promise<boolean> {
    try {
      // Try to get existing bin ID for this user
      console.log('📦 JSONBin: Initializing for user:', this.userId);
      
      try {
        this.binId = localStorage.getItem(`jsonbin-${this.userId}`);
        console.log('📦 JSONBin: Found existing bin ID in localStorage:', this.binId);
      } catch (error) {
        console.log('📦 JSONBin: localStorage access failed (iOS limitation):', error);
        this.binId = null;
      }
      
      console.log('📦 JSONBin storage initialized');
      return true;
    } catch (error) {
      console.log('📦 JSONBin init failed:', error);
      return false;
    }
  }

  async save(favorites: string[]): Promise<boolean> {
    try {
      const data = {
        userId: this.userId,
        favorites: favorites,
        timestamp: Date.now(),
        platform: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 'ios' : 
                 navigator.userAgent.includes('Android') ? 'android' : 'desktop'
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Bin-Name': `coincap-favorites-${this.userId}`
      };

      // Add API key (always use it if available)
      if (this.apiKey) {
        headers['X-Master-Key'] = this.apiKey;
        console.log('📦 Using API key for JSONBin request');
      } else {
        console.log('⚠️ No API key available for JSONBin request');
      }

      let url = 'https://api.jsonbin.io/v3/b';
      let method = 'POST';

      // If we have an existing bin, update it
      if (this.binId) {
        url = `https://api.jsonbin.io/v3/b/${this.binId}`;
        method = 'PUT';
      }

      console.log('📦 JSONBin: Attempting to save', favorites.length, 'favorites');
      console.log('📦 JSONBin: URL:', url, 'Method:', method);
      console.log('📦 JSONBin: Headers:', Object.keys(headers));

      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(data)
      });

      console.log('📦 JSONBin: Response status:', response.status);
      console.log('📦 JSONBin: Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('📦 JSONBin: Response metadata:', result.metadata);
        
        // Save bin ID for future updates
        if (result.metadata && result.metadata.id) {
          const binId = result.metadata.id;
          this.binId = binId;
          try {
            localStorage.setItem(`jsonbin-${this.userId}`, binId);
            console.log('📦 JSONBin: Bin ID saved for future updates:', binId);
          } catch (e) {
            console.log('📦 JSONBin: Could not save bin ID to localStorage (iOS limitation)');
            // Store in memory for this session
            console.log('📦 JSONBin: Using in-memory bin ID for session');
          }
        }

        console.log('📦 JSONBin: Favorites saved successfully to cloud');
        return true;
      } else {
        const errorText = await response.text();
        console.log('📦 JSONBin save failed:', response.status, response.statusText);
        console.log('📦 JSONBin error details:', errorText);
        
        // Try to parse error JSON if possible
        try {
          const errorJson = JSON.parse(errorText);
          console.log('📦 JSONBin parsed error:', errorJson);
        } catch (e) {
          console.log('📦 JSONBin raw error text:', errorText);
        }
        
        return false;
      }
    } catch (error) {
      console.log('📦 JSONBin save error:', error);
      return false;
    }
  }

  async load(): Promise<string[] | null> {
    if (!this.binId) {
      console.log('📦 JSONBin: No existing data found');
      return null;
    }

    try {
      console.log('📦 JSONBin: Loading favorites from bin:', this.binId);
      
      const headers: Record<string, string> = {};
      
      if (this.apiKey) {
        headers['X-Master-Key'] = this.apiKey;
        console.log('📦 JSONBin: Using API key for load request');
      }

      const url = `https://api.jsonbin.io/v3/b/${this.binId}/latest`;
      console.log('📦 JSONBin: Load URL:', url);

      const response = await fetch(url, {
        headers: headers
      });

      console.log('📦 JSONBin: Load response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('📦 JSONBin: Load response structure:', Object.keys(result));
        
        if (result.record && result.record.favorites && Array.isArray(result.record.favorites)) {
          console.log('📦 JSONBin: Favorites loaded from cloud:', result.record.favorites.length, 'items');
          console.log('📦 JSONBin: Loaded favorites:', result.record.favorites);
          return result.record.favorites;
        } else {
          console.log('📦 JSONBin: Invalid response structure or no favorites found');
          console.log('📦 JSONBin: Response record:', result.record);
        }
      } else {
        const errorText = await response.text();
        console.log('📦 JSONBin load failed:', response.status, response.statusText);
        console.log('📦 JSONBin load error details:', errorText);
      }

      return null;
    } catch (error) {
      console.log('📦 JSONBin load error:', error);
      return null;
    }
  }
}

export { CloudStorage, JSONBinStorage, generateAnonymousUserId };
