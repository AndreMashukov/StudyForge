import { DirectoryChatArtifactContext, RetrievedDirectoryChatChunk } from '@shared-types';

export interface DirectoryChatSourceDocument {
  id: string;
  title: string;
  content: string;
}

export interface ChatRetrievalStrategyParams {
  message: string;
  documents: DirectoryChatSourceDocument[];
  artifactContext?: DirectoryChatArtifactContext;
}

export interface ChatRetrievalStrategy {
  selectContext(params: ChatRetrievalStrategyParams): Promise<RetrievedDirectoryChatChunk[]>;
}

interface CandidateChunk extends RetrievedDirectoryChatChunk {
  score: number;
  index: number;
}

const MAX_CHUNKS = 8;
const MAX_CHUNK_CHARS = 2200;
const MAX_TOTAL_CHARS = 14000;
const MIN_TOKEN_LENGTH = 3;

export class SimpleDirectoryChatRetrievalStrategy implements ChatRetrievalStrategy {
  async selectContext(params: ChatRetrievalStrategyParams): Promise<RetrievedDirectoryChatChunk[]> {
    const query = this.buildQuery(params.message, params.artifactContext);
    const queryTerms = this.tokenize(query);
    const candidates = params.documents.flatMap((document) => this.chunkDocument(document));

    const scored = candidates
      .map((chunk, index): CandidateChunk => ({
        ...chunk,
        index,
        score: this.scoreChunk(chunk, queryTerms),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.index - right.index;
      });

    const selected: RetrievedDirectoryChatChunk[] = [];
    let totalChars = 0;

    for (const chunk of scored) {
      if (selected.length >= MAX_CHUNKS) break;
      if (totalChars + chunk.text.length > MAX_TOTAL_CHARS && selected.length > 0) continue;

      selected.push({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        text: chunk.text,
      });
      totalChars += chunk.text.length;
    }

    return selected;
  }

  private buildQuery(message: string, artifactContext?: DirectoryChatArtifactContext): string {
    if (!artifactContext) return message;

    return [
      message,
      artifactContext.title,
      artifactContext.question,
      artifactContext.explanation,
      artifactContext.options?.join(' '),
      artifactContext.userAnswer,
      artifactContext.correctAnswer,
      artifactContext.sequenceItems?.join(' '),
      artifactContext.userSequence?.join(' '),
      artifactContext.correctSequence?.join(' '),
      artifactContext.slideTitle,
      artifactContext.slideContent,
      artifactContext.speakerNotes,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= MIN_TOKEN_LENGTH)
    );
  }

  private chunkDocument(document: DirectoryChatSourceDocument): RetrievedDirectoryChatChunk[] {
    const sections = document.content
      .split(/(?=^#{1,6}\s+)/m)
      .map((section) => section.trim())
      .filter(Boolean);

    const rawSections = sections.length > 0 ? sections : [document.content.trim()].filter(Boolean);
    const chunks: RetrievedDirectoryChatChunk[] = [];

    for (const section of rawSections) {
      if (section.length <= MAX_CHUNK_CHARS) {
        chunks.push({
          documentId: document.id,
          documentTitle: document.title,
          text: section,
        });
        continue;
      }

      for (let start = 0; start < section.length; start += MAX_CHUNK_CHARS) {
        chunks.push({
          documentId: document.id,
          documentTitle: document.title,
          text: section.slice(start, start + MAX_CHUNK_CHARS).trim(),
        });
      }
    }

    return chunks;
  }

  private scoreChunk(chunk: RetrievedDirectoryChatChunk, queryTerms: Set<string>): number {
    const chunkTerms = this.tokenize(`${chunk.documentTitle} ${chunk.text}`);
    let overlap = 0;

    queryTerms.forEach((term) => {
      if (chunkTerms.has(term)) overlap += 1;
    });

    const titleTerms = this.tokenize(chunk.documentTitle);
    let titleOverlap = 0;
    queryTerms.forEach((term) => {
      if (titleTerms.has(term)) titleOverlap += 1;
    });

    return overlap + titleOverlap * 2;
  }
}
