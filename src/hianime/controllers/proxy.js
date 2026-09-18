import { Buffer } from 'node:buffer';

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// PNG IEND marker: 49 45 4E 44 AE 42 60 82
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

/**
 * Find the PNG IEND marker in a Uint8Array/Buffer and return the offset right after it.
 * Returns -1 if not found.
 */
function findIendOffset(buf) {
  // PNG headers and fake metadata are always within the first 128KB.
  // Limiting search to 128KB and using native Buffer.indexOf avoids 
  // scanning multi-megabyte TS segments in pure JS, which exceeds Cloudflare's 10ms Free CPU limit.
  const searchLimit = Math.min(buf.length, 128 * 1024);
  const searchBuf = Buffer.from(buf.buffer, buf.byteOffset, searchLimit);
  const idx = searchBuf.indexOf(PNG_IEND);
  if (idx !== -1) {
    return idx + PNG_IEND.length;
  }
  return -1;
}

/**
 * GET /api/v2/hianime/proxy/m3u8
 *
 * Fetches the upstream m3u8 playlist and rewrites segment URLs so they
 * pass through the /api/v2/hianime/proxy/ts endpoint, which strips
 * the PNG wrapper.
 *
 * Query params:
 *   url  – upstream m3u8 URL (required)
 */
export const hianimeM3u8ProxyController = async (c) => {
  try {
    const url = c.req.query('url');
    if (!url) {
      return c.json({ success: false, error: 'url query parameter is required' }, 400);
    }

    const accept = (c.req.header('accept') || '').toLowerCase();
    const isRawRequested = c.req.query('raw') === '1' || c.req.query('raw') === 'true' || c.req.query('format') === 'm3u8';

    // If accessed directly from a browser address bar or iframe (accepting text/html),
    // serve an embedded HTML5 video player powered by Hls.js so it plays immediately!
    if (!isRawRequested && accept.includes('text/html') && !accept.includes('application/vnd.apple.mpegurl')) {
      const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shirayuki Stream Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; display: flex; justify-content: center; align-items: center; overflow: hidden; font-family: sans-serif; }
    #player-container { width: 100%; height: 100%; position: relative; display: flex; justify-content: center; align-items: center; }
    video { width: 100%; height: 100%; object-fit: contain; }
    #status { position: absolute; top: 16px; left: 16px; color: #fff; background: rgba(0,0,0,0.7); padding: 6px 12px; border-radius: 6px; font-size: 13px; pointer-events: none; z-index: 10; font-weight: 500; }
  </style>
</head>
<body>
  <div id="player-container">
    <div id="status">Loading stream...</div>
    <video id="player" controls autoplay playsinline></video>
  </div>
  <script>
    const video = document.getElementById('player');
    const status = document.getElementById('status');
    const streamUrl = window.location.href + (window.location.href.includes('?') ? '&raw=1' : '?raw=1');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        maxFragLookUpTolerance: 0.25,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        status.textContent = 'Ready (' + (data.levels?.[0]?.height || 'HD') + 'p)';
        setTimeout(() => { status.style.opacity = '0'; status.style.transition = 'opacity 0.5s'; }, 2000);
        video.play().catch(() => {
          status.textContent = 'Click to Play';
          status.style.opacity = '1';
        });
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          status.textContent = 'Playback error: ' + data.type;
          status.style.opacity = '1';
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        status.style.display = 'none';
        video.play().catch(() => {});
      });
    } else {
      status.textContent = 'HLS is not supported in this browser.';
    }
  </script>
