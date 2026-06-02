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

const fetchJikanMetadata = async (malId, anilistId = null) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(`Jikan API returned status ${response.status}`);
  }
  const json = await response.json();
  const data = json?.data;
  if (!data) throw new Error('No data in Jikan response');
  
  return {
    id: anilistId ? parseInt(anilistId) : null,
    idMal: parseInt(malId),
    title: {
      romaji: data.title || null,
      english: data.title_english || data.title || null,
      native: data.title_japanese || data.title || null,
      userPreferred: data.title || null,
    },
    synonyms: data.title_synonyms || [],
    seasonYear: data.year || (data.aired?.from ? new Date(data.aired.from).getFullYear() : null),
    season: data.season ? data.season.toUpperCase() : null,
    format: data.type || null,
    studios: {
      nodes: (data.studios || []).map(s => ({ name: s.name })),
    }
  };
};

const fetchAniZipData = async (anilistId) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  const response = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(`AniZip API returned status ${response.status}`);
  }
  return await response.json();
};

const buildMetaFromAniZip = (aniZipData, anilistId) => {
  const mappings = aniZipData.mappings || {};
  const titles = aniZipData.titles || {};
  
  const romaji = titles['x-jat'] || titles.en || null;
  const english = titles.en || null;
  const native = titles.ja || null;
  
  // Extract all distinct titles as synonyms
  const synonyms = Array.from(new Set(Object.values(titles))).filter(Boolean);
  
  // Parse year from first episode airdate if available
  let seasonYear = null;
  if (aniZipData.episodes && aniZipData.episodes['1']?.airdate) {
    const airdate = aniZipData.episodes['1'].airdate;
    const match = airdate.match(/^\d{4}/);
    if (match) seasonYear = parseInt(match[0]);
  }
  
  return {
    id: parseInt(anilistId),
    idMal: mappings.mal_id ? parseInt(mappings.mal_id) : null,
    title: {
      romaji,
      english,
      native,
      userPreferred: english || romaji,
    },
    synonyms,
    seasonYear,
    season: null,
    format: mappings.type || null,
    studios: {
      nodes: []
    }
  };
};

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AniList GraphQL returned status ${response.status}`);
    }

    const result = await response.json();
    const media = result?.data?.Media;
    if (media) {
      cache.set(cacheKey, media, 86400); // Cache for 24 hours
      return media;
    }
  } catch (error) {
    console.error(`[Resolver] Failed to fetch AniList metadata for ${provider} ID ${id}:`, error.message);
    console.log(`[Resolver] Attempting fallback metadata resolution for ${provider} ID ${id}...`);

    try {
      let fallbackMeta = null;
      if (provider === 'mal') {
        fallbackMeta = await fetchJikanMetadata(id);
      } else if (provider === 'anilist') {
        const aniZipData = await fetchAniZipData(id);
        if (aniZipData) {
          const malId = aniZipData.mappings?.mal_id;
          if (malId) {
            try {
              fallbackMeta = await fetchJikanMetadata(malId, id);
            } catch (jikanErr) {
              console.warn(`[Resolver] Fallback Jikan query failed: ${jikanErr.message}. Relying on AniZip metadata.`);
            }
          }
          if (!fallbackMeta) {
            fallbackMeta = buildMetaFromAniZip(aniZipData, id);
          }
        }
      }

      if (fallbackMeta) {
        console.log(`[Resolver] Fallback metadata resolved successfully for ${provider} ID ${id}: ${JSON.stringify(fallbackMeta.title)}`);
        cache.set(cacheKey, fallbackMeta, 86400); // Cache for 24 hours
        return fallbackMeta;
      }
    } catch (fallbackErr) {
      console.error(`[Resolver] Fallback metadata resolution failed for ${provider} ID ${id}:`, fallbackErr.message);
    }
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
export const resolveExternalId = async (id, provider, scraperType = 'hianime', debugOptions = null) => {
  if (!id) return null;
  
  const logDebug = (msg) => {
    console.log(`[Resolver] ${msg}`);
    if (debugOptions && Array.isArray(debugOptions.logs)) {
      debugOptions.logs.push(msg);
    }
  };

  const cacheKey = `resolved:${scraperType}:${provider}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logDebug(`Found cached resolution: ${cached}`);
    return cached;
  }

  logDebug(`Resolving external ${provider} ID: ${id} for ${scraperType}`);

  // 1. Fetch metadata from AniList (with offline database fallback)
  let meta = await fetchAniListMetadata(id, provider);
  if (meta) {
    logDebug(`Fetched AniList metadata via GraphQL API: ${JSON.stringify(meta.title)}`);
  } else {
    logDebug(`AniList GraphQL metadata unavailable. Falling back to offline database...`);
    meta = findMetadataInOfflineDb(id, provider);
    if (meta) {
      logDebug(`Found match in offline DB: ${JSON.stringify(meta.title)}`);
    } else {
      logDebug(`No match found in offline DB either.`);
    }
  }

  if (!meta) {
    logDebug(`Failed to retrieve metadata for ${provider} ID ${id}`);
    return null;
  }

  // Determine search terms (using English, Romaji, and synonyms)
  const searchTerms = [
    meta.title?.english,
    meta.title?.romaji,
    meta.title?.userPreferred,
  ].filter(Boolean);

  // De-duplicate search terms case-insensitively
  const uniqueTerms = [];
  const lowerTerms = new Set();
  for (const term of searchTerms) {
    const lower = term.toLowerCase().trim();
    if (lower && !lowerTerms.has(lower)) {
      lowerTerms.add(lower);
      uniqueTerms.push(term);
    }
  }

  logDebug(`Search terms determined: ${JSON.stringify(uniqueTerms)}`);

  // 2. Search the scraper for candidate items
  const uniqueCandidates = new Map();

  for (const term of uniqueTerms) {
    try {
      let results = [];
      logDebug(`Querying ${scraperType} scraper for term: "${term}"`);
      if (scraperType === 'hianime') {
        const searchData = await getHianimeSearch({ q: term, page: 1 });
        results = searchData?.results || [];
      } else if (scraperType === 'animekai') {
        const searchData = await getAnimekaiSearchResults(term, 1);
        results = searchData?.animes || [];
      }
      
      logDebug(`Scraper search returned ${results.length} candidates for "${term}"`);
      for (const item of results) {
        if (item.id) {
          uniqueCandidates.set(item.id, item);
        }
      }
    } catch (err) {
      logDebug(`Scraper search error for term "${term}": ${err.message}`);
    }
  }

  const candidatesList = Array.from(uniqueCandidates.values());
  logDebug(`Total unique candidates found: ${candidatesList.length}`);
  if (!candidatesList.length) {
    logDebug(`No candidates found for any search term.`);
    return null;
  }

  // 3. Gather full details for top candidates to get premiered, studios, etc.
  const scoredCandidates = [];

  // Limit to top 5 candidates to avoid excessive scraping requests
  const candidatesToDetail = candidatesList.slice(0, 5);

  for (const candidate of candidatesToDetail) {
    let fullCandidate = { ...candidate };

    if (scraperType === 'hianime') {
      try {
        logDebug(`Fetching full details for candidate ID: ${candidate.id}`);
        const details = await getHianimeAnimeDetails({ animeId: candidate.id });
        if (details) {
          fullCandidate = { ...candidate, ...details };
        }
      } catch (err) {
        logDebug(`Failed to fetch details for candidate ${candidate.id}: ${err.message}`);
        // Fallback to basic candidate if details page fetch fails
      }
    }

    const score = computeMatchScore(fullCandidate, meta);
    logDebug(`Scored candidate "${candidate.title}" (${candidate.id}): ${score.toFixed(3)}`);
    scoredCandidates.push({ id: candidate.id, score, title: candidate.title });
  }

  // Score remaining candidates without full details (studio/season will default to 0.5)
  if (candidatesList.length > 5) {
    for (const candidate of candidatesList.slice(5)) {
      const score = computeMatchScore(candidate, meta);
      logDebug(`Scored candidate (no details) "${candidate.title}" (${candidate.id}): ${score.toFixed(3)}`);
      scoredCandidates.push({ id: candidate.id, score, title: candidate.title });
    }
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  logDebug(`Match scoring ranking:`);
  scoredCandidates.forEach(c => logDebug(`  - [Score: ${c.score.toFixed(3)}] Title: "${c.title}" (ID: ${c.id})`));

  const bestMatch = scoredCandidates[0];
  const THRESHOLD = 0.55;
  if (bestMatch) {
    logDebug(`Best match is "${bestMatch.title}" with score ${bestMatch.score.toFixed(3)}`);
    if (bestMatch.score >= THRESHOLD) {
      logDebug(`Score passes threshold ${THRESHOLD}. Caching resolved mapping.`);
      cache.set(cacheKey, bestMatch.id, 86400 * 7); // Cache resolved mapping for 7 days
      return bestMatch.id;
    } else {
      logDebug(`Score is below threshold ${THRESHOLD}. Rejecting match.`);
    }
  } else {
    logDebug(`No candidates to match.`);
  }

  return null;
};
