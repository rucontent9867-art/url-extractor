import { chromium, Browser, BrowserContext } from 'playwright';

let isBrowserAvailable: boolean | null = null;
let lastCheckTime = 0;

// Container-optimized Chromium arguments to prevent crashes in sandboxes
const CONTAINER_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--no-zygote',
  '--single-process',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,NetworkService',
  '--blink-settings=imagesEnabled=true',
];

/**
 * Safely tries to launch Playwright browser.
 * Returns null gracefully if browser executable or system libraries are not available or unstable.
 */
export async function getSafeBrowser(): Promise<Browser | null> {
  const now = Date.now();
  if (isBrowserAvailable === false && now - lastCheckTime < 60000) {
    return null;
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: CONTAINER_CHROMIUM_ARGS,
      timeout: 10000,
    });
    isBrowserAvailable = true;
    lastCheckTime = now;
    return browser;
  } catch (err: any) {
    isBrowserAvailable = false;
    lastCheckTime = now;
    console.info(
      `[BrowserPool] Headless browser unavailable or restricted in environment (${err?.message?.split('\n')[0] || 'not available'}). Utilizing synthetic DOM engine.`
    );
    return null;
  }
}

/**
 * Checks if browser instance is currently alive and connected
 */
export function isBrowserAlive(browser: Browser | null): boolean {
  if (!browser) return false;
  try {
    return browser.isConnected();
  } catch {
    return false;
  }
}

/**
 * Creates a safe browser context with polyfills injected (such as esbuild's __name helper)
 * to prevent ReferenceError: __name is not defined during page.evaluate calls.
 */
export async function createSafeBrowserContext(
  browser: Browser,
  options: Parameters<Browser['newContext']>[0] = {}
): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  
  // Inject init script globally to all pages created under this context
  await context.addInitScript({
    content: `
      (function() {
        var noopName = function(target, value) { return target; };
        try {
          if (typeof window !== 'undefined') {
            window.__name = noopName;
          }
          if (typeof globalThis !== 'undefined') {
            globalThis.__name = noopName;
          }
          if (typeof self !== 'undefined') {
            self.__name = noopName;
          }
        } catch (e) {}
      })();
    `,
  });

  return context;
}


