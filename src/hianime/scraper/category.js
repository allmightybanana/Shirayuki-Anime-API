import { HIANIME_BASE_URL, fetchPage, extractFlwItems, extractPagination } from './_shared.js';
import { getHianimeHomePage } from './home.js';
import { getHianimeSearch } from './search.js';

const KNOWN_CATEGORIES = new Set([
  'most-popular',
  'most-favorite',
  'top-airing',
  'recently-updated',
  'recently-added',
  'top-upcoming',
  'latest-completed',
  'subbed-anime',
  'dubbed-anime',
  'movie',
  'tv',
  'ova',
  'ona',
  'special',
]);

export const getHianimeCategory = async ({ category, page } = {}) => {
  const slug = String(category || '').trim().toLowerCase();
  if (!slug) {
    throw new Error('category path parameter is required');
  }
  const normalizedPage = Number(page) > 0 ? Number(page) : 1;

  try {
    const { url, $ } = await fetchPage(`/${slug}`, {
      searchParams: { page: normalizedPage },
      referer: `${HIANIME_BASE_URL}/`,
    });

    return {
      source: url,
      category: slug,
      isKnown: KNOWN_CATEGORIES.has(slug),
      pagination: extractPagination($),
      results: extractFlwItems($),
    };
  } catch (err) {
    try {
      const home = await getHianimeHomePage();
      let list = [];
      if (slug.includes('popular') || slug.includes('favorite')) {
        list = home.top10?.day || [];
      } else if (slug.includes('airing') || slug.includes('updated')) {
        list = home.trending || [];
      } else {
        list = home.latestEpisodes || home.trending || [];
      }

      if (list.length > 0) {
        return {
          source: `${HIANIME_BASE_URL}/${slug}`,
          category: slug,
          isKnown: KNOWN_CATEGORIES.has(slug),
          pagination: { currentPage: 1, hasNextPage: false, totalPages: 1 },
          results: list,
        };
      }
    } catch {
      // ignore
    }

    const searchRes = await getHianimeSearch({ q: slug.replace(/-/g, ' '), page: normalizedPage });
    return {
      source: `${HIANIME_BASE_URL}/${slug}`,
      category: slug,
      isKnown: KNOWN_CATEGORIES.has(slug),
      pagination: searchRes.pagination,
      results: searchRes.results,
    };
  }
};
