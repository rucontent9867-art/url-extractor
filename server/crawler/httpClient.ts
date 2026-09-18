import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';

// Reusable connection agents
export const globalHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 250,
  maxFreeSockets: 120,
  timeout: 30000,
  keepAliveMsecs: 1000,
});

export const globalHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 250,
  maxFreeSockets: 120,
  timeout: 30000,
  keepAliveMsecs: 1000,
});

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  isHtml: boolean;
  body: string;
  responseTimeMs: number;
  attempts: number;
  error?: string;
  headers: Record<string, string>;
}

export interface FetchOptions {
  userAgent?: string;
  timeoutSeconds?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  abortSignal?: AbortSignal;
  maxRetries?: number;
  maxContentLengthBytes?: number;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; DomainCrawlerBot/1.0; +https://ai.studio)';

/**
 * High-performance HTTP client with connection reuse, intelligent retry,
 * and Content-Type inspection.
 */
export async function fastFetchHtml(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const timeoutMs = (options.timeoutSeconds ?? 15) * 1000;
  const maxRetries = options.maxRetries ?? 2;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  const followRedirects = options.followRedirects ?? true;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxContentLength = options.maxContentLengthBytes ?? 15 * 1024 * 1024; // 15MB cap

  let attempts = 0;
  let lastError: any = null;

  while (attempts <= maxRetries) {
    attempts++;
    const startTime = Date.now();

    try {
      const config: AxiosRequestConfig = {
        httpAgent: globalHttpAgent,
        httpsAgent: globalHttpsAgent,
        timeout: timeoutMs,
        signal: options.abortSignal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
        maxRedirects: followRedirects ? maxRedirects : 0,
        validateStatus: () => true, // Don't throw on 4xx/5xx so we can examine status code
        responseType: 'text',
        maxContentLength,
      };

      const response: AxiosResponse = await axios.get(url, config);
      const duration = Date.now() - startTime;
      const status = response.status;
      const finalUrl = (response.request?.res?.responseUrl as string) || url;

      // Extract Content-Type
      const rawContentType = response.headers['content-type'] || '';
      const contentType = typeof rawContentType === 'string' ? rawContentType.toLowerCase() : '';
      const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');

      // Check if temporary server error warrants a backoff retry
      if (
        (status === 429 || status === 502 || status === 503 || status === 504) &&
        attempts <= maxRetries &&
        !options.abortSignal?.aborted
      ) {
        const backoffMs = Math.min(1500, Math.pow(2, attempts) * 200 + Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      const headersRecord: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (typeof v === 'string') {
          headersRecord[k.toLowerCase()] = v;
        }
      }

      return {
        url,
        finalUrl,
        status,
        ok: status >= 200 && status < 300,
        contentType,
        isHtml,
        body: typeof response.data === 'string' ? response.data : '',
        responseTimeMs: duration,
        attempts,
        headers: headersRecord,
      };
    } catch (err: any) {
      lastError = err;
      const duration = Date.now() - startTime;

      if (options.abortSignal?.aborted) {
        return {
          url,
          finalUrl: url,
          status: 0,
          ok: false,
          contentType: '',
          isHtml: false,
          body: '',
          responseTimeMs: duration,
          attempts,
          error: 'Crawl aborted by user',
          headers: {},
        };
      }

      // Check if error is transient and can be retried
      const code = err.code || '';
      const isTransient =
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EAI_AGAIN' ||
        code === 'ECONNABORTED';

      if (isTransient && attempts <= maxRetries) {
        const backoffMs = Math.min(600, Math.pow(2, attempts) * 100);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      const status = err.response?.status || 0;
      return {
        url,
        finalUrl: url,
        status,
        ok: false,
        contentType: '',
        isHtml: false,
        body: '',
        responseTimeMs: duration,
        attempts,
        error: err.message || 'Request failed',
        headers: {},
      };
    }
  }

  return {
    url,
    finalUrl: url,
    status: 0,
    ok: false,
    contentType: '',
    isHtml: false,
    body: '',
    responseTimeMs: 0,
    attempts,
    error: lastError?.message || 'Max retries exceeded',
    headers: {},
  };
}

/**
 * Ultra-fast HEAD verification helper for assets and links.
 * Avoids downloading large response bodies while testing status, headers, and redirects in ms.
 */
export async function fastHeadOrGetCheck(
  url: string,
  options: {
    timeoutMs?: number;
    userAgent?: string;
    abortSignal?: AbortSignal;
  } = {}
): Promise<{
  statusCode: number;
  contentType: string;
  finalUrl: string;
  responseTimeMs: number;
  headers: Record<string, string>;
  error?: string;
}> {
  const timeout = options.timeoutMs ?? 8000;
  const userAgent =
    options.userAgent ||
    'Mozilla/5.0 (compatible; DomainCrawlerBot/2.0; +https://ai.studio; FastAssetBot)';
  const startTime = Date.now();

  // 1. Try HEAD request first for instantaneous status + redirect inspection
  try {
    const res = await axios.head(url, {
      httpAgent: globalHttpAgent,
      httpsAgent: globalHttpsAgent,
      timeout,
      signal: options.abortSignal,
      headers: {
        'User-Agent': userAgent,
        Accept: '*/*',
        Connection: 'keep-alive',
      },
      maxRedirects: 0,
      validateStatus: () => true,
    });

    const headersRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      if (typeof v === 'string') headersRecord[k.toLowerCase()] = v;
    }

    const duration = Date.now() - startTime;
    const contentType = (res.headers['content-type'] as string) || '';

    // If server accepts HEAD (2xx, 3xx, 404, etc.)
    if (res.status !== 405 && res.status !== 501) {
      return {
        statusCode: res.status,
        contentType,
        finalUrl: (res.request?.res?.responseUrl as string) || url,
        responseTimeMs: duration,
        headers: headersRecord,
      };
    }
  } catch (err: any) {
    if (err.response?.status && err.response.status !== 405 && err.response.status !== 501) {
      return {
        statusCode: err.response.status,
        contentType: (err.response.headers?.['content-type'] as string) || '',
        finalUrl: url,
        responseTimeMs: Date.now() - startTime,
        headers: {},
        error: err.message,
      };
    }
  }

  // 2. Fallback to GET with small byte Range or small maxContentLength if HEAD is not supported by server
  try {
    const res = await axios.get(url, {
      httpAgent: globalHttpAgent,
      httpsAgent: globalHttpsAgent,
      timeout,
      signal: options.abortSignal,
      headers: {
        'User-Agent': userAgent,
        Accept: '*/*',
        Range: 'bytes=0-2048',
        Connection: 'keep-alive',
      },
      maxRedirects: 0,
      validateStatus: () => true,
      responseType: 'arraybuffer',
      maxContentLength: 100 * 1024, // 100KB cap
    });

    const headersRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      if (typeof v === 'string') headersRecord[k.toLowerCase()] = v;
    }

    return {
      statusCode: res.status,
      contentType: (res.headers['content-type'] as string) || '',
      finalUrl: (res.request?.res?.responseUrl as string) || url,
      responseTimeMs: Date.now() - startTime,
      headers: headersRecord,
    };
  } catch (err: any) {
    return {
      statusCode: err.response?.status || 0,
      contentType: '',
      finalUrl: url,
      responseTimeMs: Date.now() - startTime,
      headers: {},
      error: err.message || 'Request failed',
    };
  }
}
