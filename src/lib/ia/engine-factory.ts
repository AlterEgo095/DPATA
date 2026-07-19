// Engine Factory - Allows plugging in different analysis engines
// Phase 3 — Extensible architecture for DPATA AI Engine

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SubjectValidationResult,
  SubjectAnalysisInput,
} from './types';
import { TfidfEngine } from './engines/tfidf-engine';

// ============================================================
// Engine Registry
// ============================================================

const engines: Map<EngineType, () => IAnalysisEngine> = new Map();

// Register built-in engines
engines.set('TFIDF', () => new TfidfEngine());

// Future engines can be registered here:
// engines.set('EMBEDDING', () => new EmbeddingEngine());
// engines.set('HYBRID', () => new HybridEngine());
// engines.set('LLM', () => new LLMEngine());
// engines.set('RAG', () => new RAGEngine());

// ============================================================
// Public API
// ============================================================

/**
 * Get an engine instance by type
 * Falls back to TFIDF if the requested engine is not available
 */
export function getEngine(type: EngineType = 'TFIDF'): IAnalysisEngine {
  const factory = engines.get(type);
  if (!factory) {
    console.warn(`Engine ${type} not found, falling back to TFIDF`);
    return engines.get('TFIDF')!();
  }
  return factory();
}

/**
 * Get list of all registered engine types
 */
export function getAvailableEngines(): EngineType[] {
  return Array.from(engines.keys());
}

/**
 * Register a custom engine
 * Use this to add new engine implementations at runtime
 */
export function registerEngine(type: EngineType, factory: () => IAnalysisEngine): void {
  engines.set(type, factory);
}

/**
 * Check if an engine type is registered
 */
export function hasEngine(type: EngineType): boolean {
  return engines.has(type);
}

// ============================================================
// High-Level Convenience API
// ============================================================

/**
 * Analyze a document for plagiarism/similarity using the default or specified engine
 */
export async function analyzeDocument(
  query: string,
  corpus: Array<{ id: string; text: string }>,
  options?: AnalysisOptions
): Promise<AnalysisResult> {
  const engine = getEngine(options?.engine);
  await engine.initialize();
  return engine.analyze(query, corpus, options);
}

/**
 * Validate an academic subject for originality
 */
export async function validateAcademicSubject(
  subject: SubjectAnalysisInput,
  existingSubjects: unknown[],
  engineType?: EngineType
): Promise<SubjectValidationResult> {
  const engine = getEngine(engineType);
  await engine.initialize();
  return engine.validateSubject(subject, existingSubjects);
}

/**
 * Generate alternative subject suggestions when duplicates are detected
 */
export async function generateSubjectAlternatives(
  subject: SubjectAnalysisInput,
  similarSubjects: unknown[],
  engineType?: EngineType
): Promise<string[]> {
  const engine = getEngine(engineType);
  await engine.initialize();
  return engine.generateAlternatives(subject, similarSubjects);
}

/**
 * Check the health status of a specific engine or the default one
 */
export async function checkEngineHealth(
  engineType?: EngineType
): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: string }> {
  const engine = getEngine(engineType);
  return engine.healthCheck();
}
