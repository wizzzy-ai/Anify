const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function createContext() {
  const storage = new Map();
  const context = {
    window: {},
    globalThis: {},
    console,
    Date,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
      clear() { storage.clear(); },
    },
  };
  context.window = context;
  context.globalThis = context;
  context.window.localStorage = context.localStorage;
  context.global = context;
  return { context, storage };
}

function loadService() {
  const { context, storage } = createContext();
  const storageCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage', 'storageService.js'), 'utf8');
  const authCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth', 'authService.js'), 'utf8');
  const watchlistCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'watch', 'watchlistService.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(storageCode, context);
  vm.runInContext(authCode, context);
  vm.runInContext(watchlistCode, context);

  return { context, storage };
}

const { context } = loadService();

const watchlistService = context.watchlistService;
const authService = context.authService;

// Guest users should not persist anything.
authService.clearSession();
watchlistService.restore();
watchlistService.add({ id: 1, title: 'Test Anime' });
assert.strictEqual(JSON.stringify(watchlistService.getEntries()), JSON.stringify([]));

// Authenticated users should keep entries per account.
authService.setToken('token-1', { id: 'user-1', username: 'alice' });
watchlistService.restore();
watchlistService.add({ id: 1, title: 'Anime A' });
assert.strictEqual(watchlistService.getEntries().length, 1);

authService.setToken('token-2', { id: 'user-2', username: 'bob' });
watchlistService.restore();
assert.strictEqual(JSON.stringify(watchlistService.getEntries()), JSON.stringify([]));

// Switching back should restore the prior user's list.
authService.setToken('token-1', { id: 'user-1', username: 'alice' });
watchlistService.restore();
assert.strictEqual(watchlistService.getEntries().length, 1);

console.log('watchlist service tests passed');
