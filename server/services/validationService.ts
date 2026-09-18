import {
  ContentLanguageResult,
  LanguageCompletenessResult,
  SitemapValidationResult,
  HeaderValidationResult,
  AmpValidationResult,
  AssetValidationResult,
  VisualValidationResult,
  InteractionValidationResult,
  AssetValidationOptions,
  VisualValidationOptions,
  InteractionValidationOptions,
  ValidationSummary,
} from '../../src/types';
import { crawlStore, StoredCrawlSession } from './crawlStore';
import { validateSitemap } from '../validators/sitemapValidator';
import { validateLanguageCompleteness } from '../validators/languageCompletenessValidator';
import { validateContentLanguage } from '../validators/contentLanguageValidator';
import { headerValidator, HeaderValidationOptions } from '../validators/headerValidator';
import { validateAmp, AmpValidationOptions } from '../validators/ampValidator';
import { assetValidator } from '../validators/assetValidator';
import { visualValidator } from '../validators/visualValidator';
import { interactionValidator } from '../validators/interactionValidator';
import { getEffectiveIgnoredSlugs } from './settingsStore';
import { hasIgnoredSlug } from '../crawler/urlNormalizer';

export class ValidationService {
  public validateSitemapOnly(crawlId: string): SitemapValidationResult {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const sitemapResult = validateSitemap(session);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.sitemap = sitemapResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return sitemapResult;
  }

  public validateCompletenessOnly(crawlId: string): LanguageCompletenessResult {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const completenessResult = validateLanguageCompleteness(session);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.completeness = completenessResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return completenessResult;
  }

  public validateContentLanguageOnly(
    crawlId: string,
    confidenceThreshold?: number
  ): ContentLanguageResult {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const contentLangResult = validateContentLanguage(session, confidenceThreshold);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.contentLanguage = contentLangResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return contentLangResult;
  }

