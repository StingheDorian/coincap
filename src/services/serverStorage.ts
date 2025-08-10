/**
 * Server-side favorites storage API client
 * Provides reliable favorites persistence using backend storage
 */

// Generate or retrieve anonymous user ID for server-side storage
function getAnonymousUserId(): string {
  let userId = localStorage.getItem('anonymous-user-id');
  if (!userId) {
    // Generate a unique anonymous ID
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try {
      localStorage.setItem('anonymous-user-id', userId);
    } catch (e) {
      // If localStorage fails, use session-based ID
      if (!sessionStorage.getItem('anonymous-user-id')) {
        sessionStorage.setItem('anonymous-user-id', userId);
      }
    }
  }
  return userId;
}

// Server-side storage API client
export class ServerStorage {
  private baseUrl: string;
  private userId: string;
  private retryCount = 3;
  private timeout = 10000; // 10 seconds

  constructor(baseUrl?: string) {
    // Use environment variable or fallback to local development
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.userId = getAnonymousUserId();
    console.log('ServerStorage initialized:', { baseUrl: this.baseUrl, userId: this.userId });
  }

  async saveFavorites(favorites: string[]): Promise<boolean> {
    console.log(`🌐 Server: Saving ${favorites.length} favorites for user ${this.userId}`);
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: this.userId,
            favorites: favorites,
            timestamp: Date.now()
          }),
          signal: AbortSignal.timeout(this.timeout)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🌐 Server: Favorites saved successfully:', result);
          return true;
        } else {
          console.warn(`🌐 Server: Save failed with status ${response.status} (attempt ${attempt}/${this.retryCount})`);
        }
      } catch (error: any) {
        console.warn(`🌐 Server: Save error (attempt ${attempt}/${this.retryCount}):`, error.message);
        
        if (attempt < this.retryCount) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('🌐 Server: Failed to save favorites after all retry attempts');
    return false;
  }

  async loadFavorites(): Promise<string[] | null> {
    console.log(`🌐 Server: Loading favorites for user ${this.userId}`);
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/favorites/${this.userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(this.timeout)
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.favorites)) {
            console.log(`🌐 Server: Favorites loaded successfully: ${result.favorites.length} items`);
            return result.favorites;
          } else {
            console.log('🌐 Server: No favorites found for user');
            return null;
          }
        } else if (response.status === 404) {
          console.log('🌐 Server: No favorites found for user (404)');
          return null;
        } else {
          console.warn(`🌐 Server: Load failed with status ${response.status} (attempt ${attempt}/${this.retryCount})`);
        }
      } catch (error: any) {
        console.warn(`🌐 Server: Load error (attempt ${attempt}/${this.retryCount}):`, error.message);
        
        if (attempt < this.retryCount) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('🌐 Server: Failed to load favorites after all retry attempts');
    return null;
  }

  async testConnection(): Promise<boolean> {
    console.log('🌐 Server: Testing connection...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      const isHealthy = response.ok;
      console.log('🌐 Server: Health check:', isHealthy ? '✅ Connected' : '❌ Failed');
      return isHealthy;
    } catch (error: any) {
      console.log('🌐 Server: Health check failed:', error.message);
      return false;
    }
  }

  getUserId(): string {
    return this.userId;
  }

  // Reset user ID (for testing or user reset)
  resetUserId(): void {
    const newUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.userId = newUserId;
    
    try {
      localStorage.setItem('anonymous-user-id', newUserId);
    } catch (e) {
      try {
        sessionStorage.setItem('anonymous-user-id', newUserId);
      } catch (e2) {
        console.warn('Unable to persist new user ID');
      }
    }
    
    console.log('🌐 Server: User ID reset to:', newUserId);
  }
}
