import { Router } from 'express';
import { crawlerManager } from '../crawler/crawler';
import { normalizeInputUrl } from '../crawler/urlNormalizer';
import { crawlStore } from '../services/crawlStore';
import { settingsStore } from '../services/settingsStore';
import { domainSettingsStore } from '../services/domainSettingsStore';

export const crawlRouter = Router();

// Domain-Specific & Tool-Specific Settings endpoints
crawlRouter.get('/settings/domain', (req, res) => {
  const domain = String(req.query.domain || 'default');
  const settings = domainSettingsStore.getDomainSettings(domain);
  return res.json({ domain: settings.domain, settings });
});

crawlRouter.post('/settings/domain', (req, res) => {
  const { domain, settings } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Domain is required' });
  }
  const updated = domainSettingsStore.saveDomainSettings(domain, settings || {});
  return res.json({ success: true, domain: updated.domain, settings: updated });
});

crawlRouter.post('/settings/domain/exclusion', (req, res) => {
  const { domain, tool, type, value } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Domain is required' });
  }
  if (!type || !['slug', 'exact', 'pattern'].includes(type)) {
    return res.status(400).json({ error: 'Valid type is required (slug, exact, or pattern)' });
  }
  if (!value || typeof value !== 'string' || !value.trim()) {
    return res.status(400).json({ error: 'Exclusion value is required' });
  }

  const target = tool && tool !== 'global' ? tool : 'global';
  const updated = domainSettingsStore.addExclusion(domain, target, type, value);
  return res.json({ success: true, domain: updated.domain, settings: updated });
});

crawlRouter.delete('/settings/domain/exclusion', (req, res) => {
  const { domain, tool, type, value } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Domain is required' });
  }
  if (!type || !['slug', 'exact', 'pattern'].includes(type)) {
    return res.status(400).json({ error: 'Valid type is required (slug, exact, or pattern)' });
  }
  if (!value || typeof value !== 'string') {
    return res.status(400).json({ error: 'Exclusion value is required' });
  }

  const target = tool && tool !== 'global' ? tool : 'global';
  const updated = domainSettingsStore.removeExclusion(domain, target, type, value);
  return res.json({ success: true, domain: updated.domain, settings: updated });
});

// Legacy Settings endpoints for Ignored Slugs
crawlRouter.get('/settings/ignored-slugs', (req, res) => {
  const ignoredSlugs = settingsStore.getIgnoredSlugs();
  return res.json({ ignoredSlugs });
});

crawlRouter.post('/settings/ignored-slugs', (req, res) => {
  const { slug, slugs } = req.body;
  if (Array.isArray(slugs)) {
    const updated = settingsStore.setIgnoredSlugs(slugs);
    return res.json({ success: true, ignoredSlugs: updated });
  }

  if (typeof slug === 'string' && slug.trim()) {
    const updated = settingsStore.addIgnoredSlug(slug);
    return res.json({ success: true, ignoredSlugs: updated });
  }

  return res.status(400).json({ error: 'Slug or slugs array is required' });
});

crawlRouter.delete('/settings/ignored-slugs/:slug', (req, res) => {
  const { slug } = req.params;
  const updated = settingsStore.removeIgnoredSlug(slug);
  return res.json({ success: true, ignoredSlugs: updated });
});

// Settings endpoints for Dynamic Content Selectors
crawlRouter.get('/settings/dynamic-selectors', (req, res) => {
  const dynamicSelectors = settingsStore.getDynamicSelectors();
  return res.json({ dynamicSelectors });
});

crawlRouter.post('/settings/dynamic-selectors', (req, res) => {
  const { selector, selectors } = req.body;
  if (Array.isArray(selectors)) {
    const updated = settingsStore.setDynamicSelectors(selectors);
    return res.json({ success: true, dynamicSelectors: updated });
  }

  if (typeof selector === 'string' && selector.trim()) {
    const updated = settingsStore.addDynamicSelector(selector);
    return res.json({ success: true, dynamicSelectors: updated });
  }

  return res.status(400).json({ error: 'Selector or selectors array is required' });
});

