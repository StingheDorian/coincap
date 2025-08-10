// Debugging script for iOS storage issues
// Copy and paste this into the browser console on https://stinghedorian.github.io/coincap/

// Test 1: Check if the test function is available
console.log('=== iOS Storage Debug Script ===');
console.log('App URL:', window.location.href);
console.log('1. Testing if testCryptoStorage is available...');
if (typeof window.testCryptoStorage === 'function') {
  console.log('✅ testCryptoStorage function found');
} else {
  console.log('❌ testCryptoStorage function not found - wait for app to load');
  console.log('Available window functions:', Object.keys(window).filter(k => k.includes('test') || k.includes('crypto') || k.includes('storage')));
}

// Test 2: Check platform detection
console.log('\n2. Platform detection:');
console.log('User Agent:', navigator.userAgent);
console.log('Is iframe:', window !== window.top);
console.log('Is iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));

// Test 3: Check if cloud storage works directly
console.log('\n3. Testing JSONBin cloud storage directly...');

// Simple test function to verify cloud storage
async function testCloudStorageDirectly() {
  const apiKey = '$2a$10$SvrqFvVX4gPJfpyfAsUFauuFdszDXMurEPMChgZYQ5wTZE4TMJ6im';
  const testData = { favorites: ['bitcoin', 'ethereum'], timestamp: Date.now() };
  
  try {
    console.log('📤 Sending test data to JSONBin...');
    const response = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Cloud storage test successful!');
      console.log('Bin ID:', result.metadata?.id);
      
      // Test loading the data back
      if (result.metadata?.id) {
        console.log('📥 Testing data retrieval...');
        const loadResponse = await fetch(`https://api.jsonbin.io/v3/b/${result.metadata.id}/latest`, {
          headers: {
            'X-Master-Key': apiKey
          }
        });
        
        if (loadResponse.ok) {
          const loadResult = await loadResponse.json();
          console.log('✅ Data retrieval successful!');
          console.log('Retrieved data:', loadResult.record);
        } else {
          console.log('❌ Data retrieval failed:', loadResponse.status);
        }
      }
    } else {
      console.log('❌ Cloud storage test failed:', response.status);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Cloud storage test error:', error);
  }
}

// Test 4: Check localStorage access
console.log('\n4. Testing localStorage access...');
try {
  localStorage.setItem('test-key', 'test-value');
  const value = localStorage.getItem('test-key');
  localStorage.removeItem('test-key');
  console.log('✅ localStorage works:', value === 'test-value');
} catch (error) {
  console.log('❌ localStorage failed:', error);
}

// Test 5: Check IndexedDB access
console.log('\n5. Testing IndexedDB access...');
if ('indexedDB' in window) {
  console.log('✅ IndexedDB API available');
  
  // Try to open a test database
  try {
    const request = indexedDB.open('test-db', 1);
    request.onsuccess = () => {
      console.log('✅ IndexedDB connection successful');
      request.result.close();
    };
    request.onerror = () => {
      console.log('❌ IndexedDB connection failed:', request.error);
    };
  } catch (error) {
    console.log('❌ IndexedDB test error:', error);
  }
} else {
  console.log('❌ IndexedDB not available');
}

// Test 6: Network connectivity and JSONBin accessibility
console.log('\n6. Testing network connectivity and JSONBin...');
fetch('https://api.jsonbin.io/', { 
  headers: { 'X-Master-Key': '$2a$10$SvrqFvVX4gPJfpyfAsUFauuFdszDXMurEPMChgZYQ5wTZE4TMJ6im' }
})
  .then(response => {
    console.log('✅ Network connection works, JSONBin accessible:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
  })
  .catch(error => {
    console.log('❌ Network connection failed:', error);
  });

// Test 7: Check current favorites state
console.log('\n7. Checking current favorites state...');
try {
  const localFavorites = localStorage.getItem('crypto-favorites-v2');
  console.log('localStorage favorites:', localFavorites);
  
  const sessionFavorites = sessionStorage.getItem('crypto-favorites-v2');
  console.log('sessionStorage favorites:', sessionFavorites);
  
  const anonymousUserId = localStorage.getItem('anonymous-user-id');
  console.log('Anonymous user ID:', anonymousUserId);
  
  const jsonbinId = anonymousUserId ? localStorage.getItem(`jsonbin-${anonymousUserId}`) : null;
  console.log('JSONBin ID for user:', jsonbinId);
} catch (error) {
  console.log('❌ Error checking favorites state:', error);
}

// Test 8: Test favorites manipulation
window.testFavoritesFlow = async function() {
  console.log('\n=== Testing Favorites Flow ===');
  
  // Step 1: Add Bitcoin to favorites (simulate user action)
  console.log('1. Adding Bitcoin to favorites...');
  try {
    // Find the Bitcoin element and click the heart
    const bitcoinElement = document.querySelector('[data-crypto-id="bitcoin"]');
    if (bitcoinElement) {
      const heartButton = bitcoinElement.querySelector('.heart-button, [class*="heart"], [class*="favorite"]');
      if (heartButton) {
        heartButton.click();
        console.log('✅ Clicked Bitcoin heart button');
        
        // Wait a moment for the save to complete
        setTimeout(async () => {
          console.log('2. Checking if Bitcoin was saved...');
          
          // Check all storage methods
          try {
            const localStorage_check = localStorage.getItem('crypto-favorites-v2');
            console.log('localStorage after save:', localStorage_check);
            
            // Test cloud storage directly
            const userId = localStorage.getItem('anonymous-user-id');
            const binId = userId ? localStorage.getItem(`jsonbin-${userId}`) : null;
            
            if (binId) {
              console.log('3. Checking cloud storage...');
              const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
                headers: { 'X-Master-Key': '$2a$10$SvrqFvVX4gPJfpyfAsUFauuFdszDXMurEPMChgZYQ5wTZE4TMJ6im' }
              });
              
              if (response.ok) {
                const data = await response.json();
                console.log('✅ Cloud storage contains:', data.record);
              } else {
                console.log('❌ Cloud storage read failed:', response.status);
              }
            } else {
              console.log('⚠️ No cloud storage bin ID found');
            }
          } catch (error) {
            console.log('❌ Error checking saved state:', error);
          }
        }, 2000);
      } else {
        console.log('❌ Could not find heart button for Bitcoin');
      }
    } else {
      console.log('❌ Could not find Bitcoin element');
      console.log('Available crypto elements:', document.querySelectorAll('[data-crypto-id]').length);
    }
  } catch (error) {
    console.log('❌ Error in favorites test:', error);
  }
};

// Test 9: Reload simulation
window.testReloadPersistence = function() {
  console.log('\n=== Testing Reload Persistence ===');
  console.log('💾 Current favorites before reload:');
  
  try {
    const current = localStorage.getItem('crypto-favorites-v2');
    console.log('localStorage:', current);
    
    // Reload the page
    console.log('🔄 Reloading page to test persistence...');
    window.location.reload();
  } catch (error) {
    console.log('❌ Error testing reload:', error);
  }
};

// Instructions
console.log('\n=== Instructions ===');
console.log('Run these commands one by one in the browser console:');
console.log('1. testCloudStorageDirectly() - Test cloud storage directly');
console.log('2. window.testCryptoStorage() - Test the app storage system (if available)');
console.log('3. testFavoritesFlow() - Test adding Bitcoin to favorites');
console.log('4. testReloadPersistence() - Test if favorites survive page reload');
console.log('\n💡 Tips:');
console.log('- Wait for the app to fully load before running tests');
console.log('- Check for any red error messages in console');
console.log('- Try adding favorites manually first, then run tests');

// Make test functions available globally
window.testCloudStorageDirectly = testCloudStorageDirectly;
