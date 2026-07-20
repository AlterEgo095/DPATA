// AI Engines Index
// Phase 3 — Central export point for all engine implementations
// PHASE 6 — Added Semantic & Hybrid engines

export { TfidfEngine } from './tfidf-engine';
export { SemanticEmbeddingEngine, preprocessText, buildEnhancedTFIDFModel, vectorizeDocument, VectorIndex } from './semantic-engine';
export { HybridEngine, DEFAULT_HYBRID_CONFIG } from './hybrid-engine';

// Future exports for extensible architecture:
// export { LLMEngine } from './llm-engine';
// export { RAGEngine } from './rag-engine';
