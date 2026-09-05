/**
 * Safe API fetch helper with robust JSON parsing and friendly error formatting.
 * Prevents "Unexpected token '<', '<!doctype ...' is not valid JSON" errors
 * when endpoints return HTML error pages or during server restarts.
 */
export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';

  let bodyData: any = null;
  if (contentType.includes('application/json')) {
    try {
      bodyData = await res.json();
    } catch {
      // Failed to parse JSON even with header
      bodyData = null;
    }
  } else {
    // Non-JSON response (e.g. HTML fallback from Vite/Express or 502/504 Bad Gateway)
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Requested resource or crawl session not found. Please run a crawl first.');
      }
      if (res.status === 502 || res.status === 504) {
        throw new Error('Server gateway timeout. The operation is taking longer than expected.');
      }
      throw new Error(`Server returned HTTP ${res.status} error (${text.slice(0, 80) || 'Non-JSON response'}).`);
    }
    throw new Error('Received unexpected non-JSON response from server.');
  }

  if (!res.ok) {
    const errorMsg =
      bodyData?.error ||
      bodyData?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return bodyData as T;
}
