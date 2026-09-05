import {
  ContentLanguageResult,
  LanguageCompletenessResult,
  SitemapValidationResult,
  HeaderValidationResult,
  AmpValidationResult,
  ValidationSummary,
} from '../../src/types';
import { crawlStore, StoredCrawlSession } from './crawlStore';
import { validateSitemap } from '../validators/sitemapValidator';
import { validateLanguageCompleteness } from '../validators/languageCompletenessValidator';
import { validateContentLanguage } from '../validators/contentLanguageValidator';
import { headerValidator, HeaderValidationOptions } from '../validators/headerValidator';
import { validateAmp, AmpValidationOptions } from '../validators/ampValidator';
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

  public async runAllValidations(
    crawlId: string,
    confidenceThreshold?: number,
    headerOptions?: HeaderValidationOptions,
    ampOptions?: AmpValidationOptions
  ): Promise<ValidationSummary> {
    const session = crawlStore.getSession(crawlId);
    if (!session) {
      throw new Error(`Crawl session ${crawlId} not found in store`);
    }

    // Run all validation checks using the stored crawl dataset
    const sitemap = validateSitemap(session);
    const completeness = validateLanguageCompleteness(session);
    const contentLanguage = validateContentLanguage(session, confidenceThreshold);

    // Run Header & Language Navigation validator with Playwright
    let headerNavigation: HeaderValidationResult | undefined;
    try {
      headerNavigation = await headerValidator.validate(session, headerOptions || { maxPages: 10 });
    } catch (err) {
      console.warn('Header validation during runAllValidations failed:', err);
    }

    // Run AMP Validation
    let ampValidation: AmpValidationResult | undefined;
    try {
      ampValidation = await validateAmp(session, ampOptions || { passThreshold: 95, warnThreshold: 85 });
    } catch (err) {
      console.warn('AMP validation during runAllValidations failed:', err);
    }

    const summary: ValidationSummary = {
      crawlId,
      timestamp: Date.now(),
      sitemap,
      completeness,
      contentLanguage,
      headerNavigation,
      ampValidation,
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

    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'passed';
  }
}

export const validationService = new ValidationService();