</body>
</html>`;
      return c.html(playerHtml);
    }

    const referer = c.req.query('referer') || c.req.header('referer') || 'https://zokoanime.video/';

    const resp = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: referer,
        Accept: '*/*',
      },
    });

    if (!resp.ok) {
      return c.json({ success: false, error: `Upstream returned ${resp.status}` }, 502);
    }

    let m3u8Content = await resp.text();
    if (!m3u8Content.startsWith('#EXTM3U')) {
      return c.json({ success: false, error: 'Upstream did not return valid m3u8' }, 502);
    }

    // Determine base URL for resolving relative paths
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    // Build the proxy base using forwarded headers if present
    const reqUrl = new URL(c.req.url);
    const forwardedHost = (c.req.header('x-forwarded-host') || '').split(',')[0].trim();
    const forwardedProto = (c.req.header('x-forwarded-proto') || '').split(',')[0].trim();
    const host = forwardedHost || reqUrl.host;
    const proto = forwardedProto ? `${forwardedProto}:` : reqUrl.protocol;
    const refererParam = referer ? `&referer=${encodeURIComponent(referer)}` : '';

    const proxyBase = `${proto}//${host}/api/v2/hianime/proxy/seg.ts?url=`;
    const m3u8ProxyBase = `${proto}//${host}/api/v2/hianime/proxy/playlist.m3u8?url=`;

    // Rewrite segment URLs
    const lines = m3u8Content.split('\n');
    const rewritten = lines.map((line) => {
      const trimmed = line.trim();

      // Skip comments/tags and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        // Check for URI= in EXT-X-MAP or EXT-X-KEY tags
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
            const absUri = uri.startsWith('http') ? uri : baseUrl + uri;
            return `URI="${proxyBase}${encodeURIComponent(absUri)}${refererParam}&ext=.ts"`;
          });
        }
        return line;
      }

      // This is a segment or sub-playlist URL line
      const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;

      // Sub-playlists (.m3u8) should go through the playlist proxy
      if (absUrl.endsWith('.m3u8') || absUrl.includes('.m3u8?') || absUrl.includes('.m3u8&')) {
        return `${m3u8ProxyBase}${encodeURIComponent(absUrl)}${refererParam}&ext=.m3u8`;
      }

      return `${proxyBase}${encodeURIComponent(absUrl)}${refererParam}&ext=.ts`;
    });

    return c.text(rewritten.join('\n'), 200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': 'no-cache',
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
};

/**
 * GET /api/v2/hianime/proxy/ts (and /seg.ts, /segment.ts)
 *
 * Fetches a TS segment from upstream, strips any PNG header if present,
 * streams data directly to the client without buffering delays, supports HTTP Range,
 * and sets long-lived immutable cache headers.
 *
 * Query params:
 *   url  – upstream segment URL (required)
 */
export const hianimeTsProxyController = async (c) => {
  try {
    const url = c.req.query('url');
    if (!url) {
      return c.json({ success: false, error: 'url query parameter is required' }, 400);
    }

    const referer = c.req.query('referer') || c.req.header('referer') || 'https://zokoanime.video/';
    const range = c.req.header('range');

    const headers = {
      'User-Agent': DEFAULT_UA,
      Referer: referer,
      Accept: '*/*',
    };
    if (range) {
      headers['Range'] = range;
    }

    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      return c.json({ success: false, error: `Upstream returned ${resp.status}` }, 502);
    }

    const statusCode = resp.status === 206 ? 206 : 200;
    const resHeaders = {
      'Content-Type': 'video/MP2T',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    const contentLength = resp.headers.get('content-length');
    const contentRange = resp.headers.get('content-range');
    if (contentLength) resHeaders['Content-Length'] = contentLength;
    if (contentRange) resHeaders['Content-Range'] = contentRange;

    const reader = resp.body.getReader();
    const { value: firstChunk, done } = await reader.read();

    if (done || !firstChunk) {
      return c.body(new Uint8Array(0), statusCode, resHeaders);
    }

    // Check if PNG-wrapped (starts with PNG magic: 89 50 4E 47)
    if (firstChunk.length > 70 && firstChunk[0] === 0x89 && firstChunk[1] === 0x50 && firstChunk[2] === 0x4e && firstChunk[3] === 0x47) {
      const chunks = [firstChunk];
      let totalLen = firstChunk.length;
      while (true) {
        const { value, done: chunkDone } = await reader.read();
        if (chunkDone) break;
        chunks.push(value);
        totalLen += value.length;
      }
      const fullBuf = new Uint8Array(totalLen);
      let offset = 0;
      for (const ch of chunks) {
        fullBuf.set(ch, offset);
        offset += ch.length;
      }
      let buf = fullBuf;
      const tsOffset = findIendOffset(buf);
      if (tsOffset > 0 && tsOffset < buf.length) {
        buf = buf.slice(tsOffset);
      }
      resHeaders['Content-Length'] = String(buf.length);
      return c.body(buf, statusCode, resHeaders);
    }

    // Pure MPEG-TS (starts with 0x47 sync byte) -> Stream chunks directly with zero buffering delay!
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(firstChunk);
      },
      async pull(controller) {
        try {
          const { value, done: chunkDone } = await reader.read();
          if (chunkDone) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      }
    });

    return c.body(stream, statusCode, resHeaders);
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
};
