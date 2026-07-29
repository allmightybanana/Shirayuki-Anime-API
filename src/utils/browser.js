const isServerless = Boolean(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.VERCEL ||
  process.env.VERCEL_ENV
);

let browserInstance = null;

/**
 * Get a singleton browser instance suitable for the current execution environment.
 * Uses @sparticuz/chromium in serverless environments (Netlify, AWS Lambda, Vercel)
 * and standard puppeteer/puppeteer-extra locally or in Docker.
 * 
 * @param {Object} options
 * @param {boolean} [options.useStealth=false] - Whether to use puppeteer-extra-plugin-stealth
 * @returns {Promise<import('puppeteer-core').Browser>}
 */
export async function getBrowserInstance({ useStealth = false } = {}) {
  if (browserInstance) {
    try {
      if (browserInstance.isConnected()) {
        return browserInstance;
      }
    } catch {
      browserInstance = null;
    }
  }

  if (isServerless) {
    console.log('[getBrowserInstance] Launching browser in Serverless environment using @sparticuz/chromium');
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteerCore = (await import('puppeteer-core')).default;

    // Optional graphics configuration for Lambda/Netlify environments
    if (typeof chromium.setGraphicsMode === 'function') {
      chromium.setGraphicsMode = false;
    }

    const launchArgs = {
      args: [
        ...(chromium.args || []),
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process',
        '--disable-gpu',
      ],
      defaultViewport: chromium.defaultViewport || { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    };

    if (useStealth) {
      const puppeteerExtra = (await import('puppeteer-extra')).default;
      const stealth = (await import('puppeteer-extra-plugin-stealth')).default;
      puppeteerExtra.puppeteer = puppeteerCore;
      puppeteerExtra.use(stealth());
      browserInstance = await puppeteerExtra.launch(launchArgs);
    } else {
      browserInstance = await puppeteerCore.launch(launchArgs);
    }
  } else {
    console.log('[getBrowserInstance] Launching browser in standard Node/Docker environment');
    const launchArgs = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchArgs.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    if (useStealth) {
      const puppeteerExtra = (await import('puppeteer-extra')).default;
      const stealth = (await import('puppeteer-extra-plugin-stealth')).default;
      puppeteerExtra.use(stealth());
      browserInstance = await puppeteerExtra.launch(launchArgs);
    } else {
      const puppeteer = (await import('puppeteer')).default;
      browserInstance = await puppeteer.launch(launchArgs);
    }
  }

  return browserInstance;
}

export { isServerless };
