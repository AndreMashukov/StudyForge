import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import {
  Directory,
  DirectoryTreeNode,
  CreateDirectoryRequest,
  UpdateDirectoryRequest,
  MoveDirectoryRequest,
  DirectoryValidationResult,
  DIRECTORY_CONSTRAINTS,
  GetDirectoryTreeResponse,
  GetDirectoryContentsResponse,
  GetDirectoryContentsWithArtifactsResponse,
  GetDirectoryContentsWithArtifactSummariesResponse,
  ArtifactSummary,
  ArtifactSummaryType,
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
  DocumentEnhanced,
  Quiz,
  FlashcardSet,
  SlideDeck,
  DiagramQuiz,
  SequenceQuiz,
  Rule,
} from '../../libs/shared-types/src/index';
import { resolveRulesForDirectory } from './rule-resolution';
import { recalculateStatsForDirectoryMove } from './interaction-tracking';
import { FirestorePaths } from '../lib/firestore-paths';

export class DirectoryService {

  /**
   * Create a new directory
   */
  async createDirectory(
    userId: string,
    request: CreateDirectoryRequest
  ): Promise<Directory> {
    logger.info('Creating directory', { userId, request });

    // Validate input
    const validation = this.validateDirectoryName(request.name);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Validate parent directory if specified
    let parentDirectory: Directory | null = null;
    let level = 0;
    let path = `/${request.name}`;

    if (request.parentId) {
      parentDirectory = await this.getDirectory(userId, request.parentId);
      if (!parentDirectory) {
        throw new Error('Parent directory not found');
      }

      // Check depth constraint
      if (parentDirectory.level >= DIRECTORY_CONSTRAINTS.MAX_DEPTH - 1) {
        throw new Error(
          `Maximum directory depth (${DIRECTORY_CONSTRAINTS.MAX_DEPTH}) exceeded`
        );
      }

      level = parentDirectory.level + 1;
      path = `${parentDirectory.path}/${request.name}`;
    }

    // Check for duplicate name at the same level
    const existingDir = await this.findDirectoryByNameAndParent(
      userId,
      request.name,
      request.parentId || null
    );
    if (existingDir) {
      throw new Error('Directory with this name already exists at this level');
    }

    // Create directory document
    const now = new Date();
    const directoryData: Omit<Directory, 'id'> = {
      userId,
      name: request.name,
      parentId: request.parentId || null,
      path,
      level,
      ...(request.color !== undefined ? { color: request.color } : {}),
      ...(request.icon !== undefined ? { icon: request.icon } : {}),
      ...(request.description !== undefined ? { description: request.description } : {}),
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      diagramQuizCount: 0,
      ruleIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await FirestorePaths.directories(userId)
      .add(directoryData);

    // Update parent's child count
    if (parentDirectory) {
      await FirestorePaths.directory(userId, parentDirectory.id)
        .update({
          childCount: FieldValue.increment(1),
          updatedAt: now,
        });
    }

    logger.info('Directory created', { directoryId: docRef.id });

    return {
      id: docRef.id,
      ...directoryData,
    };
  }

  /**
   * Ensures a directory exists and is owned by the user (throws if not found).
   */
  async validateDirectoryId(userId: string, directoryId: string): Promise<void> {
    const dir = await this.getDirectory(userId, directoryId);
    if (!dir) {
      throw new Error(`Directory ${directoryId} does not exist.`);
    }
  }

  /**
   * Adjust cached artifact counts on a directory document.
   */
  async adjustDirectoryArtifactCount(
    userId: string,
    directoryId: string,
    field: 'quizCount' | 'flashcardSetCount' | 'slideDeckCount',
    delta: number
  ): Promise<void> {
    await FirestorePaths.directory(userId, directoryId).update({
      [field]: FieldValue.increment(delta),
      updatedAt: new Date(),
    });
  }

  /**
   * Get a directory by ID
   */
  async getDirectory(userId: string, directoryId: string): Promise<Directory | null> {
    logger.info('Getting directory', { userId, directoryId });

    const doc = await FirestorePaths.directory(userId, directoryId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Omit<Directory, 'id'>;

    return {
      id: doc.id,
      ...data,
    };
  }

  /**
   * Update a directory
   */
  async updateDirectory(
    userId: string,
    directoryId: string,
    request: UpdateDirectoryRequest
  ): Promise<Directory> {
    logger.info('Updating directory', { userId, directoryId, request });

    // Get existing directory
    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    // Validate new name if provided
    if (request.name) {
      const validation = this.validateDirectoryName(request.name);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check for duplicate name at the same level
      if (request.name !== directory.name) {
        const existingDir = await this.findDirectoryByNameAndParent(
          userId,
          request.name,
          directory.parentId
        );
        if (existingDir && existingDir.id !== directoryId) {
          throw new Error('Directory with this name already exists at this level');
        }
      }
    }

    // Build update data
    const updateData: Partial<Directory> = {
      updatedAt: new Date(),
    };

    if (request.name) {
      updateData.name = request.name;
      // Recalculate path if name changed
      if (directory.parentId) {
        const parent = await this.getDirectory(userId, directory.parentId);
        if (parent) {
          updateData.path = `${parent.path}/${request.name}`;
        }
      } else {
        updateData.path = `/${request.name}`;
      }
    }

    if (request.color !== undefined) {
      updateData.color = request.color;
    }

    if (request.icon !== undefined) {
      updateData.icon = request.icon;
    }

    if (request.description !== undefined) {
      updateData.description = request.description;
    }

    // Update directory
    await FirestorePaths.directory(userId, directoryId)
      .update(updateData);

    // If name changed, update paths of all descendants
    if (request.name && request.name !== directory.name && updateData.path) {
      await this.updateDescendantPaths(userId, directoryId, updateData.path);
    }

    logger.info('Directory updated', { directoryId });

    return {
      ...directory,
      ...updateData,
    } as Directory;
  }

  /**
   * Delete a directory and all its contents
   */
  async deleteDirectory(
    userId: string,
    directoryId: string
  ): Promise<DeleteDirectoryResponse> {
    logger.info('Deleting directory', { userId, directoryId });

    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    // Get all descendant directories
    const descendants = await this.getDescendants(userId, directoryId);
    const allDirectoryIds = [directoryId, ...descendants.map(d => d.id)];

    // Delete documents (Firestore metadata + Storage content) in all directories
    let deletedDocumentCount = 0;
    let deletedQuizCount = 0;
    let deletedFlashcardSetCount = 0;
    let deletedSlideDeckCount = 0;
    let deletedDiagramQuizCount = 0;
    const db = FirestorePaths.documents(userId).firestore;
    const { DocumentService } = await import('./document-storage.js');
    const bucket = admin.storage().bucket();

    for (const dirId of allDirectoryIds) {
      const docsSnapshot = await FirestorePaths.documents(userId)
        .where('directoryId', '==', dirId)
        .get();

      deletedDocumentCount += docsSnapshot.size;

      // Delete Storage content for each document
      for (const doc of docsSnapshot.docs) {
        try {
          await DocumentService.deleteDocument(userId, doc.id);
        } catch (storageErr) {
          logger.warn('Failed to delete storage for document during directory deletion', {
            documentId: doc.id, directoryId: dirId,
            error: storageErr instanceof Error ? storageErr.message : String(storageErr),
          });
        }
      }

      // Delete Firestore metadata in chunks of 500
      for (let i = 0; i < docsSnapshot.docs.length; i += 500) {
        const chunk = docsSnapshot.docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Delete quizzes in this directory
      const quizzesSnap = await FirestorePaths.quizzes(userId)
        .where('directoryId', '==', dirId)
        .get();
      deletedQuizCount += quizzesSnap.size;
      for (let i = 0; i < quizzesSnap.docs.length; i += 500) {
        const chunk = quizzesSnap.docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete flashcard sets in this directory
      const fcSnap = await FirestorePaths.flashcardSets(userId)
        .where('directoryId', '==', dirId)
        .get();
      deletedFlashcardSetCount += fcSnap.size;
      for (let i = 0; i < fcSnap.docs.length; i += 500) {
        const chunk = fcSnap.docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete slide decks (storage images + Firestore)
      const sdSnap = await FirestorePaths.slideDecks(userId)
        .where('directoryId', '==', dirId)
        .get();
      deletedSlideDeckCount += sdSnap.size;
      for (const deckDoc of sdSnap.docs) {
        const deck = deckDoc.data() as { slides?: { imageStoragePath?: string }[] };
        for (const slide of deck.slides || []) {
          if (slide.imageStoragePath) {
            try {
              await bucket.file(slide.imageStoragePath).delete();
            } catch {
              logger.warn('Failed to delete slide image during directory deletion', {
                path: slide.imageStoragePath,
              });
            }
          }
        }
      }
      for (let i = 0; i < sdSnap.docs.length; i += 500) {
        const chunk = sdSnap.docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      const dqSnap = await FirestorePaths.diagramQuizzes(userId)
        .where('directoryId', '==', dirId)
        .get();
      deletedDiagramQuizCount += dqSnap.size;
      for (let i = 0; i < dqSnap.docs.length; i += 500) {
        const chunk = dqSnap.docs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // Delete all directories in chunks of 500
    for (let i = 0; i < allDirectoryIds.length; i += 500) {
      const chunk = allDirectoryIds.slice(i, i + 500);
      const dirBatch = db.batch();
      chunk.forEach(dirId => {
        dirBatch.delete(FirestorePaths.directory(userId, dirId));
      });
      await dirBatch.commit();
    }

    // Update parent's child count
    if (directory.parentId) {
      await FirestorePaths.directory(userId, directory.parentId)
        .update({
          childCount: FieldValue.increment(-1),
          updatedAt: new Date(),
        });
    }

    logger.info('Directory deleted', {
      directoryId,
      deletedDocumentCount,
      deletedDirectoryCount: allDirectoryIds.length,
      deletedQuizCount,
      deletedFlashcardSetCount,
      deletedSlideDeckCount,
      deletedDiagramQuizCount,
    });

    return {
      success: true,
      deletedDocumentCount,
      deletedDirectoryCount: allDirectoryIds.length,
      deletedQuizCount,
      deletedFlashcardSetCount,
      deletedSlideDeckCount,
      deletedDiagramQuizCount,
    };
  }

  /**
   * Get directory tree for a user
   */
  async getDirectoryTree(userId: string): Promise<GetDirectoryTreeResponse> {
    logger.info('Getting directory tree', { userId });

    // Get all directories for user
    const snapshot = await FirestorePaths.directories(userId)
      .orderBy('path', 'asc')
      .get();

    const directories: Directory[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Directory));

    // Build tree structure
    const tree = this.buildTree(directories);

    logger.info('Directory tree retrieved', {
      totalDirectories: directories.length,
      rootNodes: tree.length,
    });

    return {
      tree,
      totalDirectories: directories.length,
    };
  }

  /**
   * Get directory contents (subdirectories and documents)
   */
  async getDirectoryContents(
    userId: string,
    directoryId: string | null
  ): Promise<GetDirectoryContentsResponse> {
    logger.info('Getting directory contents', { userId, directoryId });

    let directory: Directory | null = null;
    if (directoryId) {
      directory = await this.getDirectory(userId, directoryId);
      if (!directory) {
        // If directory not found, log a warning and return root directory contents instead
        logger.warn('Directory not found, falling back to root', { userId, directoryId });
        directoryId = null; // Treat as root directory request
      }
    }

    // Get subdirectories
    const subdirSnapshot = await FirestorePaths.directories(userId)
      .where('parentId', '==', directoryId)
      .orderBy('name', 'asc')
      .get();

    const subdirectories: Directory[] = subdirSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Directory));

    // Get documents in this directory
    const docsSnapshot = await FirestorePaths.documents(userId)
      .where('directoryId', '==', directoryId)
      .orderBy('createdAt', 'desc')
      .get();

    const documents: DocumentEnhanced[] = docsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as DocumentEnhanced));

    logger.info('Directory contents retrieved', {
      subdirectories: subdirectories.length,
      documents: documents.length,
    });

    return {
      directory: directory || ({
        id: 'root',
        userId,
        name: 'Root',
        parentId: null,
        path: '/',
        level: 0,
        documentCount: documents.length,
        childCount: subdirectories.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Directory),
      subdirectories,
      documents,
      totalCount: subdirectories.length + documents.length,
    };
  }

  /**
   * Directory contents plus artifacts and resolved cascading rules (single request).
   */
  async getDirectoryContentsWithArtifacts(
    userId: string,
    directoryId: string | null,
    options?: { includeArtifacts?: boolean; includeRules?: boolean; artifactLimit?: number }
  ): Promise<GetDirectoryContentsWithArtifactsResponse> {
    const includeArtifacts = options?.includeArtifacts !== false;
    const includeRules = options?.includeRules !== false;
    const artifactLimit = Math.min(options?.artifactLimit ?? 20, 100);

    const base = await this.getDirectoryContents(userId, directoryId);

    let quizzes: Quiz[] = [];
    let flashcardSets: FlashcardSet[] = [];
    let slideDecks: SlideDeck[] = [];
    let diagramQuizzes: DiagramQuiz[] = [];
    let sequenceQuizzes: SequenceQuiz[] = [];
    let resolvedRules: { rules: Rule[]; inheritanceMap: { [key: string]: Rule[] } } = {
      rules: [],
      inheritanceMap: {},
    };

    if (directoryId && includeArtifacts) {
      const [qSnap, fSnap, sSnap, dqSnap, sqSnap] = await Promise.all([
        FirestorePaths.quizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .get(),
        FirestorePaths.flashcardSets(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .get(),
        FirestorePaths.slideDecks(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .get(),
        FirestorePaths.diagramQuizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .get(),
        FirestorePaths.sequenceQuizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .get(),
      ]);

      quizzes = qSnap.docs.map(d => ({ ...d.data(), id: d.id } as Quiz));
      flashcardSets = fSnap.docs.map(d => ({ ...d.data(), id: d.id } as FlashcardSet));
      slideDecks = sSnap.docs.map(d => ({ ...d.data(), id: d.id } as SlideDeck));
      diagramQuizzes = dqSnap.docs.map(d => ({ ...d.data(), id: d.id } as DiagramQuiz));
      sequenceQuizzes = sqSnap.docs.map(d => ({ ...d.data(), id: d.id } as SequenceQuiz));
    }

    if (directoryId && includeRules) {
      resolvedRules = await resolveRulesForDirectory(userId, directoryId);
    }

    const totalCount =
      base.totalCount +
      quizzes.length +
      flashcardSets.length +
      slideDecks.length +
      diagramQuizzes.length +
      sequenceQuizzes.length;

    return {
      ...base,
      quizzes,
      flashcardSets,
      slideDecks,
      diagramQuizzes,
      sequenceQuizzes,
      resolvedRules,
      totalCount,
    };
  }

  /**
   * Lightweight variant: directory contents plus artifact summaries (id, title, createdAt, type only).
   * Uses Firestore field masks to avoid transferring large nested arrays (questions, flashcards, slides).
   */
  async getDirectoryContentsWithArtifactSummaries(
    userId: string,
    directoryId: string | null,
    options?: { includeRules?: boolean; artifactLimit?: number }
  ): Promise<GetDirectoryContentsWithArtifactSummariesResponse> {
    const includeRules = options?.includeRules !== false;
    const artifactLimit = Math.min(options?.artifactLimit ?? 20, 100);

    const base = await this.getDirectoryContents(userId, directoryId);

    const artifactSummaries: ArtifactSummary[] = [];
    let resolvedRules: { rules: Rule[]; inheritanceMap: { [key: string]: Rule[] } } = {
      rules: [],
      inheritanceMap: {},
    };

    if (directoryId) {
      const [qSnap, fSnap, sSnap, dqSnap, sqSnap] = await Promise.all([
        FirestorePaths.quizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .select('title', 'createdAt', 'appliedRuleIds')
          .get(),
        FirestorePaths.flashcardSets(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .select('title', 'createdAt', 'appliedRuleIds')
          .get(),
        FirestorePaths.slideDecks(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .select('title', 'createdAt', 'appliedRuleIds')
          .get(),
        FirestorePaths.diagramQuizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .select('title', 'createdAt', 'appliedRuleIds')
          .get(),
        FirestorePaths.sequenceQuizzes(userId)
          .where('directoryId', '==', directoryId)
          .orderBy('createdAt', 'desc')
          .limit(artifactLimit)
          .select('title', 'createdAt', 'appliedRuleIds')
          .get(),
      ]);

      const toSummaries = (snap: FirebaseFirestore.QuerySnapshot, type: ArtifactSummaryType): ArtifactSummary[] =>
        snap.docs.map((d) => ({
          id: d.id,
          title: d.data().title as string,
          createdAt: d.data().createdAt,
          type,
          appliedRuleIds: (d.data().appliedRuleIds as string[] | undefined) || [],
        }));

      artifactSummaries.push(
        ...toSummaries(qSnap, 'quiz'),
        ...toSummaries(fSnap, 'flashcard'),
        ...toSummaries(sSnap, 'slideDeck'),
        ...toSummaries(dqSnap, 'diagramQuiz'),
        ...toSummaries(sqSnap, 'sequenceQuiz'),
      );

      if (includeRules) {
        resolvedRules = await resolveRulesForDirectory(userId, directoryId);
      }
    }

    const totalCount = base.totalCount + artifactSummaries.length;

    return {
      ...base,
      artifactSummaries,
      resolvedRules,
      totalCount,
    };
  }

  /**
   * Get directory ancestors (breadcrumb path)
   */
  async getDirectoryAncestors(
    userId: string,
    directoryId: string
  ): Promise<GetDirectoryAncestorsResponse> {
    logger.info('Getting directory ancestors', { userId, directoryId });

    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    const ancestors: Directory[] = [];
    let currentId: string | null = directory.parentId;

    while (currentId) {
      const parent = await this.getDirectory(userId, currentId);
      if (!parent) break;
      ancestors.unshift(parent); // Add to beginning
      currentId = parent.parentId;
    }

    logger.info('Directory ancestors retrieved', { count: ancestors.length });

    return { ancestors };
  }

  /**
   * Move a directory to a new parent
   */
  async moveDirectory(
    userId: string,
    directoryId: string,
    request: MoveDirectoryRequest
  ): Promise<MoveDirectoryResponse> {
    logger.info('Moving directory', { userId, directoryId, request });

    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    // Validate target parent
    if (request.targetParentId) {
      const targetParent = await this.getDirectory(userId, request.targetParentId);
      if (!targetParent) {
        throw new Error('Target parent directory not found');
      }

      // Prevent moving to a descendant
      if (await this.isDescendant(userId, request.targetParentId, directoryId)) {
        throw new Error('Cannot move directory to its own descendant');
      }

      // Check depth constraint
      if (targetParent.level >= DIRECTORY_CONSTRAINTS.MAX_DEPTH - 1) {
        throw new Error('Target location exceeds maximum directory depth');
      }
    }

    // Check for name conflict at target location
    const conflict = await this.findDirectoryByNameAndParent(
      userId,
      directory.name,
      request.targetParentId
    );
    if (conflict && conflict.id !== directoryId) {
      throw new Error('A directory with this name already exists at the target location');
    }

    // Calculate new path and level
    let newPath: string;
    let newLevel: number;

    if (request.targetParentId) {
      const targetParent = await this.getDirectory(userId, request.targetParentId);
      if (targetParent) {
        newPath = `${targetParent.path}/${directory.name}`;
        newLevel = targetParent.level + 1;
      } else {
        throw new Error('Target parent directory not found');
      }
    } else {
      newPath = `/${directory.name}`;
      newLevel = 0;
    }

    // Update old parent's child count
    if (directory.parentId) {
      await FirestorePaths.directory(userId, directory.parentId)
        .update({
          childCount: FieldValue.increment(-1),
          updatedAt: new Date(),
        });
    }

    // Update new parent's child count
    if (request.targetParentId) {
      await FirestorePaths.directory(userId, request.targetParentId)
        .update({
          childCount: FieldValue.increment(1),
          updatedAt: new Date(),
        });
    }

    // Update directory
    await FirestorePaths.directory(userId, directoryId)
      .update({
        parentId: request.targetParentId || null,
        path: newPath,
        level: newLevel,
        updatedAt: new Date(),
      });

    // Update paths of all descendants
    const descendants = await this.updateDescendantPaths(userId, directoryId, newPath);

    // Recalculate interaction stats rollups for affected ancestor directories
    await recalculateStatsForDirectoryMove(
      userId,
      directoryId,
      directory.parentId,
      request.targetParentId ?? null
    );

    logger.info('Directory moved', {
      directoryId,
      affectedDescendants: descendants,
    });

    return {
      directory: {
        ...directory,
        parentId: request.targetParentId || null,
        path: newPath,
        level: newLevel,
        updatedAt: new Date(),
      },
      affectedDescendants: descendants,
    };
  }

  /**
   * Get directory by path
   */
  async getDirectoryByPath(userId: string, path: string): Promise<Directory | null> {
    logger.info('Getting directory by path', { userId, path });

    const snapshot = await FirestorePaths.directories(userId)
      .where('path', '==', path)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Directory;
  }

  // ==================== Private Helper Methods ====================

  /**
   * Validate directory name
   */
  private validateDirectoryName(name: string): DirectoryValidationResult {
    const errors: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push('Directory name is required');
    }

    if (name.length > DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH) {
      errors.push(
        `Directory name must not exceed ${DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH} characters`
      );
    }

    const reservedNames = DIRECTORY_CONSTRAINTS.RESERVED_NAMES as readonly string[];
    if (reservedNames.includes(name.toLowerCase())) {
      errors.push('Directory name is reserved');
    }

    // Check for invalid characters
    if (/[/\\:*?"<>|]/.test(name)) {
      errors.push('Directory name contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find directory by name and parent
   */
  private async findDirectoryByNameAndParent(
    userId: string,
    name: string,
    parentId: string | null
  ): Promise<Directory | null> {
    const snapshot = await FirestorePaths.directories(userId)
      .where('name', '==', name)
      .where('parentId', '==', parentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Directory;
  }

  /**
   * Build tree structure from flat directory list
   */
  private buildTree(directories: Directory[]): DirectoryTreeNode[] {
    const nodeMap = new Map<string, DirectoryTreeNode>();
    const rootNodes: DirectoryTreeNode[] = [];

    // Create nodes
    directories.forEach(dir => {
      nodeMap.set(dir.id, {
        directory: dir,
        children: [],
      });
    });

    // Build tree
    directories.forEach(dir => {
      const node = nodeMap.get(dir.id);
      if (node) {
        if (dir.parentId && nodeMap.has(dir.parentId)) {
          const parentNode = nodeMap.get(dir.parentId);
          if (parentNode) {
            parentNode.children.push(node);
          }
        } else {
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }

  /**
   * Get all descendant directories
   */
  private async getDescendants(userId: string, directoryId: string): Promise<Directory[]> {
    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) return [];

    const snapshot = await FirestorePaths.directories(userId)
      .where('path', '>=', directory.path + '/')
      .where('path', '<', directory.path + '0')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Directory));
  }

  /**
   * Check if a directory is a descendant of another
   */
  private async isDescendant(
    userId: string,
    potentialDescendantId: string,
    ancestorId: string
  ): Promise<boolean> {
    const potentialDescendant = await this.getDirectory(userId, potentialDescendantId);
    if (!potentialDescendant) return false;

    const ancestor = await this.getDirectory(userId, ancestorId);
    if (!ancestor) return false;

    return potentialDescendant.path.startsWith(ancestor.path + '/');
  }

  /**
   * Update paths of all descendant directories
   */
  private async updateDescendantPaths(
    userId: string,
    directoryId: string,
    newPath: string
  ): Promise<number> {
    const directory = await this.getDirectory(userId, directoryId);
    if (!directory) return 0;

    const descendants = await this.getDescendants(userId, directoryId);
    if (descendants.length === 0) return 0;

    const db = FirestorePaths.directories(userId).firestore;
    const batch = db.batch();
    const oldPath = directory.path;

    descendants.forEach(desc => {
      const updatedPath = desc.path.replace(oldPath, newPath);
      const pathParts = updatedPath.split('/').filter(p => p.length > 0);
      const updatedLevel = pathParts.length;

      batch.update(FirestorePaths.directory(userId, desc.id), {
        path: updatedPath,
        level: updatedLevel,
        updatedAt: new Date(),
      });
    });

    await batch.commit();
    return descendants.length;
  }
}

// Export singleton instance
export const directoryService = new DirectoryService();
