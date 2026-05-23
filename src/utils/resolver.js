import axios from 'axios';
import cache from './cache.js';
import { getHianimeSearch } from '../hianime/scraper/search.js';
import { getHianimeAnimeDetails } from '../hianime/scraper/anime.js';
import { getAnimekaiSearchResults } from '../animekai/scraper/search.js';
import { findMetadataInOfflineDb } from './offlineDb.js';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

// Helper to normalize strings for comparison
const normalizeString = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

// Jaccard similarity between two strings based on word tokens
const getJaccardSimilarity = (str1, str2) => {
  const s1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const s2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  if (s1.size === 0 || s2.size === 0) return 0;

  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
};

/**
 * Fetch AniList metadata for an external ID (supporting both AniList ID and MAL ID)
 */
const fetchAniListMetadata = async (id, provider) => {
  const cacheKey = `anilist:meta:${provider}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query ($id: Int, $idMal: Int) {
      Media(id: $id, idMal: $idMal, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        synonyms
        seasonYear
        season
        format
        studios(isMain: true) {
          nodes {
            name
          }
        }
      }
    }
  `;

  const variables = {};
  if (provider === 'anilist') {
    variables.id = parseInt(id);
  } else if (provider === 'mal') {
    variables.idMal = parseInt(id);
  } else {
    return null;
  }

  try {
    const response = await axios.post(
      ANILIST_GRAPHQL_URL,
      { query, variables },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 5000,
      }
    );
    const media = response.data?.data?.Media;
    if (media) {
      cache.set(cacheKey, media, 86400); // Cache for 24 hours
      return media;
    }
  } catch (error) {
    console.error(`[Resolver] Failed to fetch AniList metadata for ${provider} ID ${id}:`, error.message);
  }
  return null;
};

/**
 * Helper to normalize format types
 */
const normalizeFormat = (format) => {
  const f = String(format || '').toLowerCase();
  if (f.includes('tv')) return 'tv';
  if (f.includes('movie')) return 'movie';
  if (f.includes('special')) return 'special';
  if (f.includes('ova')) return 'ova';
  if (f.includes('ona')) return 'ona';
  if (f.includes('music')) return 'music';
  return f;
};

/**
 * Computes a match score between a candidate show and the target AniList metadata.
 */
const computeMatchScore = (candidate, meta) => {
  let score = 0;

  // 1. Title Matching (45% weight)
  const candidateTitles = [candidate.title, candidate.ename, candidate.jname].filter(Boolean);
  const targetTitles = [
    meta.title?.romaji,
    meta.title?.english,
    meta.title?.native,
    meta.title?.userPreferred,
    ...(meta.synonyms || []),
  ].filter(Boolean);

  let maxTitleScore = 0;
  for (const cTitle of candidateTitles) {
    const normCTitle = normalizeString(cTitle);
    for (const tTitle of targetTitles) {
      const normTTitle = normalizeString(tTitle);
      if (normCTitle === normTTitle) {
        maxTitleScore = 1.0;
        break;
      }
      const sim = getJaccardSimilarity(cTitle, tTitle);
      if (sim > maxTitleScore) maxTitleScore = sim;

      // Substring bonus
      if (normCTitle.includes(normTTitle) || normTTitle.includes(normCTitle)) {
        const subScore = Math.min(normCTitle.length, normTTitle.length) / Math.max(normCTitle.length, normTTitle.length);
        const adjustedSub = 0.5 + 0.5 * subScore;
        if (adjustedSub > maxTitleScore) maxTitleScore = adjustedSub;
      }
    }
    if (maxTitleScore === 1.0) break;
  }
  score += maxTitleScore * 0.45;

  // 2. Year Matching (20% weight)
  let yearScore = 0.5; // Default if year info is missing
  let candidateYear = null;

  // Try parsing from details or stats
  if (candidate.stats?.year) {
    candidateYear = parseInt(candidate.stats.year);
  } else if (candidate.info?.premiered) {
    const match = String(candidate.info.premiered).match(/\d{4}/);
    if (match) candidateYear = parseInt(match[0]);
  } else if (candidate.duration) {
    const match = String(candidate.duration).match(/\b\d{4}\b/);
    if (match) candidateYear = parseInt(match[0]);
  }

  if (candidateYear && meta.seasonYear) {
    const diff = Math.abs(candidateYear - meta.seasonYear);
    if (diff === 0) yearScore = 1.0;
    else if (diff === 1) yearScore = 0.5;
    else if (diff === 2) yearScore = 0.2;
    else yearScore = 0.0;
  }
  score += yearScore * 0.2;

  // 3. Season Matching (15% weight)
  let seasonScore = 0.5; // Default if season info is missing
  let candidateSeason = null;

  if (candidate.info?.premiered) {
    const premiered = String(candidate.info.premiered).toLowerCase();
    if (premiered.includes('spring')) candidateSeason = 'SPRING';
    else if (premiered.includes('summer')) candidateSeason = 'SUMMER';
    else if (premiered.includes('fall')) candidateSeason = 'FALL';
    else if (premiered.includes('winter')) candidateSeason = 'WINTER';
  }

  if (candidateSeason && meta.season) {
    seasonScore = candidateSeason === String(meta.season).toUpperCase() ? 1.0 : 0.0;
  }
  score += seasonScore * 0.15;

  // 4. Format/Type Matching (10% weight)
  let formatScore = 0.0;
  const candidateFormat = normalizeFormat(candidate.type || candidate.stats?.type);
  const targetFormat = normalizeFormat(meta.format);

  if (candidateFormat && targetFormat) {
    formatScore = candidateFormat === targetFormat ? 1.0 : 0.0;
  }
  score += formatScore * 0.1;

  // 5. Studio/Producer Matching (10% weight)
  let studioScore = 0.5; // Default if missing
  const targetStudios = (meta.studios?.nodes || []).map(node => normalizeString(node.name)).filter(Boolean);

  let candidateStudioList = [];
  if (candidate.info?.studios) {
    candidateStudioList = (Array.isArray(candidate.info.studios) ? candidate.info.studios : [candidate.info.studios])
      .map(s => typeof s === 'object' ? s.name : s)
      .map(normalizeString)
      .filter(Boolean);
  } else if (candidate.info?.studio) {
    candidateStudioList = [normalizeString(candidate.info.studio)].filter(Boolean);
  }

  if (candidateStudioList.length && targetStudios.length) {
    const hasMatch = candidateStudioList.some(cs => targetStudios.some(ts => ts.includes(cs) || cs.includes(ts)));
    studioScore = hasMatch ? 1.0 : 0.0;
  }
  score += studioScore * 0.1;

  return score;
};

