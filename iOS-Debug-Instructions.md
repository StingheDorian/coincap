# iOS Favorites Debug Instructions

## Quick Test Steps

1. **Open the deployed app** in iOS Safari/iframe: https://stinghedorian.github.io/coincap/

2. **Open the browser console** (if possible in iOS iframe environment):
   - On Safari: Enable Developer menu in Settings → Safari → Advanced → Web Inspector
   - On iPad/iPhone: Connect to Mac and use Safari developer tools

3. **Copy and paste this debug script** into the console:

```javascript
// Quick iOS storage test
console.log('=== Quick iOS Test ===');
console.log('Platform:', /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'iOS' : 'Other');
console.log('Iframe:', window !== window.top);

// Test cloud storage directly
async function quickCloudTest() {
  try {
    const response = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': '$2a$10$SvrqFvVX4gPJfpyfAsUFauuFdszDXMurEPMChgZYQ5wTZE4TMJ6im'
      },
      body: JSON.stringify({ test: 'iOS storage test', timestamp: Date.now() })
    });
    
    console.log('Cloud storage test:', response.ok ? '✅ Working' : '❌ Failed');
    if (response.ok) {
      const result = await response.json();
      console.log('Bin created:', result.metadata?.id);
    }
  } catch (error) {
    console.log('❌ Cloud storage error:', error.message);
  }
}

// Test localStorage
try {
  localStorage.setItem('test', 'works');
  console.log('localStorage:', localStorage.getItem('test') === 'works' ? '✅ Working' : '❌ Failed');
  localStorage.removeItem('test');
} catch (e) {
  console.log('localStorage: ❌ Failed -', e.message);
}

// Run cloud test
quickCloudTest();

// Check app storage function
setTimeout(() => {
  if (typeof window.testCryptoStorage === 'function') {
    console.log('App storage test available - run: window.testCryptoStorage()');
  } else {
    console.log('App still loading...');
  }
}, 3000);
```

4. **Test favorites manually**:
   - Add Bitcoin to favorites by tapping the heart icon
   - Wait 2-3 seconds for the save to complete
   - Refresh the page
   - Check if Bitcoin is still in favorites

## Expected Results

- ✅ **Cloud storage test should work** (JSONBin.io API)
- ✅ **localStorage might work or fail** (iOS iframe limitation)
- ✅ **App should load favorites from cloud** on refresh

## If Storage Still Fails

The issue might be:
1. **Network/CORS restrictions** in iOS iframe
2. **JSONBin.io API limits** or rate limiting
3. **Timing issues** - saves happening too slowly
4. **CSP (Content Security Policy)** blocking external requests

## Alternative Test Without Console

1. Add Bitcoin to favorites (tap heart)
2. Wait 5 seconds
3. Refresh the page completely
4. Check if Bitcoin heart is still filled/red

If favorites don't persist after refresh, the storage system isn't working in the iOS iframe environment despite our comprehensive solution.
