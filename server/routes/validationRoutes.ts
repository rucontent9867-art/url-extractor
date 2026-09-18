import { Router } from 'express';
import { validationService } from '../services/validationService';
import { crawlStore } from '../services/crawlStore';

export const validationRouter = Router();

// Validate Sitemap Coverage
validationRouter.post('/validation/sitemap/:crawlId', (req, res) => {
  try {
    const { crawlId } = req.params;
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const result = validationService.validateSitemapOnly(crawlId);
    return res.json({ success: true, crawlId, sitemap: result });
  } catch (err: any) {
    console.error('Sitemap validation error:', err);
    return res.status(500).json({ error: err.message || 'Sitemap validation failed' });
  }
});

// Validate Language Completeness
validationRouter.post('/validation/completeness/:crawlId', (req, res) => {
  try {
    const { crawlId } = req.params;
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const result = validationService.validateCompletenessOnly(crawlId);
    return res.json({ success: true, crawlId, completeness: result });
  } catch (err: any) {
    console.error('Language completeness validation error:', err);
    return res.status(500).json({ error: err.message || 'Language completeness validation failed' });
  }
});

// Validate Page Content Language
validationRouter.post('/validation/content-language/:crawlId', (req, res) => {
  try {
    const { crawlId } = req.params;
    const { threshold } = req.body;

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const confidenceThreshold = typeof threshold === 'number' ? threshold : undefined;
    const result = validationService.validateContentLanguageOnly(crawlId, confidenceThreshold);
    return res.json({ success: true, crawlId, contentLanguage: result });
  } catch (err: any) {
    console.error('Content language validation error:', err);
    return res.status(500).json({ error: err.message || 'Content language validation failed' });
  }
});

// Validate Header & Language Navigation (using Playwright)
validationRouter.post('/validation/header/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const { maxPages, specificUrls, timeoutMs } = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const options = {
      maxPages: maxPages !== undefined ? maxPages : 25,
      specificUrls: Array.isArray(specificUrls) ? specificUrls : undefined,
      timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : undefined,
    };

    const result = await validationService.validateHeaderNavigationOnly(crawlId, options);
    return res.json({ success: true, crawlId, headerNavigation: result });
  } catch (err: any) {
    console.error('Header navigation validation error:', err);
    return res.status(500).json({ error: err.message || 'Header navigation validation failed' });
  }
});

// Validate AMP (Accelerated Mobile Pages)
validationRouter.post('/validation/amp/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const { checkGuesses, passThreshold, warnThreshold, maxPages, timeoutSec } = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const options = {
      checkGuesses: Boolean(checkGuesses),
      passThreshold: typeof passThreshold === 'number' ? passThreshold : 95,
      warnThreshold: typeof warnThreshold === 'number' ? warnThreshold : 85,
      maxPages: typeof maxPages === 'number' ? maxPages : undefined,
      timeoutSec: typeof timeoutSec === 'number' ? timeoutSec : 8,
    };

    const result = await validationService.validateAmpOnly(crawlId, options);
    return res.json({ success: true, crawlId, ampValidation: result });
  } catch (err: any) {
    console.error('AMP validation error:', err);
    return res.status(500).json({ error: err.message || 'AMP validation failed' });
  }
});

// Validate Assets, HTTP & Link Health (Tool 6)
validationRouter.post('/validation/asset/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const options = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const result = await validationService.validateAssetOnly(crawlId, options);
    return res.json({ success: true, crawlId, assetValidation: result });
  } catch (err: any) {
    console.error('Asset validation error:', err);
    return res.status(500).json({ error: err.message || 'Asset validation failed' });
  }
});

// Validate Visual, Responsive & Viewport (Tool 7)
validationRouter.post('/validation/visual/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const options = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const result = await validationService.validateVisualOnly(crawlId, options);
    return res.json({ success: true, crawlId, visualValidation: result });
  } catch (err: any) {
    console.error('Visual validation error:', err);
    return res.status(500).json({ error: err.message || 'Visual validation failed' });
  }
});

// Validate Interaction & Console Monitoring (Tool 8)
validationRouter.post('/validation/interaction/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const options = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const result = await validationService.validateInteractionOnly(crawlId, options);
    return res.json({ success: true, crawlId, interactionValidation: result });
  } catch (err: any) {
    console.error('Interaction validation error:', err);
    return res.status(500).json({ error: err.message || 'Interaction validation failed' });
  }
});

// Run All Validations
validationRouter.post('/validation/all/:crawlId', async (req, res) => {
  try {
    const { crawlId } = req.params;
    const { threshold, maxPages, ampOptions, assetOptions, visualOptions, interactionOptions } = req.body || {};

    const session = crawlStore.getSession(crawlId);
    if (!session) {
      return res.status(404).json({ error: 'Crawl session not found. Please run a crawl first.' });
    }

    const confidenceThreshold = typeof threshold === 'number' ? threshold : undefined;
    const headerOptions = {
      maxPages: maxPages !== undefined ? maxPages : 10,
    };

    const summary = await validationService.runAllValidations(
      crawlId,
      confidenceThreshold,
      headerOptions,
      ampOptions,
      assetOptions,
      visualOptions,
      interactionOptions
    );
    return res.json({ success: true, crawlId, summary });
  } catch (err: any) {
    console.error('All validations error:', err);
    return res.status(500).json({ error: err.message || 'Failed to run all validations' });
  }
});

// Get Cached Validation Results
validationRouter.get('/validation/:crawlId', (req, res) => {
  const { crawlId } = req.params;
  const validation = crawlStore.getValidation(crawlId);

  if (!validation) {
    return res.status(404).json({ error: 'No validation results found for this crawl session' });
  }

  return res.json({ success: true, crawlId, validation });
});
