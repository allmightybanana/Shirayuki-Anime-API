const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// PNG IEND marker: 49 45 4E 44 AE 42 60 82
const PNG_IEND = new Uint8Array([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

/**
 * Find the PNG IEND marker in a Uint8Array and return the offset right after it.
 * Returns -1 if not found.
 */
function findIendOffset(buf) {
  const len = PNG_IEND.length;
  for (let i = 0; i <= buf.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (buf[i + j] !== PNG_IEND[j]) {
        match = false;
        break;
      }
    }
    if (match) return i + len;
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

    const resp = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_UA,
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

    // Build the proxy base for TS segments
    const reqUrl = new URL(c.req.url);
    const proxyBase = `${reqUrl.protocol}//${reqUrl.host}/api/v2/hianime/proxy/ts?url=`;

    // Rewrite segment URLs
    const lines = m3u8Content.split('\n');
    const rewritten = lines.map((line) => {
      const trimmed = line.trim();

      // Skip comments/tags and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        // But check for URI= in EXT-X-MAP or EXT-X-KEY tags
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
            const absUri = uri.startsWith('http') ? uri : baseUrl + uri;
            return `URI="${proxyBase}${encodeURIComponent(absUri)}"`;
          });
        }
        return line;
      }

      // This is a segment URL line
      const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;

      // Sub-playlists (.m3u8) should go through the m3u8 proxy, not the TS proxy
      if (absUrl.endsWith('.m3u8') || absUrl.includes('.m3u8?')) {
        const m3u8ProxyBase = `${reqUrl.protocol}//${reqUrl.host}/api/v2/hianime/proxy/m3u8?url=`;
        return m3u8ProxyBase + encodeURIComponent(absUrl);
      }

      return proxyBase + encodeURIComponent(absUrl);
    });

    return c.text(rewritten.join('\n'), 200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
};

/**
 * GET /api/v2/hianime/proxy/ts
 *
 * Fetches a PNG-wrapped TS segment from upstream, strips the PNG header
 * (everything up to and including the IEND marker), and returns the raw
 * MPEG-TS data.
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

    const resp = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: '*/*',
      },
    });

    if (!resp.ok) {
      return c.json({ success: false, error: `Upstream returned ${resp.status}` }, 502);
    }

    const arrayBuf = await resp.arrayBuffer();
    let buf = new Uint8Array(arrayBuf);

    // Check if the segment is PNG-wrapped (starts with PNG magic: 89 50 4E 47)
    if (buf.length > 70 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const tsOffset = findIendOffset(buf);
      if (tsOffset > 0 && tsOffset < buf.length) {
        buf = buf.slice(tsOffset);
      }
    }

    return c.body(buf, 200, {
      'Content-Type': 'video/MP2T',
      'Content-Length': String(buf.length),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
};
