import { axios } from '../../utils/scrapper-deps.js';
import { USER_AGENT } from '../../utils/constants.js';

const ANILIST_API_URL = 'https://graphql.anilist.co';
const MIRURO_BASE_URL = 'https://www.miruro.tv';

const anilistQuery = async (query, variables = {}) => {
  const { data } = await axios.post(
    ANILIST_API_URL,
    { query, variables },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    }
  );
  return data.data;
};

export const getMiruroEpisodes = async (animeId) => {
  if (!animeId || typeof animeId !== 'string' || animeId.trim() === '') {
    throw new Error('Invalid anime id');
  }

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { english romaji }
        episodes
        status
        format
        nextAiringEpisode {
          episode
        }
      }
    }
  `;

  const data = await anilistQuery(query, { id: parseInt(animeId, 10) });
  const media = data?.Media;

  if (!media) {
    throw new Error('Anime not found');
  }

  const title = media.title?.english || media.title?.romaji || 'Unknown';
  const totalEpisodes = media.episodes;
  const nextAiringEp = media.nextAiringEpisode?.episode || null;

  // Determine episode count - use next airing episode if total is unknown
  let episodeCount = totalEpisodes;
  if (!episodeCount && nextAiringEp) {
    episodeCount = nextAiringEp;
  } else if (!episodeCount) {
    episodeCount = 0;
  }

  // Generate episode list
  const episodes = [];
  if (episodeCount > 0) {
    for (let i = 1; i <= episodeCount; i++) {
      episodes.push({
        number: i,
        title: `${title} Episode ${i}`,
        episodeId: `${animeId}?ep=${i}`,
        href: `/info/${animeId}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}#ep=${i}`,
        watchUrl: `${MIRURO_BASE_URL}/watch/${animeId}?ep=${i}`,
        isAiring: nextAiringEp === i,
      });
    }
  }

  return {
    source: `${MIRURO_BASE_URL}/info/${animeId}`,
    animeId,
    title,
    totalEpisodes: episodeCount,
    episodes,
    nextAiringEpisode: nextAiringEp,
    format: media.format,
    status: media.status,
    note: media.episodes ? null : 'Episode count estimated from next airing episode',
  };
};
