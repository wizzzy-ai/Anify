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
  const interactionCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'interactions', 'interactionService.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(storageCode, context);
  vm.runInContext(authCode, context);
  vm.runInContext(interactionCode, context);

  return { context, storage };
}

const { context } = loadService();
const interactionService = context.interactionService;
const authService = context.authService;

// Guest users should not persist favorites or ratings.
authService.clearSession();
interactionService.restore();
assert.strictEqual(JSON.stringify(interactionService.getFavorites()), JSON.stringify([]));
assert.strictEqual(JSON.stringify(interactionService.getRatings()), JSON.stringify({}));
assert.strictEqual(interactionService.addFavorite(1), false);
assert.strictEqual(interactionService.setRating(1, 7), false);

// Authenticated users should keep favorites and ratings per account.
authService.setToken('token-1', { id: 'user-1', username: 'alice' });
interactionService.restore();
assert.strictEqual(interactionService.addFavorite(1), true);
assert.strictEqual(interactionService.hasFavorite(1), true);
assert.strictEqual(interactionService.getFavoriteCount(), 1);
assert.strictEqual(interactionService.setRating(1, 8), true);
assert.strictEqual(interactionService.getRating(1), 8);

// Different auth user should isolate state.
authService.setToken('token-2', { id: 'user-2', username: 'bob' });
interactionService.restore();
assert.strictEqual(JSON.stringify(interactionService.getFavorites()), JSON.stringify([]));
assert.strictEqual(JSON.stringify(interactionService.getRatings()), JSON.stringify({}));
assert.strictEqual(interactionService.addFavorite(2), true);
assert.strictEqual(interactionService.setRating(2, 9), true);

// Switch back should restore alice's data.
authService.setToken('token-1', { id: 'user-1', username: 'alice' });
interactionService.restore();
assert.strictEqual(interactionService.hasFavorite(1), true);
assert.strictEqual(interactionService.getRating(1), 8);
assert.strictEqual(interactionService.hasFavorite(2), false);
assert.strictEqual(interactionService.getRating(2), null);

console.log('interaction service tests passed');
