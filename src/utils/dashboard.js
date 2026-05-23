export const renderDashboard = () => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shirayuki API V2 — Developer Dashboard</title>
  <meta name="description" content="A premium, state-of-the-art interactive playground and developer documentation dashboard for Shirayuki Anime Scraper API v2.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-color: #0b0d19;
      --card-bg: rgba(17, 20, 38, 0.65);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      
      --primary: #a855f7;
      --primary-glow: rgba(168, 85, 247, 0.4);
      --secondary: #06b6d4;
      --secondary-glow: rgba(6, 182, 212, 0.4);
      --accent: #ec4899;
      
      --font-sans: 'Outfit', sans-serif;
      --font-mono: 'Fira Code', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.15) 0%, transparent 40%);
      background-attachment: fixed;
    }

    /* Container */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 3rem;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px var(--primary-glow);
    }

    .logo-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }

    .logo-text h1 {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(to right, #ffffff, #a855f7, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .logo-text p {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .header-links {
      display: flex;
      gap: 1.5rem;
    }

    .badge {
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      color: #d8b4fe;
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      background-color: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px #22c55e;
    }

    /* Hero Section */
    .hero {
      text-align: center;
      margin-bottom: 4rem;
    }

    .hero h2 {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1rem;
      letter-spacing: -1px;
    }

    .hero h2 span {
      background: linear-gradient(135deg, var(--primary) 30%, var(--secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero p {
      font-size: 1.15rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Main Dashboard Grid */
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 4rem;
    }

    @media (max-width: 1024px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 2rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 15px 40px rgba(168, 85, 247, 0.05);
    }

    .card-title {
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }

    .card-title svg {
      width: 24px;
      height: 24px;
      color: var(--primary);
    }

    /* Playground Inputs */
    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .input-field, select {
      width: 100%;
      background: rgba(11, 13, 25, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 0.75rem 1rem;
      color: white;
      font-family: var(--font-sans);
      font-size: 0.95rem;
      transition: all 0.2s;
    }

    .input-field:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
    }

    .btn-group {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn {
      flex: 1;
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.85rem 1.5rem;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--primary));
      color: white;
      box-shadow: 0 4px 15px var(--primary-glow);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.6);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-main);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    /* Response Viewer */
    .response-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .status-pill {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      font-weight: 600;
    }

    .status-pill.error {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .response-viewer {
      background: #060810;
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.25rem;
      max-height: 480px;
      overflow-y: auto;
      position: relative;
    }

    pre {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      line-height: 1.5;
      color: #9cdcfe;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .json-key {
      color: #9cdcfe;
    }

    .json-string {
      color: #ce9178;
    }

    .json-number {
      color: #b5cea8;
    }

    .json-boolean {
      color: #569cd6;
    }

    .json-null {
      color: #569cd6;
    }

    /* URL Bar */
    .url-bar {
      background: rgba(11, 13, 25, 0.5);
      border: 1px solid var(--card-border);
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 1.5rem;
    }

    .url-text {
      color: var(--secondary);
      overflow-x: auto;
      white-space: nowrap;
      flex-grow: 1;
    }

    .copy-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }

    /* Docs Section */
    .docs-section {
      margin-top: 4rem;
    }

    .docs-header {
      margin-bottom: 2rem;
    }

    .docs-header h3 {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .api-card {
      background: rgba(20, 24, 46, 0.4);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .api-card:hover {
      border-color: rgba(6, 182, 212, 0.3);
      transform: translateY(-2px);
    }

    .api-method {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }

    .method-get {
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.3);
    }

    .api-path {
      font-family: var(--font-mono);
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #fff;
    }

    .api-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    footer {
      text-align: center;
      margin-top: 6rem;
      padding: 2rem 0;
      border-top: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    footer a {
      color: var(--primary);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-container">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </div>
        <div class="logo-text">
          <h1>Shirayuki</h1>
          <p>Anime Scraper API V2</p>
        </div>
      </div>
      <div class="header-links">
        <div class="badge">
          <div class="badge-dot"></div>
          Operational
        </div>
        <div class="badge" style="background: rgba(6, 182, 212, 0.1); border-color: rgba(6, 182, 212, 0.3); color: #99f6e4;">
          V2.0.0
        </div>
      </div>
    </header>

    <div class="hero">
      <h2>Interactive <span>Developer Playground</span></h2>
      <p>Test scraper endpoints directly, fetch mapped AniList and MyAnimeList IDs in real-time, and read JSON results instantly.</p>
    </div>

    <div class="grid">
      <!-- Playground Inputs -->
      <div class="card">
        <div class="card-title">
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          Configure Endpoint
        </div>

        <div class="form-group">
          <label for="provider">Provider</label>
          <select id="provider" onchange="updatePlayground()">
            <option value="hianime">HiAnime (Recommended)</option>
            <option value="animekai">AnimeKai</option>
          </select>
        </div>

        <div class="form-group">
          <label for="endpoint">Endpoint</label>
          <select id="endpoint" onchange="updatePlayground()">
            <!-- Options dynamically loaded -->
          </select>
        </div>

        <div id="dynamic-inputs">
          <!-- Inputs dynamically populated -->
        </div>

        <div class="btn-group">
          <button class="btn btn-primary" onclick="sendRequest()">
            Send Request
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Live Output -->
      <div class="card" style="display: flex; flex-direction: column;">
        <div class="card-title">
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
          </svg>
          Interactive Output
        </div>

        <div class="url-bar">
          <span class="url-text" id="endpoint-url">/api/v2/hianime/home</span>
          <button class="copy-btn" onclick="copyUrl()" title="Copy URL">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
            </svg>
          </button>
        </div>

        <div class="response-header">
          <span>STATUS: <span id="response-status" class="status-pill">READY</span></span>
          <span id="response-time">0 ms</span>
        </div>

        <div class="response-viewer">
          <button class="copy-btn" style="position: absolute; right: 1rem; top: 1rem; z-index: 10;" onclick="copyJson()" title="Copy JSON">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
            </svg>
          </button>
          <pre id="json-output">{ "message": "Execute a request to view live JSON data..." }</pre>
        </div>
      </div>
    </div>

    <!-- API Reference Docs -->
    <div class="docs-section">
      <div class="docs-header">
        <h3>API Endpoint Reference</h3>
        <p style="color: var(--text-muted); margin-top: 0.25rem;">Standard GET request endpoints supported by Shirayuki.</p>
      </div>

      <div class="docs-grid" id="docs-reference">
        <!-- Documentation dynamically generated -->
      </div>
    </div>

    <footer>
      <p>Built with Hono & Node.js. Revamped with ❤️ for high-performance scraping.</p>
    </footer>
  </div>

  <script>
    const ENDPOINTS = {
      hianime: [
        { id: 'home', name: 'Home/Discover Page', path: '/api/v2/hianime/home', inputs: [] },
        { id: 'search', name: 'Search Anime (with AniList/MAL mappings)', path: '/api/v2/hianime/search', inputs: [{ name: 'q', label: 'Query Keyword', type: 'text', default: 'One Piece' }, { name: 'page', label: 'Page Number', type: 'number', default: '1' }] },
        { id: 'search-advanced', name: 'Advanced Search', path: '/api/v2/hianime/search/advanced', inputs: [{ name: 'q', label: 'Query Keyword', type: 'text', default: 'Naruto' }, { name: 'type', label: 'Format (tv, movie, ova)', type: 'text', default: '' }, { name: 'genres', label: 'Genres (e.g. action, romance)', type: 'text', default: '' }] },
        { id: 'details', name: 'Anime Info / Details', path: '/api/v2/hianime/anime/{animeId}', inputs: [{ name: 'animeId', label: 'Anime Slug ID', type: 'text', default: 'one-piece' }] },
        { id: 'episodes', name: 'Anime Episodes List', path: '/api/v2/hianime/anime/{animeId}/episodes', inputs: [{ name: 'animeId', label: 'Anime Slug ID', type: 'text', default: 'one-piece' }] },
        { id: 'servers', name: 'Episode Streaming Servers', path: '/api/v2/hianime/episode/servers', inputs: [{ name: 'animeEpisodeId', label: 'Episode ID / Watch Slug', type: 'text', default: 'one-piece' }, { name: 'ep', label: 'Episode Number', type: 'number', default: '1' }] },
        { id: 'sources', name: 'Streaming Server Sources (M3U8)', path: '/api/v2/hianime/episode/sources', inputs: [{ name: 'animeEpisodeId', label: 'Episode ID / Watch Slug', type: 'text', default: 'one-piece' }, { name: 'ep', label: 'Episode Number', type: 'number', default: '1' }, { name: 'server', label: 'Server Name', type: 'text', default: 'hd-1' }, { name: 'category', label: 'Language Category (sub, dub)', type: 'text', default: 'sub' }] },
        { id: 'schedule', name: 'Broadcast Schedule', path: '/api/v2/hianime/schedule', inputs: [{ name: 'date', label: 'Schedule Date (YYYY-MM-DD)', type: 'text', default: '2026-05-23' }] }
      ],
      animekai: [
        { id: 'home', name: 'Home Page', path: '/api/v2/animekai/home', inputs: [] },
        { id: 'search', name: 'Search Anime (with AniList/MAL mappings)', path: '/api/v2/animekai/search', inputs: [{ name: 'q', label: 'Query Keyword', type: 'text', default: 'One Piece' }, { name: 'page', label: 'Page Number', type: 'number', default: '1' }] },
        { id: 'search-advanced', name: 'Advanced Search', path: '/api/v2/animekai/search/advanced', inputs: [{ name: 'q', label: 'Query Keyword', type: 'text', default: 'One Piece' }, { name: 'page', label: 'Page Number', type: 'number', default: '1' }] },
        { id: 'details', name: 'Anime Details', path: '/api/v2/animekai/anime/{animeId}', inputs: [{ name: 'animeId', label: 'Anime Slug ID', type: 'text', default: 'one-piece-dk6r' }] },
        { id: 'episodes', name: 'Anime Episodes', path: '/api/v2/animekai/anime/{animeId}/episodes', inputs: [{ name: 'animeId', label: 'Anime Slug ID', type: 'text', default: 'one-piece-dk6r' }] },
        { id: 'sources', name: 'Episode Streaming Sources', path: '/api/v2/animekai/episode/sources', inputs: [{ name: 'animeEpisodeId', label: 'Episode Slug ID', type: 'text', default: 'one-piece-dk6r' }, { name: 'ep', label: 'Episode Number', type: 'number', default: '1' }, { name: 'server', label: 'Server Name', type: 'text', default: 'server-1' }, { name: 'category', label: 'Category (sub, dub)', type: 'text', default: 'sub' }] }
      ]
    };

    function updatePlayground() {
      const provider = document.getElementById('provider').value;
      const endpointSelect = document.getElementById('endpoint');
      const selectedEndpointId = endpointSelect.value;
      
      // Update endpoint list
      endpointSelect.innerHTML = '';
      ENDPOINTS[provider].forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.id;
        opt.textContent = ep.name;
        if (ep.id === selectedEndpointId) {
          opt.selected = true;
        }
        endpointSelect.appendChild(opt);
      });

      const activeEndpoint = ENDPOINTS[provider].find(ep => ep.id === endpointSelect.value) || ENDPOINTS[provider][0];
      
      // Populate input fields
      const inputsDiv = document.getElementById('dynamic-inputs');
      inputsDiv.innerHTML = '';
      
      activeEndpoint.inputs.forEach(inp => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = \`
          <label for="inp-\${inp.name}">\${inp.label}</label>
          <input type="\${inp.type}" id="inp-\&quot;\${inp.name}\&quot;" class="input-field" value="\${inp.default}" oninput="updateUrlBar()">
        \`;
        inputsDiv.appendChild(div);
      });

      updateUrlBar();
    }

    function getFormattedUrl() {
      const provider = document.getElementById('provider').value;
      const endpointId = document.getElementById('endpoint').value;
      const endpoint = ENDPOINTS[provider].find(ep => ep.id === endpointId);
      if (!endpoint) return '';

      let path = endpoint.path;
      const params = {};

      endpoint.inputs.forEach(inp => {
        const val = document.getElementById(\`inp-"\${inp.name}"\`).value;
        if (path.includes(\`{\${inp.name}}\`)) {
          path = path.replace(\`{\${inp.name}}\`, encodeURIComponent(val));
        } else {
          if (val) {
            params[inp.name] = val;
          }
        }
      });

      const qString = new URLSearchParams(params).toString();
      return path + (qString ? '?' + qString : '');
    }

    function updateUrlBar() {
      const fullUrl = getFormattedUrl();
      document.getElementById('endpoint-url').textContent = fullUrl;
    }

    async function sendRequest() {
      const relativeUrl = getFormattedUrl();
      const statusPill = document.getElementById('response-status');
      const timeSpan = document.getElementById('response-time');
      const jsonOutput = document.getElementById('json-output');

      statusPill.textContent = 'FETCHING';
      statusPill.className = 'status-pill';
      jsonOutput.innerHTML = 'Loading...';

      const startTime = performance.now();

      try {
        const resp = await fetch(relativeUrl);
        const elapsed = Math.round(performance.now() - startTime);
        timeSpan.textContent = \`\${elapsed} ms\`;
        
        statusPill.textContent = resp.status;
        if (resp.ok) {
          statusPill.className = 'status-pill';
          const json = await resp.json();
          jsonOutput.innerHTML = highlightJson(json);
        } else {
          statusPill.className = 'status-pill error';
          const txt = await resp.text();
          jsonOutput.innerHTML = txt;
        }
      } catch (err) {
        statusPill.textContent = 'FAILED';
        statusPill.className = 'status-pill error';
        jsonOutput.innerHTML = err.message;
      }
    }

    function highlightJson(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }

    function copyUrl() {
      const url = window.location.origin + document.getElementById('endpoint-url').textContent;
      navigator.clipboard.writeText(url);
      alert('Endpoint URL copied to clipboard!');
    }

    function copyJson() {
      const text = document.getElementById('json-output').innerText;
      navigator.clipboard.writeText(text);
      alert('JSON response copied to clipboard!');
    }

    function generateDocs() {
      const docsGrid = document.getElementById('docs-reference');
      docsGrid.innerHTML = '';
      
      const allDocs = [...ENDPOINTS.hianime.map(e => ({ ...e, prov: 'HiAnime' })), ...ENDPOINTS.animekai.map(e => ({ ...e, prov: 'AnimeKai' }))];
      
      allDocs.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'api-card';
        card.innerHTML = \`
          <span class="api-method method-get">GET</span>
          <span class="badge" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; float: right;">\${ep.prov}</span>
          <div class="api-path">\${ep.path}</div>
          <div class="api-desc">\${ep.name}</div>
        \`;
        docsGrid.appendChild(card);
      });
    }

    // Initialize Page
    updatePlayground();
    generateDocs();
  </script>
</body>
</html>`;
};
