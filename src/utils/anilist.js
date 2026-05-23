import axios from 'axios';
import cache from './cache.js';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

// Helper to normalize strings for comparison
const normalizeTitle = (t) => {
  if (!t) return '';
  return String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Perform a single AniList GraphQL search query
 */
const queryAniList = async (query, variables) => {
  try {
    const response = await axios.post(
      ANILIST_GRAPHQL_URL,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 5000,
      }
    );
    return response.data?.data;
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error('AniList GraphQL Query Error:', error.response?.data || error.message);
    }
    return null;
  }
};

/**
 * Resolves AniList and MyAnimeList IDs for a single anime title.
 * Caches the result in NodeCache.
 */
export const resolveSingleAnime = async (title, jname, ename) => {
  const cleanTitle = String(title || ename || jname || '').trim();
  if (!cleanTitle) return { anilistId: null, malId: null };

  const cacheKey = `anilist:single:${normalizeTitle(cleanTitle)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Let's search by main title first
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
        }
      }
    }
  `;

  const data = await queryAniList(query, { search: cleanTitle });
  if (data?.Media) {
    const media = data.Media;
    const result = {
      anilistId: media.id || null,
      malId: media.idMal || null,
    };
    cache.set(cacheKey, result, 86400); // Cache for 24 hours
    return result;
  }

  // Fallback: try English name or Japanese name if they differ from main title
  if (ename && ename !== cleanTitle) {
    const enData = await queryAniList(query, { search: ename });
    if (enData?.Media) {
      const media = enData.Media;
      const result = {
        anilistId: media.id || null,
        malId: media.idMal || null,
      };
      cache.set(cacheKey, result, 86400);
      return result;
    }
  }

  const defaultResult = { anilistId: null, malId: null };
  cache.set(cacheKey, defaultResult, 3600); // Cache negative result for 1 hour to prevent spam
  return defaultResult;
};

/**
 * Resolves AniList and MyAnimeList IDs in bulk for a list of anime items.
 * Uses a single AniList page search query based on the main search term,
 * then maps items in memory using title-matching and local cache lookup.
 */
export const resolveBulkAnime = async (items, searchTerm) => {
  if (!items || !items.length) return items;

  // Step 1: Try to resolve as many as possible from cache
  const unresolved = [];
  const results = items.map((item) => {
    const itemCacheKey = `anilist:id:${item.id || normalizeTitle(item.title)}`;
    const cached = cache.get(itemCacheKey);
    if (cached) {
      return { ...item, ...cached };
    }
    unresolved.push(item);
    return { ...item, anilistId: null, malId: null };
  });

  if (!unresolved.length) return results;

  // Step 2: Fetch list of media matching the search term from AniList (max 30 items)
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 30) {
        media(search: $search, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
        }
      }
    }
  `;

  const queryTerm = String(searchTerm || '').trim();
  const aniListMediaList = [];

  if (queryTerm) {
    const data = await queryAniList(query, { search: queryTerm });
    if (data?.Page?.media) {
      aniListMediaList.push(...data.Page.media);
    }
  }

  // Helper to check if title matches any AniList title
  const isMatch = (item, media) => {
    const itemTitles = [
      normalizeTitle(item.title),
      normalizeTitle(item.ename),
      normalizeTitle(item.jname),
    ].filter(Boolean);

    const mediaTitles = [
      normalizeTitle(media.title?.romaji),
      normalizeTitle(media.title?.english),
      normalizeTitle(media.title?.native),
    ].filter(Boolean);

    return itemTitles.some((it) => mediaTitles.includes(it));
  };

  // Step 3: Match unresolved items using bulk results
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (item.anilistId || item.malId) continue; // Already resolved from cache

    // Try to find a match in the bulk AniList query
    const match = aniListMediaList.find((media) => isMatch(item, media));
    let mapping = null;

    if (match) {
      mapping = {
        anilistId: match.id || null,
        malId: match.idMal || null,
      };
    } else {
      // Step 4: If no match in bulk list, do a quick individual lookup (only for the top 5 unresolved items to prevent rate limits)
      if (i < 5) {
        const singleMapping = await resolveSingleAnime(item.title, item.jname, item.ename);
        if (singleMapping.anilistId || singleMapping.malId) {
          mapping = singleMapping;
        }
      }
    }

    if (mapping) {
      item.anilistId = mapping.anilistId;
      item.malId = mapping.malId;

      // Save mapping in cache
      const itemCacheKey = `anilist:id:${item.id || normalizeTitle(item.title)}`;
      cache.set(itemCacheKey, mapping, 86400); // 24 hours cache
    }
  }

  return results;
};
