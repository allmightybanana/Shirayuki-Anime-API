import { getAnimekaiSearchResults } from '../scraper/search.js';
import { resolveBulkAnime } from '../../utils/anilist.js';
import { resolveExternalId } from '../../utils/resolver.js';
import { getAnimekaiEpisodes } from '../scraper/episodes.js';
import { findMetadataInOfflineDb } from '../../utils/offlineDb.js';

export const animekaiSearchController = async (c) => {
	try {
		const q = c.req.query('q');
		const anilistId = c.req.query('anilistId');
		const malId = c.req.query('malId');
		const page = parseInt(c.req.query('page')) || 1;
		const debug = c.req.query('debug') === 'true' || c.req.query('debug') === '1';

		// AniList ID or MAL ID resolution mode
		if (anilistId || malId) {
			const provider = anilistId ? 'anilist' : 'mal';
			const externalId = anilistId || malId;

			// Look up metadata from offline database for response enrichment
			const offlineMeta = findMetadataInOfflineDb(externalId, provider);

			const debugOptions = debug ? { logs: [] } : null;
			const resolvedId = await resolveExternalId(externalId, provider, 'animekai', debugOptions);
			if (!resolvedId) {
				return c.json(
					{
						success: false,
						error: `Could not resolve ${provider} ID "${externalId}" to an AnimeKai anime`,
						...(debug && { debugLogs: debugOptions.logs }),
					},
					404
				);
			}

			// Fetch episode data to build a useful result
			let animeData = null;
			try {
				animeData = await getAnimekaiEpisodes(resolvedId);
			} catch (err) {
				console.error(`[Search] Failed to fetch details for resolved ID ${resolvedId}:`, err.message);
			}

			return c.json({
				success: true,
				data: {
					resolvedFrom: { provider, id: externalId },
					offlineDbMatch: offlineMeta ? {
						anilistId: offlineMeta.id || null,
						malId: offlineMeta.idMal || null,
						title: offlineMeta.title || null,
						format: offlineMeta.format || null,
						seasonYear: offlineMeta.seasonYear || null,
						season: offlineMeta.season || null,
					} : null,
					animeId: resolvedId,
					title: animeData?.title || offlineMeta?.title?.userPreferred || null,
					totalEpisodes: animeData?.totalEpisodes || null,
					subTotal: animeData?.subTotal || null,
					dubTotal: animeData?.dubTotal || null,
					...(debug && { debugLogs: debugOptions.logs }),
				},
			});
		}

		// Normal keyword search mode
		if (!q) {
			return c.json(
				{
					success: false,
					error: 'Query parameter "q" or "anilistId" or "malId" is required',
				},
				400
			);
		}

		const data = await getAnimekaiSearchResults(q, page);
		if (data?.animes) {
			data.animes = await resolveBulkAnime(data.animes, q);
		}
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
