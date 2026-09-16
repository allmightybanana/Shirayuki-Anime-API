import { HIANIME_BASE_URL, fetchApiJson, fetchPage } from './_shared.js';
import { getHianimeEpisodes } from './episodes.js';

const parseServerListForCategory = ($, category) => {
  const block = $(`.player-servers .ps_-block[data-id="${category}"]`).first();
  if (!block.length) return [];

  return block
    .find('a.server-video')
    .map((_, el) => {
      const $el = $(el);
      const name = $el.text().trim() || null;
      const embed = $el.attr('data-video') || null;
      const dataTab = $el.attr('data-tab') || null;
      return {
        name,
        nameId: name ? name.toLowerCase().replace(/\s+/g, '-') : null,
        embed,
        tab: dataTab,
      };
    })
    .get()
    .filter((s) => s.embed);
};

const parseAnimeEpisodeId = (animeEpisodeId) => {
  if (!animeEpisodeId) return { slug: null, ep: null };
  const clean = animeEpisodeId.split('#')[0].split('?')[0].replace(/^\/watch\//, '').replace(/\/$/, '');
  const epMatch = clean.match(/^([^/]+)\/ep-(\d+)$/i);
  if (epMatch) return { slug: epMatch[1], ep: Number(epMatch[2]) };

  return { slug: clean || null, ep: null };
};

const mapLinksToServerList = (links = [], category) => {
  return links.map((link, idx) => {
    let name = `Server ${idx + 1}`;
    let nameId = `hd-${idx + 1}`;
    if (link.includes('zokoanime')) {
      name = 'HD-1';
      nameId = 'hd-1';
    } else if (link.includes('megaplay') || link.includes('megacloud')) {
      name = 'HD-2';
      nameId = 'hd-2';
    }
    return {
      name,
      nameId,
      embed: link,
      tab: category,
    };
  });
};

export const getHianimeEpisodeServers = async ({ animeEpisodeId, ep } = {}) => {
  const { slug, ep: epFromId } = parseAnimeEpisodeId(animeEpisodeId);
  if (!slug) {
    throw new Error('animeEpisodeId query parameter is required');
  }

  const epNumber = Number(ep) > 0 ? Number(ep) : epFromId || 1;

  try {
    // Fast path: check if slug is directly an episode slug
    try {
      const directEp = await fetchApiJson(`/episode/${encodeURIComponent(slug)}`);
      if (directEp?.episode) {
        const ep = directEp.episode;
        const subLinks = ep?.link?.sub || [];
        const dubLinks = ep?.link?.dub || [];
        if (subLinks.length || dubLinks.length) {
          return {
            source: `${HIANIME_BASE_URL}/watch/${ep.slug || slug}`,
            animeId: directEp.anime?.slug || slug,
            episode: ep.episodeNumber || epNumber,
            servers: {
              sub: mapLinksToServerList(subLinks, 'sub'),
              dub: mapLinksToServerList(dubLinks, 'dub'),
              hsub: [],
            },
          };
        }
      }
    } catch {
      // not a direct episode slug
    }

    const episodesData = await getHianimeEpisodes({ animeId: slug });
    const matchedEp = episodesData?.episodes?.find((e) => Number(e.number) === Number(epNumber));

    let subLinks = matchedEp?.link?.sub || [];
    let dubLinks = matchedEp?.link?.dub || [];

    if (!subLinks.length && !dubLinks.length && matchedEp?.episodeId) {
      try {
        const epDetail = await fetchApiJson(`/episode/${encodeURIComponent(matchedEp.episodeId)}`);
        subLinks = epDetail?.episode?.link?.sub || [];
        dubLinks = epDetail?.episode?.link?.dub || [];
      } catch {
        // ignore
      }
    }

    if (subLinks.length || dubLinks.length) {
      return {
        source: `${HIANIME_BASE_URL}/watch/${slug}`,
        animeId: slug,
        episode: epNumber,
        servers: {
          sub: mapLinksToServerList(subLinks, 'sub'),
          dub: mapLinksToServerList(dubLinks, 'dub'),
          hsub: [],
        },
      };
    }
  } catch (apiErr) {
    console.error('[getHianimeEpisodeServers] API failed, falling back to HTML fetch:', apiErr.message);
  }

  const { url, $ } = await fetchPage(`/watch/${slug}/ep-${epNumber}`, {
    referer: `${HIANIME_BASE_URL}/`,
  });

  return {
    source: url,
    animeId: slug,
    episode: epNumber,
    servers: {
      sub: parseServerListForCategory($, 'sub'),
      dub: parseServerListForCategory($, 'dub'),
      hsub: parseServerListForCategory($, 'hsub'),
    },
  };
};
