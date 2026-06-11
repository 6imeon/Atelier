import { Project, ProjectData } from "./models/project.js";
import { ModelRouter, getRouter } from "./utils/router.js";

export { Screen, ScreenData, DeviceType, VariantOptions, ComponentNode } from "./models/screen.js";
export { Project, ProjectData, extractConsistencyConstraints } from "./models/project.js";
export type { ConsistencyConstraints, UserData, ListProjectsOptions } from "./models/project.js";
export { DesignSystem, toDesignMd, parseDesignMd } from "./models/design-system.js";
export { ModelRouter, RouterError, MODEL_CONFIG, getRouter } from "./utils/router.js";
export type { PipelineStage, ChatMessage } from "./utils/router.js";
export { PROMPTS } from "./utils/prompts.js";
export { fetchPage } from "./models/redesign.js";
export { extractBrandData, extractBrandDataFull } from "./utils/brand-extractor.js";
export type { BrandData, ExtractedColors, ExtractedFonts, ExtractedFont, ExtractedLogo, ColorInfo, ColorCategory } from "./utils/brand-extractor.js";
export { autoMatchPersona, loadPersonas, getPersonaById, buildPersonaPrompt } from "./utils/personas.js";
export type { Persona } from "./utils/personas.js";
export { computeTypographicScale, formatScaleForPrompt } from "./utils/typographic-scale.js";
export type { TypeScale } from "./utils/typographic-scale.js";
export { calcAPCA, meetsContrast, adjustForContrast, validateDesignTokenContrast, hexToOklch, oklchToHex } from "./utils/contrast.js";
export type { ContrastPair, ContrastReport } from "./utils/contrast.js";
export { generateScale, generatePalette, formatPaletteForPrompt } from "./utils/color-scale.js";
export type { ColorStep, ColorScale } from "./utils/color-scale.js";
export { validatePairing, suggestBody } from "./utils/font-pairing.js";
export type { PairingResult } from "./utils/font-pairing.js";
export { critiqueHtml } from "./utils/design-critique.js";
export type { CritiqueIssue, CritiqueReport } from "./utils/design-critique.js";
export { serialize as serializeDesignMd, parse as parseDesignMdSpec, lint as lintDesignMd, exportTailwind, fromExtractedDesign, fromCanvasDesignSystem, toCanvasDesignSystem, contrastRatio, isLintEnabled, promptDsFormat, formatDialsForPrompt, normaliseDials, DEFAULT_DIALS } from "./utils/design-md.js";
export type { DesignTokens, LintRule, LintSeverity, LintFinding, LintReport, ExtractedDesignInput, CanvasDesignSystemInput, DialValues } from "./utils/design-md.js";
export { stagedRefineHtml, parseRefinePasses, getRefinePasses, REFINE_PASS_ORDER } from "./utils/staged-refine.js";
export type { RefinePass, StagedRefineOptions, StagedRefineResult, PassResult } from "./utils/staged-refine.js";
export { computeDesignTokens, formatDesignTokensForPrompt } from "./utils/aaker-tokens.js";
export type { AakerDesignTokens } from "./utils/aaker-tokens.js";
export { PipelineRun, NOOP_RUN, createPipelineRun } from "./utils/logger.js";
export { computeCompositeScore, quickCompositeScore, updateElo, updateEloDraw, selectPairForComparison, eloLeaderboard, DEFAULT_ELO, thompsonSelect, wilsonLowerBound, decayStaleElo } from "./utils/rating.js";
export type { CompositeScore } from "./utils/rating.js";
export { ComponentLibrary } from "./models/component.js";
export { parseSections, assembleSections, saveSectionTemplates } from "./utils/section-parser.js";
export type { ParsedSection } from "./utils/section-parser.js";
export { parseSectionsSPA, parseSectionsWithFallback, SPAEmptyShellError } from "./utils/spa-section-parser.js";
export { detectSPA } from "./utils/spa-detector.js";
export type { SPADetection } from "./utils/spa-detector.js";
export { improveSectionLabels } from "./utils/label-improver.js";
export { syncPinRevealAnimations } from "./utils/pin-reveal-sync.js";
export type { PinRevealSyncResult } from "./utils/pin-reveal-sync.js";
export { stripPinnedContentFades } from "./utils/content-fade-guard.js";
export type { ContentFadeGuardResult } from "./utils/content-fade-guard.js";
export { stripConflictingTransitions } from "./utils/transition-guard.js";
export type { TransitionGuardResult } from "./utils/transition-guard.js";
export { validateAndFixFit } from "./utils/fit-validator.js";
export type { FitIssue, FitIssueType, FitReport } from "./utils/fit-validator.js";
export { extractBusinessSignals, classifyBusinessInfo, getOrCreateBusinessInfo, formatCompanyBlock, BUSINESS_INFO_SECTORS, BUSINESS_INFO_TONES } from "./utils/business-info.js";
export type { BusinessInfo, BusinessSignals, Sector, Tone } from "./utils/business-info.js";
export { extractSections, classifySection, detectAnimations, classifyTier, structuralHash, summarizeExtraction } from "./utils/section-extractor.js";
export type { ExtractedSection, ExtractSectionsOptions, SectionClassification, AnimationPattern, AnimationType, AnimationTrigger, PremiumTier, ComponentCategory as ExtractorCategory } from "./utils/section-extractor.js";
export { classifySectionLLM, classifySectionsLLM, generateAnimationBrief, briefToDoc } from "./utils/section-classifier.js";
export type { AnimationBrief } from "./utils/section-classifier.js";
export { generateAutoSpec, generateComponent as generatePremiumComponent, enhanceFromSkeleton, validateEnhanceStructure, scoreQualityStatic, scoreQualityFull, normalizeHtml, qualityGate, computeVisualHash, hammingDistance, isVisualDuplicate, buildComponentEntry, listAvailablePersonas } from "./utils/component-generator.js";
export type { AutoSpec, QualityReport, QualityDecision, ComponentEntry, BrandLock } from "./utils/component-generator.js";
export type { UIComponentData, ComponentCategory, ComponentSlot, ComponentVariant, Adaptability, ComponentSelection } from "./models/component.js";
export { createStorage, createAnalytics } from "./storage/interface.js";
export type { StorageAdapter, StorageBackend, AnalyticsAdapter, GenerationLog, BrandCache, LayoutExample, SectionTemplate, UserFeedback, EloRating, QualitySummary, RatingTrend, ComponentEngineAdapter, CrawlTarget, RawSectionDoc, AnimationPatternRecord } from "./storage/interface.js";

export class CanvasAI {
  private router: ModelRouter;
  private _projects = new Map<string, Project>();

  constructor(opts: { apiKey?: string } = {}) { this.router = getRouter(opts); }

  createProject(title: string): Project {
    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const p = new Project({ id, title, screens: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    this._projects.set(id, p);
    return p;
  }

  project(id: string): Project {
    if (this._projects.has(id)) return this._projects.get(id)!;
    const p = new Project({ id, title: "", screens: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    this._projects.set(id, p);
    return p;
  }

  async projects(): Promise<Project[]> { return [...this._projects.values()]; }
}

let _inst: CanvasAI | null = null;
export function getCanvasAI(opts?: { apiKey?: string }): CanvasAI {
  if (!_inst) _inst = new CanvasAI(opts);
  return _inst;
}
export const canvas = new Proxy({} as CanvasAI, {
  get(_, prop) { return (getCanvasAI() as any)[prop]; },
});
