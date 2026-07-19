// Engine Factory - Allows plugging in different analysis engines
// Phase 3 — Extensible architecture for DPATA AI Engine
// PHASE 6 — Added Semantic & Hybrid engines

import {
  IAnalysisEngine,
  EngineType,
  AnalysisOptions,
  AnalysisResult,
  SubjectValidationResult,
  SubjectAnalysisInput,
} from './types';
import { TfidfEngine } from './engines/tfidf-engine';
import { SemanticEmbeddingEngine } from './engines/semantic-engine';
import { HybridEngine } from './engines/hybrid-engine';

// ============================================================
// Engine Registry
// ============================================================

const engines: Map<EngineType, () => IAnalysisEngine> = new Map();

// Register built-in engines
engines.set('TFIDF', () => new TfidfEngine());
engines.set('EMBEDDING', () => new SemanticEmbeddingEngine());
engines.set('HYBRID', () => new HybridEngine());

// Future engines can be registered here:
// engines.set('LLM', () => new LLMEngine());
// engines.set('RAG', () => new RAGEngine());

// ============================================================
// Public API
// ============================================================

/**
 * Get an engine instance by type
 * Falls back to HYBRID if the requested engine is not available (best default)
 */
export function getEngine(type: EngineType = 'HYBRID'): IAnalysisEngine {
  const factory = engines.get(type);
  if (!factory) {
    console.warn(`Engine ${type} not found, falling back to HYBRID`);
    return engines.get('HYBRID')!();
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
 * Default engine is now HYBRID for best accuracy
 */
export async function analyzeDocument(
  query: string,
  corpus: Array<{ id: string; text: string }>,
  options?: AnalysisOptions & { engine?: EngineType }
): Promise<AnalysisResult> {
  // Default to hybrid engine for best results
  const engineType = options?.engine || 'HYBRID';
  const engine = getEngine(engineType);
  await engine.initialize();
  return engine.analyze(query, corpus, options);
}

/**
 * Validate an academic subject for originality
 * Uses hybrid analysis by default for comprehensive validation
 */
export async function validateAcademicSubject(
  subject: SubjectAnalysisInput,
  existingSubjects: unknown[],
  engineType?: EngineType
): Promise<SubjectValidationResult> {
  const engine = getEngine(engineType || 'HYBRID');
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
  const engine = getEngine(engineType || 'HYBRID');
  await engine.initialize();
  return engine.generateAlternatives(subject, similarSubjects);
}

/**
 * Check the health status of a specific engine or the default one
 */
export async function checkEngineHealth(
  engineType?: EngineType
): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: string }> {
  const engine = getEngine(engineType || 'HYBRID');
  return engine.healthCheck();
}

/**
 * Get information about all available engines and their health
 */
export async function getAllEnginesStatus(): Promise<Array<{
  type: EngineType;
  name: string;
  version: string;
  health: { status: 'healthy' | 'degraded' | 'unhealthy'; details: string };
}>> {
  const engineTypes = getAvailableEngines();
  
  return Promise.all(
    engineTypes.map(async (type) => {
      const engine = getEngine(type);
      const health = await engine.healthCheck();
      return {
        type,
        name: engine.name,
        version: engine.version,
        health,
      };
    })
  );
}
