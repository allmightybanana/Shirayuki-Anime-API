import { load, axios } from '../../utils/scrapper-deps.js';
import { resolveMalId, getSkipTimes } from './aniskip.js';
import { getBrowserInstance, isServerless } from '../../utils/browser.js';
import { HIANIME_BASE_URL } from './_shared.js';
import { getHianimeEpisodeServers } from './episode-servers.js';

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const normalizeAnimeId = (animeEpisodeId) => {
  if (!animeEpisodeId) return null;

  return animeEpisodeId
    .split('#')[0]
    .split('?')[0]
    .replace(/^\/watch\//, '')
    .replace(/\/ep-\d+$/i, '')
    .replace(/\/$/, '')
    .trim() || null;
};

const parseEpisodeNumber = (animeEpisodeId, epQuery) => {
  if (epQuery && Number(epQuery) > 0) {
    return Number(epQuery);
  }

  if (!animeEpisodeId) return 1;

  const pathMatch = animeEpisodeId.match(/\/ep-(\d+)/i);
  if (pathMatch) return Number(pathMatch[1]);

  const queryMatch = animeEpisodeId.match(/[?#&]ep=(\d+)/i);
  if (queryMatch) return Number(queryMatch[1]);

  return 1;
};

const normalizeCategory = (category) => {
  const c = String(category || 'sub').toLowerCase().trim();
  if (c === 'dub' || c === 'd') return 'dub';
  if (c === 'hsub' || c === 'softsub') return 'hsub';
  return 'sub';
};

const normalizeServer = (server) => {
  const raw = String(server || 'hd-1').toLowerCase().replace(/\s+/g, '-').trim();
  return raw || 'hd-1';
};

const pageHeaders = (referer) => ({
  'User-Agent': DEFAULT_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  Referer: referer,
});

const parseServerList = ($, category) => {
  const block = $(`.player-servers .ps_-block[data-id="${category}"]`).first();
  if (!block.length) return [];

  return block
    .find('a.server-video')
    .map((_, el) => {
      const $el = $(el);
      const name = $el.text().trim() || null;
      const dataVideo = $el.attr('data-video') || null;
      const dataTab = $el.attr('data-tab') || null;
      return {
        name,
        nameId: name ? name.toLowerCase().replace(/\s+/g, '-') : null,
        embed: dataVideo,
        tab: dataTab,
      };
    })
    .get()
    .filter((s) => s.embed);
};

const pickServer = (servers, requestedServer) => {
  if (!servers.length) return null;

  const target = String(requestedServer || 'hd-1').toLowerCase().trim();

  const exact = servers.find((s) => s.nameId === target);
  if (exact) return exact;

  return servers[0];
};

const extractTracksFromEmbedUrl = (embedUrl) => {
  if (!embedUrl) return [];

  const tracks = [];
  const seen = new Set();
  const url = (() => { try { return new URL(embedUrl); } catch { return null; } })();
  if (!url) return [];

  const params = url.searchParams;

  const directSub = params.get('sub');
  if (directSub && !seen.has(directSub)) {
    seen.add(directSub);
    tracks.push({ file: directSub, label: 'English', kind: 'captions', default: true, forced: false });
  }

  for (const [key, value] of params.entries()) {
    if (!value || !/^https?:\/\//i.test(value)) continue;
    if (seen.has(value)) continue;

    let label = null;
    if (/^caption_\d+$/i.test(key) || /^c\d+_file$/i.test(key) || /^sub_\d+$/i.test(key)) {
      const idx = key.replace(/[^0-9]/g, '');
      const labelKey = key.startsWith('caption_')
        ? `sub_${idx}`
        : key.startsWith('c') && key.endsWith('_file')
        ? `c${idx}_label`
        : null;
      label = labelKey ? params.get(labelKey) : null;
    }

    if (label || /\.(vtt|ass|srt)$/i.test(value)) {
      seen.add(value);
      tracks.push({
        file: value,
        label: label || 'English',
        kind: 'captions',
        default: tracks.length === 0,
        forced: false,
      });
    }
  }

  return tracks;
};

const extractFirstM3u8 = (text) => {
  if (!text || typeof text !== 'string') return null;

  const match = text.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/i);
  return match ? match[0] : null;
};

const tryExtractM3u8FromPayload = (payload) => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return extractFirstM3u8(payload);
  }

  if (typeof payload === 'object') {
    const direct =
      payload?.file ||
      payload?.url ||
      payload?.source ||
      payload?.src ||
      payload?.m3u8 ||
      null;

    if (typeof direct === 'string' && /\.m3u8(\?|$)/i.test(direct)) {
      return direct;
    }

    if (Array.isArray(payload?.sources)) {
      const fromSources = payload.sources.find(
        (s) =>
          (typeof s?.file === 'string' && /\.m3u8(\?|$)/i.test(s.file)) ||
          (typeof s?.url === 'string' && /\.m3u8(\?|$)/i.test(s.url)) ||
          (typeof s?.src === 'string' && /\.m3u8(\?|$)/i.test(s.src))
      );

      if (fromSources?.file) return fromSources.file;
      if (fromSources?.url) return fromSources.url;
      if (fromSources?.src) return fromSources.src;
    }
  }

  return null;
};

const OBF_KEY = 'otaku-embed-v1';

function xor(str, key = OBF_KEY) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function deobfuscateZoko(blob, key = OBF_KEY) {
  try {
    const binary = Buffer.from(blob, 'base64').toString('latin1');
    return JSON.parse(decodeURIComponent(escape(xor(binary, key))));
  } catch {
    return null;
  }
}

function extractZokoDetails(html, embedUrl) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/window\.__P\s*=\s*["']([^"']+)["']/);
  if (!match) return null;

  const data = deobfuscateZoko(match[1]);
  if (!data || !data.src) return null;

  const tracks = (data.subtitles || [])
    .filter((s) => s.src || s.file)
    .map((s) => ({
      file: s.src || s.file,
      label: s.label || s.lang || 'English',
      kind: 'captions',
      default: Boolean(s.default),
      forced: false,
    }));

  return {
    m3u8: data.src,
    tracks,
    intro: data.skip?.intro?.start !== undefined ? data.skip.intro : null,
    outro: data.skip?.outro?.start !== undefined ? data.skip.outro : null,
    referer: 'https://zokoanime.video/',
  };
}

