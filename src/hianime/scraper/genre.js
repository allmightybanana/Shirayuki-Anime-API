import { HIANIME_BASE_URL, fetchPage, extractFlwItems, extractPagination } from './_shared.js';
import { getHianimeSearch } from './search.js';

export const getHianimeGenre = async ({ genre, page } = {}) => {
  const slug = String(genre || '').trim().toLowerCase();
  if (!slug) {
    throw new Error('genre path parameter is required');
  }
  const normalizedPage = Number(page) > 0 ? Number(page) : 1;

  try {
    const { url, $ } = await fetchPage(`/genre/${slug}`, {
      searchParams: { page: normalizedPage },
      referer: `${HIANIME_BASE_URL}/`,
    });

    return {
      source: url,
      genre: slug,
      pagination: extractPagination($),
      results: extractFlwItems($),
    };
  } catch (err) {
    const searchRes = await getHianimeSearch({ q: slug, page: normalizedPage });
    return {
      source: `${HIANIME_BASE_URL}/genre/${slug}`,
      genre: slug,
      pagination: searchRes.pagination,
      results: searchRes.results,
    };
  }
};