/**
 * Resolves an external ID (AniList or MAL) to a Scraper ID
 */
export const resolveExternalId = async (id, provider, scraperType = 'hianime') => {
  if (!id) return null;
  const cacheKey = `resolved:${scraperType}:${provider}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. Fetch metadata from AniList (with offline database fallback)
  let meta = await fetchAniListMetadata(id, provider);
  if (!meta) {
    console.log(`[Resolver] AniList GraphQL metadata unavailable. Falling back to offline database for ${provider} ID ${id}...`);
    meta = findMetadataInOfflineDb(id, provider);
  }
  if (!meta) return null;

  // Determine search terms (using English, Romaji, and synonyms)
  const searchTerms = [
    meta.title?.english,
    meta.title?.romaji,
    meta.title?.userPreferred,
  ].filter(Boolean);

  // 2. Search the scraper for candidate items
  const uniqueCandidates = new Map();

  for (const term of searchTerms) {
    try {
      let results = [];
      if (scraperType === 'hianime') {
        const searchData = await getHianimeSearch({ q: term, page: 1 });
        results = searchData?.results || [];
      } else if (scraperType === 'animekai') {
        const searchData = await getAnimekaiSearchResults(term, 1);
        results = searchData?.animes || [];
      }

      for (const item of results) {
        if (item.id) {
          uniqueCandidates.set(item.id, item);
        }
      }
    } catch (err) {
      console.error(`[Resolver] Search error for term "${term}":`, err.message);
    }
  }

  const candidatesList = Array.from(uniqueCandidates.values());
  if (!candidatesList.length) return null;

  // 3. Gather full details for top candidates to get premiered, studios, etc.
  const scoredCandidates = [];

  // Limit to top 5 candidates to avoid excessive scraping requests
  const candidatesToDetail = candidatesList.slice(0, 5);

  for (const candidate of candidatesToDetail) {
    let fullCandidate = { ...candidate };

    if (scraperType === 'hianime') {
      try {
        const details = await getHianimeAnimeDetails({ animeId: candidate.id });
        if (details) {
          fullCandidate = { ...candidate, ...details };
        }
      } catch (err) {
        // Fallback to basic candidate if details page fetch fails
      }
    }

    const score = computeMatchScore(fullCandidate, meta);
    scoredCandidates.push({ id: candidate.id, score, title: candidate.title });
  }

  // Score remaining candidates without full details (studio/season will default to 0.5)
  if (candidatesList.length > 5) {
    for (const candidate of candidatesList.slice(5)) {
      const score = computeMatchScore(candidate, meta);
      scoredCandidates.push({ id: candidate.id, score, title: candidate.title });
    }
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  console.log(`[Resolver] Match scoring for ${provider} ID ${id} (${meta.title?.english || meta.title?.romaji}):`);
  scoredCandidates.forEach(c => console.log(`  - [${c.score.toFixed(3)}] ${c.title} (${c.id})`));

  const bestMatch = scoredCandidates[0];
  // Threshold requirement: 0.55
  if (bestMatch && bestMatch.score >= 0.55) {
    cache.set(cacheKey, bestMatch.id, 86400 * 7); // Cache resolved mapping for 7 days
    return bestMatch.id;
  }

  return null;
};