async function extractMegaplayDetails(html, embedUrl) {
  try {
    const urlObj = new URL(embedUrl);
    let realVideoId = null;
    if (html) {
      const $ = load(html);
      realVideoId = $('#megaplay-player').attr('data-id') || $('[data-id]').attr('data-id');
      if (!realVideoId) {
        const idMatch = html.match(/data-id=["']([^"']+)["']/i);
        if (idMatch) realVideoId = idMatch[1];
      }
    }
    if (!realVideoId) {
      const pathParts = urlObj.pathname.split('/');
      if (pathParts[1] === 'stream' && pathParts[3]) {
        realVideoId = pathParts[3];
      }
    }
    if (!realVideoId) return null;

    const getSourcesUrl = `${urlObj.origin}/stream/getSources?id=${encodeURIComponent(realVideoId)}`;
    const resp = await axios.get(getSourcesUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: `${urlObj.origin}/`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000,
    });

    const sourcesData = resp?.data?.sources;
    const file = sourcesData?.file || (Array.isArray(sourcesData) ? sourcesData[0]?.file : null);
    if (!file) return null;

    const tracks = (resp?.data?.tracks || [])
      .filter((t) => t.file)
      .map((t) => ({
        file: t.file,
        label: t.label || 'English',
        kind: t.kind || 'captions',
        default: Boolean(t.default),
        forced: false,
      }));

    return {
      m3u8: file,
      tracks,
      intro: resp?.data?.intro || null,
      outro: resp?.data?.outro || null,
      referer: `${urlObj.origin}/`,
    };
  } catch {
    return null;
  }
}

