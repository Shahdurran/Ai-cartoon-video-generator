/**
 * Redis pub/sub for per-project status events.
 *
 * Used by the SSE endpoint GET /api/projects/:id/status/stream.
 * Channel pattern: `project:{id}:status`.
 *
 * Reuses the existing ioredis library already pulled in by Bull. Two
 * connections are required (ioredis doesn't let a subscriber publish).
 */

const Redis = require('ioredis');
const { redisConfig } = require('../config/queue.config');

// Lazily constructed so unit tests / CLI scripts don't connect unless needed.
let publisher = null;
let subscriber = null;

function buildClient() {
  // If REDIS_URL is set (Railway plugin), use that; else use the granular config.
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return new Redis(redisConfig);
}

function getPublisher() {
  if (!publisher) publisher = buildClient();
  return publisher;
}

function getSubscriber() {
  if (!subscriber) subscriber = buildClient();
  return subscriber;
}

function channelFor(projectId) {
  return `project:${projectId}:status`;
}

async function publish(projectId, event) {
  const ch = channelFor(projectId);
  const payload = JSON.stringify({
    ...event,
    projectId,
    timestamp: new Date().toISOString(),
  });
  try {
    await getPublisher().publish(ch, payload);
  } catch (err) {
    // Non-fatal: don't let SSE infra kill a job.
    console.warn(`⚠️  pubsub publish failed (${ch}):`, err.message);
  }
}

/**
 * Subscribe to a project's status channel. Returns an async unsubscribe fn.
 *
 * NOTE: subscriber connections are shared, so we count listeners per channel
 * and unsubscribe only when the last listener goes away.
 */
const listeners = new Map(); // channel -> Set<fn>

async function subscribe(projectId, handler) {
  const ch = channelFor(projectId);
  const sub = getSubscriber();

  if (!listeners.has(ch)) {
    listeners.set(ch, new Set());
    await sub.subscribe(ch);
  }
  listeners.get(ch).add(handler);

  // Single global message listener; dispatch to all handlers for a channel.
  if (!sub.__cartoonListenerAttached) {
    sub.on('message', (receivedCh, message) => {
      const set = listeners.get(receivedCh);
      if (!set) return;
      let payload;
      try { payload = JSON.parse(message); } catch { payload = { raw: message }; }
      for (const fn of set) {
        try { fn(payload); } catch (err) { console.warn('pubsub handler error', err.message); }
      }
    });
    sub.__cartoonListenerAttached = true;
  }

  return async function unsubscribe() {
    const set = listeners.get(ch);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      listeners.delete(ch);
      try { await sub.unsubscribe(ch); } catch (_) { /* ignore */ }
    }
  };
}

async function close() {
  if (publisher) { try { await publisher.quit(); } catch (_) {} publisher = null; }
  if (subscriber) { try { await subscriber.quit(); } catch (_) {} subscriber = null; }
  listeners.clear();
}

module.exports = { publish, subscribe, close, channelFor };
