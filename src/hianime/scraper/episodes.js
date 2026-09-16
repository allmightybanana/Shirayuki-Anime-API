import {
  HIANIME_BASE_URL,
  fetchApiJson,
  fetchPage,
  parseNumber,
  toAbsoluteUrl,
} from './_shared.js';
import { getHianimeAnimeDetails } from './anime.js';

const stripLeadingNumber = (raw, number) => {
  if (!raw) return raw;
  const trimmed = raw.trim();
  const re = new RegExp(`^${number}\\s+`);
  return trimmed.replace(re, '').trim() || trimmed;
};

export const getHianimeEpisodes = async ({ animeId } = {}) => {
  const rawSlug = String(animeId || '').trim();
  if (!rawSlug) {
    throw new Error('animeId path parameter is required');
  }

  const cleanSlug = rawSlug
    .replace(/^\/watch\//, '')
    .replace(/^\/anime\//, '')
    .replace(/\/ep-\d+$/i, '')
    .replace(/^\//, '')
    .trim();

  try {
    let animeDetails = await getHianimeAnimeDetails({ animeId: cleanSlug });
    let internalId = animeDetails.internalId;
    let totalEps = parseNumber(animeDetails.stats?.sub) || parseNumber(animeDetails.stats?.dub) || 100;

    if (!internalId) {
      const animeRes = await fetchApiJson(`/anime/${encodeURIComponent(cleanSlug)}`);
      internalId = animeRes?.anime?._id;
      if (animeRes?.anime?.totalEpisodes) {
        totalEps = parseNumber(animeRes.anime.totalEpisodes) || totalEps;
      }
    }

    if (internalId) {
      const epData = await fetchApiJson(`/episodes/${internalId}?start=1&end=${totalEps || 2000}`);
      const rawEpisodes = Array.isArray(epData?.episodes) ? epData.episodes : [];

      if (rawEpisodes.length > 0) {
        const total = rawEpisodes.length;
        const ranges = [];
        for (let i = 1; i <= total; i += 100) {
          const end = Math.min(i + 99, total);
          ranges.push(`${i}-${end}`);
        }

        const episodes = rawEpisodes.map((ep) => {
          const epNum = ep.episodeNumber;
          const epSlug = ep.slug || (Array.isArray(ep.slugs) && ep.slugs[0]) || `${cleanSlug}-episode-${epNum}`;
          return {
            number: epNum,
            title: ep.title || `Episode ${epNum}`,
            href: `/watch/${epSlug}`,
            url: `${HIANIME_BASE_URL}/watch/${epSlug}`,
            episodeId: epSlug,
            link: ep.link || null,
          };
        });

        const resolvedAnimeId = animeDetails?.id || cleanSlug;
        return {
          source: `${HIANIME_BASE_URL}/watch/${resolvedAnimeId}`,
          animeId: resolvedAnimeId,
          totalEpisodes: episodes.length,
          ranges: ranges.length ? ranges : ['1-100'],
          episodes,
        };
      }
    }
  } catch (apiErr) {
    console.error('[getHianimeEpisodes] API fetch failed, falling back to HTML fetch:', apiErr.message);
  }

  // HTML fallback
  const { url, $ } = await fetchPage(`/watch/${cleanSlug}/ep-1`, {
    referer: `${HIANIME_BASE_URL}/`,
  });

  const ranges = $('#detail-ss-list .ss-list')
    .map((_, el) => $(el).attr('data-range') || null)
    .get()
    .filter(Boolean);

  const episodes = $('#detail-ss-list .ssl-item.ep-item')
    .map((_, el) => {
      const $a = $(el);
      const href = $a.attr('href')?.trim() || null;
      const number = parseNumber($a.attr('data-num')) || parseNumber(href);
      const rawName = $a.find('.ep-name').first().text().trim() || $a.attr('title')?.trim() || null;
      const name = number ? stripLeadingNumber(rawName, number) : rawName;

      return {
        number,
        title: name,
        href,
        url: toAbsoluteUrl(href),
        episodeId: href ? href.replace(/^\/watch\//, '') : null,
      };
    })
    .get()
    .filter((ep) => ep.number !== null);

  return {
    source: url,
    animeId: cleanSlug,
    totalEpisodes: episodes.length,
    ranges,
    episodes,
  };
};

