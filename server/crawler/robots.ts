import axios from 'axios';

export interface RobotsData {
  sitemaps: string[];
  disallowedPaths: string[];
}

export async function fetchAndParseRobotsTxt(
  originUrl: string,
  userAgent: string,
  timeoutSeconds: number,
  abortSignal?: AbortSignal
): Promise<RobotsData> {
  const result: RobotsData = {
    sitemaps: [],
    disallowedPaths: [],
  };

  try {
    const robotsUrl = new URL('/robots.txt', originUrl).toString();
    const response = await axios.get(robotsUrl, {
      timeout: timeoutSeconds * 1000,
      signal: abortSignal,
      headers: { 'User-Agent': userAgent },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (response.status === 200 && typeof response.data === 'string') {
      const lines = response.data.split('\n');
      let isTargetAgent = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (/^User-agent:\s*\*/i.test(trimmed)) {
          isTargetAgent = true;
        } else if (/^User-agent:/i.test(trimmed)) {
          isTargetAgent = false;
        }

        if (isTargetAgent && /^Disallow:\s*(.+)/i.test(trimmed)) {
          const match = trimmed.match(/^Disallow:\s*(.+)/i);
          if (match && match[1]) {
            const p = match[1].trim();
            if (p && p !== '/') {
              result.disallowedPaths.push(p);
            }
          }
        }

        if (/^Sitemap:\s*(.+)/i.test(trimmed)) {
          const match = trimmed.match(/^Sitemap:\s*(.+)/i);
          if (match && match[1]) {
            result.sitemaps.push(match[1].trim());
          }
        }
      }
    }
  } catch {
    // robots.txt is optional, ignore errors
  }

  return result;
}
