// Types pour l'API fédératrice interuniversitaire

export interface University {
  id: string;
  code: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  isActive: boolean;
  createdAt: string;
}

export interface FederationSearchRequest {
  text: string;
  threshold?: number;
  universities: string[];
  scope?: 'faculty' | 'department' | 'all';
}

export interface FederationMatch {
  universityCode: string;
  universityName: string;
  documentTitle: string;
  documentId: string;
  segmentIndex: number;
  segmentText: string;
  semanticScore: number;
  lexicalScore: number;
  matchType: string;
}

export interface FederationSearchResponse {
  queryUniversity: string;
  totalMatches: number;
  matches: FederationMatch[];
  universitiesQueried: number;
  processingTimeMs: number;
}