  public async validateHeaderNavigationOnly(
    crawlId: string,
    options: HeaderValidationOptions = {}
  ): Promise<HeaderValidationResult> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const headerResult = await headerValidator.validate(session, options);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.headerNavigation = headerResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return headerResult;
  }

  public async validateAmpOnly(
    crawlId: string,
    options: AmpValidationOptions = {}
  ): Promise<AmpValidationResult> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const ampResult = await validateAmp(session, options);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.ampValidation = ampResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return ampResult;
  }

  public async validateAssetOnly(
    crawlId: string,
    options: AssetValidationOptions = {}
  ): Promise<AssetValidationResult> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const assetResult = await assetValidator.validate(session, options);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.assetValidation = assetResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return assetResult;
  }

  public async validateVisualOnly(
    crawlId: string,
    options: VisualValidationOptions = {}
  ): Promise<VisualValidationResult> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const visualResult = await visualValidator.validate(session, options);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.visualValidation = visualResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return visualResult;
  }

  public async validateInteractionOnly(
    crawlId: string,
    options: InteractionValidationOptions = {}
  ): Promise<InteractionValidationResult> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    const interactionResult = await interactionValidator.validate(session, options);

    const existing = crawlStore.getValidation(crawlId) || {
      crawlId,
      timestamp: Date.now(),
      overallStatus: 'not_run',
    };
    existing.interactionValidation = interactionResult;
    existing.overallStatus = this.calculateOverallStatus(existing);
    crawlStore.setValidation(crawlId, existing);

    this.annotateSessionItems(session, existing);

    return interactionResult;
  }

  public async runAllValidations(
    crawlId: string,
    confidenceThreshold?: number,
    headerOptions?: HeaderValidationOptions,
    ampOptions?: AmpValidationOptions,
    assetOptions?: AssetValidationOptions,
    visualOptions?: VisualValidationOptions,
    interactionOptions?: InteractionValidationOptions
  ): Promise<ValidationSummary> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    // Run static in-memory validation checks
    const sitemap = validateSitemap(session);
    const completeness = validateLanguageCompleteness(session);
    const contentLanguage = validateContentLanguage(session, confidenceThreshold);

    // 1. Run static and network-only validators concurrently
    const [assetRes, ampRes] = await Promise.allSettled([
      assetValidator.validate(session, assetOptions || {}),
      validateAmp(session, ampOptions || { passThreshold: 95, warnThreshold: 85 }),
    ]);

    // 2. Run browser-rendered / DOM validators in sequence to prevent container process contention
    const headerRes = await Promise.allSettled([
      headerValidator.validate(session, headerOptions || { maxPages: 10 }),
    ]).then(([r]) => r);

    const visualRes = await Promise.allSettled([
      visualValidator.validate(session, visualOptions || { maxPages: 8 }),
    ]).then(([r]) => r);

    const interactionRes = await Promise.allSettled([
      interactionValidator.validate(session, interactionOptions || { maxPages: 8 }),
    ]).then(([r]) => r);

    const assetValidation = assetRes.status === 'fulfilled' ? assetRes.value : undefined;
    if (assetRes.status === 'rejected') {
      console.warn('Asset validation during runAllValidations failed:', assetRes.reason);
    }

    const headerNavigation = headerRes.status === 'fulfilled' ? headerRes.value : undefined;
    if (headerRes.status === 'rejected') {
      console.warn('Header validation during runAllValidations failed:', headerRes.reason);
    }

    const ampValidation = ampRes.status === 'fulfilled' ? ampRes.value : undefined;
    if (ampRes.status === 'rejected') {
      console.warn('AMP validation during runAllValidations failed:', ampRes.reason);
    }

    const visualValidation = visualRes.status === 'fulfilled' ? visualRes.value : undefined;
    if (visualRes.status === 'rejected') {
      console.warn('Visual validation during runAllValidations failed:', visualRes.reason);
    }

    const interactionValidation = interactionRes.status === 'fulfilled' ? interactionRes.value : undefined;
    if (interactionRes.status === 'rejected') {
      console.warn('Interaction validation during runAllValidations failed:', interactionRes.reason);
    }

    const summary: ValidationSummary = {
      crawlId,
      timestamp: Date.now(),
      sitemap,
      completeness,
      contentLanguage,
      headerNavigation,
      ampValidation,
      assetValidation,
      visualValidation,
      interactionValidation,
      overallStatus: 'not_run',
    };

    summary.overallStatus = this.calculateOverallStatus(summary);
    crawlStore.setValidation(crawlId, summary);

    this.annotateSessionItems(session, summary);

    return summary;
  }

  private annotateSessionItems(
    session: StoredCrawlSession,
    summary: Partial<ValidationSummary>
  ): void {
    const sitemapMissingSet = new Set(summary.sitemap?.missingUrls || []);
    const langMismatchSet = new Set(summary.contentLanguage?.mismatchUrls || []);
    const langWarningSet = new Set(
      summary.contentLanguage?.items
        .filter((i) => i.status === 'low_confidence' || i.status === 'mixed_language')
        .map((i) => i.url) || []
    );

    const effectiveSlugs = getEffectiveIgnoredSlugs(session);

    for (const item of session.items.values()) {
      const isIgnoredForVal = Boolean(
        item.ignoredForValidation ||
        item.isIgnoredSlug ||
        hasIgnoredSlug(item.normalizedUrl, effectiveSlugs)
      );
      item.ignoredForValidation = isIgnoredForVal;
      item.isIgnoredSlug = isIgnoredForVal;

      const errs: string[] = [];

      if (item.status === 404) {
        errs.push('404 Not Found');
      } else if (item.status >= 500) {
        errs.push(`5xx Server Error (${item.status})`);
      } else if (item.status >= 400) {
        errs.push(`4xx Client Error (${item.status})`);
      } else if (item.crawlStatus && item.crawlStatus !== 'success') {
        errs.push(`Crawl Error (${item.crawlStatus})`);
      }

      // Validation errors are strictly excluded for validation-ignored slugs!
      if (!isIgnoredForVal) {
        if (sitemapMissingSet.has(item.normalizedUrl)) {
          errs.push('Missing from Sitemap');
        }

        if (langMismatchSet.has(item.normalizedUrl)) {
          errs.push('Language Mismatch');
        } else if (langWarningSet.has(item.normalizedUrl)) {
          errs.push('Language Warning');
        }
      }

      item.validationErrors = errs;
    }
  }

  private calculateOverallStatus(
    val: Partial<ValidationSummary>
  ): 'passed' | 'warning' | 'error' {
    let hasError = false;
    let hasWarning = false;

    if (val.sitemap) {
      if (val.sitemap.missingFromSitemap > 0) {
        hasError = true;
      }
      if (val.sitemap.sitemapOnlyCount > 0) {
        hasWarning = true;
      }
    }

    if (val.completeness) {
      if (val.completeness.totalMissing > 0) {
        hasError = true;
      }
      if (val.completeness.totalAdditional > 0) {
        hasWarning = true;
      }
    }

    if (val.contentLanguage) {
      if (val.contentLanguage.mismatchCount > 0) {
        hasError = true;
      }
      if (
        val.contentLanguage.lowConfidenceCount > 0 ||
        (val.contentLanguage.mixedLanguageCount && val.contentLanguage.mixedLanguageCount > 0)
      ) {
        hasWarning = true;
      }
    }

    if (val.headerNavigation) {
      if (
        val.headerNavigation.headerMismatchCount > 0 ||
        val.headerNavigation.totalLanguageErrors > 0
      ) {
        hasError = true;
      }
      if (
        val.headerNavigation.headerNeedsReviewCount > 0 ||
        val.headerNavigation.totalNeedsReview > 0
      ) {
        hasWarning = true;
      }
    }

    if (val.ampValidation) {
      if (val.ampValidation.errorCount > 0) {
        hasError = true;
      }
      if (val.ampValidation.warningCount > 0) {
        hasWarning = true;
      }
    }

    if (val.assetValidation) {
      if (val.assetValidation.errorCount > 0) {
        hasError = true;
      }
      if (val.assetValidation.warningCount > 0) {
        hasWarning = true;
      }
    }

    if (val.visualValidation) {
      if (val.visualValidation.totalErrors > 0) {
        hasError = true;
      }
      if (val.visualValidation.totalWarnings > 0) {
        hasWarning = true;
      }
    }

    if (val.interactionValidation) {
      if (val.interactionValidation.errorCount > 0) {
        hasError = true;
      }
      if (val.interactionValidation.warningCount > 0) {
        hasWarning = true;
      }
    }

    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'passed';
  }
}

export const validationService = new ValidationService();


