import {
  HIANIME_BASE_URL,
  fetchApiJson,
  fetchPage,
  parseFlwItem,
  parseNumber,
  toAbsoluteUrl,
  getAnimeId,
} from './_shared.js';

const textOf = ($el) => $el?.text()?.trim() || null;

const parseInfoBlock = ($) => {
  const info = {};

  $('.anisc-info .item').each((_, el) => {
    const $item = $(el);
    const head = textOf($item.find('.item-head').first());
    if (!head) return;
    const key = head.replace(/:$/, '').trim().toLowerCase();

    if ($item.hasClass('item-list')) {
      const values = $item
        .find('a')
        .map((__, a) => {
          const $a = $(a);
          return {
            name: textOf($a),
            slug: ($a.attr('href') || '').split('/').filter(Boolean).pop() || null,
            href: $a.attr('href') || null,
          };
        })
        .get()
        .filter((v) => v.name);
      info[key] = values;
    } else {
      const $name = $item.find('.name').first();
      const $text = $item.find('.text').first();
      info[key] = textOf($name) || textOf($text) || null;
    }
  });

  return info;
};

export const getHianimeAnimeDetails = async ({ animeId } = {}) => {
  const rawSlug = String(animeId || '').trim();
  if (!rawSlug) {
    throw new Error('animeId path parameter is required');
  }

  const cleanSlug = rawSlug.replace(/^\/anime\//, '').replace(/^\//, '').trim();

  try {
    let data = null;

    // 1. Try direct anime slug lookup
    try {
      data = await fetchApiJson(`/anime/${encodeURIComponent(cleanSlug)}`);
    } catch (err) {
      // 2. If direct lookup fails, cleanSlug might be an episode slug
      try {
        const epData = await fetchApiJson(`/episode/${encodeURIComponent(cleanSlug)}`);
        if (epData?.anime?.slug) {
          try {
            data = await fetchApiJson(`/anime/${encodeURIComponent(epData.anime.slug)}`);
          } catch {
            data = { anime: epData.anime };
          }
        } else if (epData?.anime) {
          data = { anime: epData.anime };
        }
      } catch {
        // not an episode slug
      }

      // 3. Search by cleaned title
      if (!data) {
        const cleanedTerm = cleanSlug
          .replace(/-episode-\d+.*$/i, '')
          .replace(/-\d+$/i, '')
          .replace(/-[a-z0-9]{6}$/i, '')
          .replace(/-/g, ' ')
          .trim();

        const searchRes = await fetchApiJson('/search', {
          method: 'POST',
          data: { title: cleanedTerm || cleanSlug.replace(/-/g, ' ') },
        });

        const candidates = Array.isArray(searchRes) ? searchRes : [];
        if (candidates.length > 0) {
          const best = candidates[0];
          const bestSlug = best.slug || (Array.isArray(best.slugs) ? best.slugs[0] : null);
          if (bestSlug && bestSlug !== cleanSlug) {
            try {
              data = await fetchApiJson(`/anime/${encodeURIComponent(bestSlug)}`);
            } catch {
              data = { anime: best };
            }
          } else {
            data = { anime: best };
          }
        }
      }

      if (!data) {
        throw err;
      }
    }

    const a = data.anime || data;
    const parsedYear = a.Aired ? parseNumber(String(a.Aired).match(/\b\d{4}\b/)?.[0]) : null;
    const genres = (a.genres || []).map((g) => ({
      name: g,
      slug: String(g).toLowerCase().replace(/\s+/g, '-'),
      href: `/genre/${String(g).toLowerCase().replace(/\s+/g, '-')}`,
    }));

    const resolvedSlug = a.slug || cleanSlug;
    const firstEpSlug = a.episodes?.[0]?.slug || resolvedSlug;

    return {
      source: `${HIANIME_BASE_URL}/anime/${resolvedSlug}`,
      id: resolvedSlug,
      internalId: a._id || null,
      title: a.title || a.English || null,
      jname: a.Japanese || null,
      ename: a.English || null,
      description: a.synopsis || null,
      poster: a.image || a.landScapeImage || null,
      cover: a.landScapeImage || a.image || null,
      stats: {
        pg: a.Rating || null,
        type: a.Type || null,
        year: parsedYear,
        sub: typeof a.totalSubbed === 'number' ? a.totalSubbed : parseNumber(a.totalSubbed),
        dub: typeof a.totalDubbed === 'number' ? a.totalDubbed : parseNumber(a.totalDubbed),
      },
      info: {
        genres,
        status: a.Status || null,
        aired: a.Aired || null,
        premiered: a.Premiered || null,
        duration: a.Duration || null,
        score: a.Score || null,
        mal_id: a.mal_id || null,
        producers: a.Producers || null,
      },
      watch: {
        href: `/watch/${firstEpSlug}`,
        url: `${HIANIME_BASE_URL}/watch/${firstEpSlug}`,
      },
      recommended: [],
    };
  } catch (apiErr) {
    console.error('[getHianimeAnimeDetails] API fetch failed, falling back to HTML fetch:', apiErr.message);
    const { url, $ } = await fetchPage(`/anime/${cleanSlug}`, {
      referer: `${HIANIME_BASE_URL}/`,
    });

    const $title = $('.anisc-detail .film-name.d-title').first();
    const title = textOf($title);
    const jname = $title.attr('data-jp')?.trim() || null;
    const ename = $title.attr('data-en')?.trim() || null;

    const posterStyle = $('.anis-cover').first().attr('style') || '';
    const cover = (posterStyle.match(/url\(['"]?([^'")]+)['"]?\)/) || [])[1] || null;
    const poster = $('.anisc-poster img').first().attr('src') || null;

    const description = textOf($('.film-description .text').first());

    const $stats = $('.film-stats').first();
    const subCount = parseNumber(textOf($stats.find('.tick-item.tick-sub').first()));
    const dubCount = parseNumber(textOf($stats.find('.tick-item.tick-dub').first()));
    const pg = textOf($stats.find('.tick-item.tick-pg').first());
    const statItems = $stats
      .find('.item')
      .map((_, el) => textOf($(el)))
      .get()
      .filter(Boolean);
    const type = statItems[0] || null;
    const year = parseNumber(statItems[1]);

    const watchHref = $('.film-buttons a.btn-play').attr('href') || null;
    const watchUrl = toAbsoluteUrl(watchHref);

    const info = parseInfoBlock($);

    const recommended = $('h2.cat-heading')
      .filter((_, el) => $(el).text().trim().toLowerCase() === 'recommended for you')
      .first()
      .closest('section')
      .find('.flw-item')
      .map((_, el) => parseFlwItem($, el))
      .get();

    return {
      source: url,
      id: getAnimeId(`/anime/${cleanSlug}`),
      title,
      jname,
      ename,
      description,
      poster,
      cover,
      stats: {
        pg,
        type,
        year,
        sub: subCount,
        dub: dubCount,
      },
      info,
      watch: {
        href: watchHref,
        url: watchUrl,
      },
      recommended,
    };
  }
};