crawlRouter.delete('/settings/dynamic-selectors/:selector', (req, res) => {
  const { selector } = req.params;
  const decoded = decodeURIComponent(selector);
  const updated = settingsStore.removeDynamicSelector(decoded);
  return res.json({ success: true, dynamicSelectors: updated });
});

// Validate domain endpoint
crawlRouter.post('/validate-domain', (req, res) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Domain or URL is required' });
  }

  const normalized = normalizeInputUrl(domain);
  if (!normalized) {
    return res.status(400).json({
      error: 'Invalid domain or URL. Example: https://example.com or kenya-eta.info',
    });
  }

  return res.json({
    valid: true,
    normalizedUrl: normalized.normalizedUrl,
    hostname: normalized.hostname,
    origin: normalized.origin,
  });
});

// Start crawling endpoint
crawlRouter.post('/crawl/start', (req, res) => {
  try {
    const { domain, settings } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Domain or URL is required' });
    }

    const normalized = normalizeInputUrl(domain);
    if (!normalized) {
      return res.status(400).json({
        error: 'Invalid domain or URL. Please enter a valid website address.',
      });
    }

    const session = crawlerManager.createSession(domain, settings);

    // Start crawl asynchronously
    session.start().catch((err) => {
      console.error(`Error in crawl session ${session.crawlId}:`, err);
    });

    return res.json({
      success: true,
      crawlId: session.crawlId,
      normalizedDomain: session.baseNormalizedUrl,
      hostname: session.hostname,
      stats: session.stats,
    });
  } catch (err: any) {
    console.error('Failed to start crawl:', err);
    return res.status(500).json({ error: err.message || 'Failed to initialize crawl session' });
  }
});

// SSE stream for real-time crawler updates
crawlRouter.get('/crawl/stream/:crawlId', (req, res) => {
  const { crawlId } = req.params;
  const session = crawlerManager.getSession(crawlId);

  if (!session) {
    return res.status(404).json({ error: 'Crawl session not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const keepAliveTimer = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  const unsubscribe = session.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
  });
});

// Stop crawl
crawlRouter.post('/crawl/stop/:crawlId', (req, res) => {
  const { crawlId } = req.params;
  const session = crawlerManager.getSession(crawlId);

  if (!session) {
    return res.status(404).json({ error: 'Crawl session not found' });
  }

  session.stop();
  return res.json({ success: true, message: 'Crawl stopped', stats: session.stats });
});

// Fetch current status
crawlRouter.get('/crawl/status/:crawlId', (req, res) => {
  const { crawlId } = req.params;
  const session = crawlerManager.getSession(crawlId);

  if (!session) {
    // Check crawlStore as fallback
    const stored = crawlStore.getSession(crawlId);
    if (stored) {
      return res.json({
        crawlId: stored.crawlId,
        stats: stored.stats,
        settings: stored.settings,
        itemCount: stored.items.size,
      });
    }
    return res.status(404).json({ error: 'Crawl session not found' });
  }

  return res.json({
    crawlId: session.crawlId,
    stats: session.stats,
    settings: session.settings,
    itemCount: session.discoveredUrls.size,
  });
});

// Fetch full crawl results
crawlRouter.get('/crawl/results/:crawlId', (req, res) => {
  const { crawlId } = req.params;
  const session = crawlerManager.getSession(crawlId);

  if (session) {
    return res.json({
      crawlId: session.crawlId,
      stats: session.stats,
      items: Array.from(session.discoveredUrls.values()),
    });
  }

  const stored = crawlStore.getSession(crawlId);
  if (stored) {
    return res.json({
      crawlId: stored.crawlId,
      stats: stored.stats,
      items: Array.from(stored.items.values()),
    });
  }

  return res.status(404).json({ error: 'Crawl session not found' });
});