async function extractMegaCloudDetails(html, embedUrl) {
  try {
    const url = new URL(embedUrl);
    const extract = (pattern) => String(html).match(pattern)?.[1] ?? null;

    const clientKey =
      extract(/window\._xy_ws\s*=\s*['"`]([A-Za-z0-9]+)['"`]/) ||
      extract(/<meta\s+name=['"]_gg_fb['"]\s+content=['"]([A-Za-z0-9]+)['"]/i) ||
      extract(/_is_th:([A-Za-z0-9]+)/) ||
      (() => {
        const x = extract(/x\s*:\s*['"]([A-Za-z0-9]+)['"]/i);
        const y = extract(/y\s*:\s*['"]([A-Za-z0-9]+)['"]/i);
        const z = extract(/z\s*:\s*['"]([A-Za-z0-9]+)['"]/i);
        return x && y && z ? `${x}${y}${z}` : x ?? y ?? z ?? null;
      })();

    const id = url.pathname.match(/\/e-1\/([^/?]+)/i)?.[1];
    if (!id || !clientKey) return null;

    const pathMatch = url.pathname.match(/\/embed-2\/([^/]+\/)?e-1\//);
    const versionPath = pathMatch?.[0] ?? '/embed-2/v3/e-1/';

    const { data } = await axios.get(
      `https://${url.hostname}${versionPath}getSources?id=${encodeURIComponent(id)}&_k=${encodeURIComponent(clientKey)}`,
      {
        headers: { 'User-Agent': DEFAULT_UA, 'X-Requested-With': 'XMLHttpRequest', Referer: embedUrl },
        timeout: 10000,
      }
    );

    const m3u8 = tryExtractM3u8FromPayload(data);
    if (!m3u8) return null;

    const tracks = (data?.tracks || [])
      .filter((t) => t.file)
      .map((t) => ({
        file: t.file,
        label: t.label || 'English',
        kind: t.kind || 'captions',
        default: Boolean(t.default),
        forced: false,
      }));

    return {
      m3u8,
      tracks,
      intro: data?.intro || null,
      outro: data?.outro || null,
      referer: embedUrl,
    };
  } catch {
    return null;
  }
}

const isHlsResolvableServer = (nameId) => /^hd-\d+$/i.test(String(nameId || ''));

async function getBrowser() {
  return await getBrowserInstance({ useStealth: false });
}

export async function resolveEmbedDetails(watchUrl, embedUrl) {
  if (!embedUrl) return null;

  // 1. Fast path: sometimes the embed link itself is already an m3u8 URL.
  if (/\.m3u8(\?|$)/i.test(embedUrl)) {
    return { m3u8: embedUrl, tracks: [], referer: watchUrl };
  }

  // 2. Direct HTTP fetch of embed HTML
  let html = null;
  try {
    const res = await axios.get(embedUrl, {
      proxy: false,
      timeout: 15000,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: watchUrl || HIANIME_BASE_URL,
        Origin: HIANIME_BASE_URL,
      },
    });
    html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (err) {
    console.log('[resolveEmbedDetails] Direct axios fetch failed:', err.message);
  }

  if (html) {
    // 3. Check for ZokoAnime (__P obfuscated payload)
    const zoko = extractZokoDetails(html, embedUrl);
    if (zoko?.m3u8) {
      console.log('[resolveEmbedDetails] Successfully extracted ZokoAnime m3u8');
      return zoko;
    }

    // 4. Check for MegaPlay
    if (embedUrl.includes('megaplay')) {
      const megaplay = await extractMegaplayDetails(html, embedUrl);
      if (megaplay?.m3u8) {
        console.log('[resolveEmbedDetails] Successfully extracted MegaPlay m3u8');
        return megaplay;
      }
    }

    // 5. Check for MegaCloud / RabbitStream / RapidCloud
    if (embedUrl.includes('megacloud') || embedUrl.includes('rabbitstream') || embedUrl.includes('rapidcloud')) {
      const megacloud = await extractMegaCloudDetails(html, embedUrl);
      if (megacloud?.m3u8) {
        console.log('[resolveEmbedDetails] Successfully extracted MegaCloud m3u8');
        return megacloud;
      }
    }

    // 6. Direct m3u8 regex from HTML
    const directM3u8 = tryExtractM3u8FromPayload(html);
    if (directM3u8) {
      return { m3u8: directM3u8, tracks: [], referer: embedUrl };
    }
  }

  // 7. Constructed URL attempt
  try {
    const embedParsed = new URL(embedUrl);
    const pathParts = embedParsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const videoId = pathParts[pathParts.length - 1];

    if (videoId && /^[a-f0-9]{8,}$/i.test(videoId)) {
      const constructedUrl = `${embedParsed.origin}/public/stream/${videoId}/master.m3u8`;
      const headResp = await fetch(constructedUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': DEFAULT_UA },
      });
      if (headResp.ok) {
        return { m3u8: constructedUrl, tracks: [], referer: embedUrl };
      }
    }
  } catch (err) {}

  // 8. Serverless / Cloudscraper fallback
  if (isServerless) {
    try {
      const cloudscraper = (await import('cloudscraper')).default;
      const csRes = await cloudscraper({
        url: embedUrl,
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_UA,
          Referer: watchUrl,
        },
        timeout: 15000,
      });
      if (typeof csRes === 'string') {
        const zoko = extractZokoDetails(csRes, embedUrl);
        if (zoko?.m3u8) return zoko;
        const direct = tryExtractM3u8FromPayload(csRes);
        if (direct) return { m3u8: direct, tracks: [], referer: embedUrl };
      }
    } catch {}
    return null;
  }

  // 9. Puppeteer fallback (if available)
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(DEFAULT_UA);
    await page.setDefaultNavigationTimeout(25000);
    await page.setDefaultTimeout(20000);

    let capturedUrl = null;
    let resolveCapture = null;
    const capturePromise = new Promise((resolve) => {
      resolveCapture = resolve;
    });

    page.on('response', (response) => {
      const responseUrl = response.url();
      if (
        /\.m3u8(\?|$)/i.test(responseUrl) &&
        !responseUrl.includes('ping.gif') &&
        response.status() >= 200 &&
        response.status() < 400
      ) {
        capturedUrl = responseUrl;
        if (resolveCapture) resolveCapture(responseUrl);
      }
    });

    try {
      await page.setExtraHTTPHeaders({ Referer: watchUrl });
      await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Check if window.__P exists directly in DOM
      const evalP = await page.evaluate(() => window.__P).catch(() => null);
      if (evalP) {
        const zoko = extractZokoDetails(`<script>window.__P="${evalP}"</script>`, embedUrl);
        if (zoko?.m3u8) return zoko;
      }

      // Try triggering play
      await page.evaluate(() => {
        const btn = document.querySelector('.play-button, #player, .overlay, video');
        if (btn) btn.click();
      }).catch(() => {});

      const timerPromise = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
      await Promise.race([capturePromise, timerPromise]);

      if (capturedUrl) {
        return { m3u8: capturedUrl, tracks: [], referer: embedUrl };
      }
    } finally {
      await page.close().catch(() => {});
    }
  } catch (error) {
    console.error('[resolveEmbedDetails] Puppeteer error:', error.message);
  }

  return null;
}

export const getHianimeEpisodeSources = async ({ animeEpisodeId, ep, server, category }) => {
  const animeId = normalizeAnimeId(animeEpisodeId);
  if (!animeId) {
    throw new Error('animeEpisodeId query parameter is required');
  }

  const episodeNumber = parseEpisodeNumber(animeEpisodeId, ep);
  const normalizedCategory = normalizeCategory(category);
  const normalizedServer = normalizeServer(server);

  const watchUrl = `${HIANIME_BASE_URL}/watch/${animeId}/ep-${episodeNumber}`;

  const serverData = await getHianimeEpisodeServers({ animeEpisodeId: animeId, ep: episodeNumber });
  const serverList = serverData?.servers?.[normalizedCategory] || [];
  if (!serverList.length) {
    throw new Error(`No ${normalizedCategory.toUpperCase()} servers available for this episode`);
  }

  const picked = pickServer(serverList, normalizedServer);
  if (!picked?.embed) {
    throw new Error('Requested Hianime server is unavailable');
  }

  const shouldResolveHls = isHlsResolvableServer(picked.nameId);

  const [embedDetails, malId] = await Promise.all([
    shouldResolveHls
      ? resolveEmbedDetails(watchUrl, picked.embed).catch((error) => {
          console.error('[getHianimeEpisodeSources] Failed to resolve embed details:', error.message);
          return null;
        })
      : Promise.resolve(null),
    resolveMalId(animeId, animeId.replace(/-/g, ' ')).catch(() => null),
  ]);

  const fallbackTracks = extractTracksFromEmbedUrl(picked.embed);
  const { intro: aniskipIntro, outro: aniskipOutro } = await getSkipTimes(malId, episodeNumber).catch(() => ({ intro: null, outro: null }));

  // If HLS direct stream resolution succeeded, return m3u8
  if (embedDetails?.m3u8) {
    const tracks = embedDetails.tracks && embedDetails.tracks.length > 0
      ? embedDetails.tracks
      : fallbackTracks;

    return {
      animeId,
      title: serverData?.animeId || animeId,
      episode: episodeNumber,
      episodeSlug: `ep-${episodeNumber}`,
      sourcePage: watchUrl,
      malId: malId || null,
      sources: [
        {
          source: embedDetails.m3u8,
          type: 'm3u8',
          quality: null,
          referer: embedDetails.referer || picked.embed,
          server: picked.nameId || normalizedServer,
          category: normalizedCategory,
        },
      ],
      tracks,
      intro: embedDetails.intro ?? aniskipIntro,
      outro: embedDetails.outro ?? aniskipOutro,
    };
  }

  // Fallback to embed iframe URL if direct HLS could not be extracted
  return {
    animeId,
    title: serverData?.animeId || animeId,
    episode: episodeNumber,
    episodeSlug: `ep-${episodeNumber}`,
    sourcePage: watchUrl,
    malId: malId || null,
    sources: [
      {
        source: picked.embed,
        type: 'iframe',
        quality: null,
        referer: picked.embed,
        server: picked.nameId || normalizedServer,
        category: normalizedCategory,
      },
    ],
    tracks: fallbackTracks,
    intro: aniskipIntro,
    outro: aniskipOutro,
  };
};
