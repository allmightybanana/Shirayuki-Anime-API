import NodeCache from 'node-cache';

const isWorker = typeof globalThis.WebSocketPair !== 'undefined';

// Standard TTL: 10 minutes (600 seconds)
// Disables checkperiod timer on Cloudflare Workers to prevent global scope timer exception
const cache = new NodeCache({ 
  stdTTL: 600,
  checkperiod: isWorker ? 0 : 600
});

export default cache;
