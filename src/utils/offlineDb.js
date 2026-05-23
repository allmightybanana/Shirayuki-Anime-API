import fs from 'fs';
import path from 'path';
import axios from 'axios';

let malIndex = null;
let anilistIndex = null;
let isDbLoaded = false;

const DB_PATH = path.join(process.cwd(), 'anime-offline-database.json');
const METADATA_PATH = path.join(process.cwd(), 'offline-db-metadata.json');
const GITHUB_API = 'https://api.github.com/repos/manami-project/anime-offline-database/releases/latest';

const findDatabaseFile = () => {
  const pathsToCheck = [
    DB_PATH,
    path.join(process.cwd(), '..', 'allanime-api', 'anime-offline-database.json'),
    path.join(process.cwd(), '..', 'anizone', 'anime-offline-database.json'),
  ];

  for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

const buildIndexes = (data) => {
  if (!data || !data.data) return;

  const t0 = Date.now();
  console.log('[OfflineDB] Building in-memory search indexes...');

  const newMalIndex = new Map();
  const newAnilistIndex = new Map();

  for (const entry of data.data) {
    let malId = null;
    let anilistId = null;

    if (entry.sources) {
      for (const src of entry.sources) {
        if (src.includes('myanimelist.net/anime/')) {
          malId = src.split('/').pop();
        } else if (src.includes('anilist.co/anime/')) {
          anilistId = src.split('/').pop();
        }
      }
    }

    if (!malId && !anilistId) continue;

    const record = {
      id: anilistId ? parseInt(anilistId) : null,
      idMal: malId ? parseInt(malId) : null,
      title: {
        romaji: entry.title || null,
        english: entry.synonyms?.find(s => /^[a-zA-Z0-9\s\-:!?,.]+$/.test(s)) || entry.title || null,
        native: entry.title || null,
        userPreferred: entry.title || null,
      },
      synonyms: entry.synonyms || [],
      seasonYear: entry.animeSeason?.year || null,
      season: entry.animeSeason?.season || null,
      format: entry.type || null,
      studios: null,
    };

    if (malId) {
      newMalIndex.set(String(malId), record);
    }
    if (anilistId) {
      newAnilistIndex.set(String(anilistId), record);
    }
  }

  malIndex = newMalIndex;
  anilistIndex = newAnilistIndex;
  isDbLoaded = true;

  console.log(`[OfflineDB] Finished indexing in ${Date.now() - t0}ms. Loaded ${malIndex.size} MAL entries and ${anilistIndex.size} AniList entries.`);
};

/**
 * Checks for updates on GitHub and downloads the database if a new version is available
 */
export const checkForUpdates = async () => {
  console.log('[OfflineDB] Checking for database updates...');
  let metadata = {};
  if (fs.existsSync(METADATA_PATH)) {
    try {
      metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
    } catch (e) {
      metadata = {};
    }
  }

  const now = Date.now();
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  // Throttle API checks to once per 12 hours if we already have the DB
  if (metadata.lastChecked && (now - metadata.lastChecked < TWELVE_HOURS) && fs.existsSync(DB_PATH)) {
    console.log('[OfflineDB] Skipped update check (recently checked).');
    return;
  }

  try {
    let downloadUrl = null;
    let tag_name = 'latest';

    try {
      const response = await axios.get(GITHUB_API, { timeout: 8000 });
      tag_name = response.data.tag_name;

      if (metadata.version === tag_name && fs.existsSync(DB_PATH)) {
        console.log(`[OfflineDB] Already at latest version: ${tag_name}`);
        metadata.lastChecked = Date.now();
        fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
        return;
      }

      const asset = response.data.assets.find(
        (a) => a.name === 'anime-offline-database-minified.json' || a.name === 'anime-offline-database.json'
      );
      if (asset) {
        downloadUrl = asset.browser_download_url;
      }
    } catch (apiError) {
      if (apiError.response?.status === 403) {
        console.warn('[OfflineDB] GitHub API rate limit hit. Falling back to direct URL...');
        downloadUrl = 'https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json';
      } else {
        throw apiError;
      }
    }

    if (!downloadUrl) {
      console.error('[OfflineDB] Could not find download URL for the database.');
      return;
    }

    console.log(`[OfflineDB] Downloading database from ${downloadUrl}...`);
    const dbResponse = await axios.get(downloadUrl, { timeout: 30000 });
    
    fs.writeFileSync(DB_PATH, JSON.stringify(dbResponse.data), 'utf8');
    
    // Clear build index cache so it re-builds next lookup
    isDbLoaded = false;
    malIndex = null;
    anilistIndex = null;

    fs.writeFileSync(
      METADATA_PATH,
      JSON.stringify({
        version: tag_name,
        lastChecked: Date.now(),
        lastUpdated: Date.now()
      }, null, 2),
      'utf8'
    );
    console.log('[OfflineDB] Database update complete.');
  } catch (error) {
    console.error('[OfflineDB] Update check failed:', error.message);
  }
};

/**
 * Initializes the daily update check
 */
export const initOfflineDb = () => {
  // Run update check immediately (non-blocking)
  checkForUpdates();

  // Schedule daily check (every 24 hours)
  setInterval(() => {
    checkForUpdates();
  }, 24 * 60 * 60 * 1000);
};

export const loadDb = () => {
  if (isDbLoaded) return true;

  let dbPath = findDatabaseFile();
  if (!dbPath) {
    console.error('[OfflineDB] anime-offline-database.json not found. Triggering synchronous check/download...');
    // If not found anywhere, we'll try to check/download
    return false;
  }

  try {
    console.log(`[OfflineDB] Loading database from: ${dbPath}`);
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    buildIndexes(data);
    return true;
  } catch (error) {
    console.error('[OfflineDB] Failed to load/parse offline database:', error.message);
    return false;
  }
};

/**
 * Resolves external ID metadata from the offline database
 */
export const findMetadataInOfflineDb = (id, provider) => {
  if (!isDbLoaded) {
    const success = loadDb();
    if (!success) {
      // Try checking for updates (which downloads it)
      console.log('[OfflineDB] Database missing or failed to load. Attempting update check...');
      checkForUpdates().then(() => {
        loadDb();
      });
    }
  }

  if (!isDbLoaded) return null;

  const index = provider === 'anilist' ? anilistIndex : malIndex;
  const record = index.get(String(id));
  return record || null;
};
