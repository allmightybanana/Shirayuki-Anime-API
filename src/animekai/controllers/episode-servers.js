import { getAnimekaiEpisodeServers } from '../scraper/episode-servers.js';
import { resolveExternalId } from '../../utils/resolver.js';

export const animekaiEpisodeServersController = async (c) => {
	try {
		let animeEpisodeId = c.req.query('animeEpisodeId');
		const ep = c.req.query('ep');
		const provider = c.req.query('provider');

		if (!animeEpisodeId) {
			return c.json(
				{
					success: false,
					error: 'animeEpisodeId query parameter is required',
				},
				400
			);
		}

		// Resolve external IDs (AniList/MAL) to AnimeKai anime ID
		if (provider && (provider === 'anilist' || provider === 'mal')) {
			const resolvedId = await resolveExternalId(animeEpisodeId, provider, 'animekai');
			if (!resolvedId) {
				return c.json(
					{
						success: false,
						error: `Could not resolve ${provider} ID "${animeEpisodeId}" to an AnimeKai anime`,
					},
					404
				);
			}
			animeEpisodeId = resolvedId;
		}

		const data = await getAnimekaiEpisodeServers({ animeEpisodeId, ep });
		return c.json({
			success: true,
			data,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error.message,
			},
			500
		);
	}
};
