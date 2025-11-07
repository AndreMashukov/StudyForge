import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
  DocumentEnhanced,
} from '../../libs/shared-types/src/index';

const firestore = getFirestore();

export class DirectoryService {
  private readonly COLLECTION = 'directories';
  private readonly DOCUMENTS_COLLECTION = 'documents';

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
      color: request.color,
      icon: request.icon,
      documentCount: 0,
      childCount: 0,
      ruleIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore
      .collection(this.COLLECTION)
      .add(directoryData);

    // Update parent's child count
    if (parentDirectory) {
      await firestore
        .collection(this.COLLECTION)
        .doc(parentDirectory.id)
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
   * Get a directory by ID
   */
  async getDirectory(userId: string, directoryId: string): Promise<Directory | null> {
    logger.info('Getting directory', { userId, directoryId });

    const doc = await firestore
      .collection(this.COLLECTION)
      .doc(directoryId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Omit<Directory, 'id'>;

    // Verify ownership
    if (data.userId !== userId) {
      throw new Error('Access denied: Directory belongs to another user');
    }

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
        updateData.path = `${parent!.path}/${request.name}`;
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

    // Update directory
    await firestore
      .collection(this.COLLECTION)
      .doc(directoryId)
      .update(updateData);

    // If name changed, update paths of all descendants
    if (request.name && request.name !== directory.name) {
      await this.updateDescendantPaths(userId, directoryId, updateData.path!);
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

    // Count documents in all directories
    let deletedDocumentCount = 0;
    for (const dirId of allDirectoryIds) {
      const docsSnapshot = await firestore
        .collection(this.DOCUMENTS_COLLECTION)
        .where('userId', '==', userId)
        .where('directoryId', '==', dirId)
        .get();

      deletedDocumentCount += docsSnapshot.size;

      // Delete documents
      const batch = firestore.batch();
      docsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // Delete all directories
    const dirBatch = firestore.batch();
    allDirectoryIds.forEach(dirId => {
      const dirRef = firestore.collection(this.COLLECTION).doc(dirId);
      dirBatch.delete(dirRef);
    });
    await dirBatch.commit();

    // Update parent's child count
    if (directory.parentId) {
      await firestore
        .collection(this.COLLECTION)
        .doc(directory.parentId)
        .update({
          childCount: FieldValue.increment(-1),
          updatedAt: new Date(),
        });
    }

    logger.info('Directory deleted', {
      directoryId,
      deletedDocumentCount,
      deletedDirectoryCount: allDirectoryIds.length,
    });

    return {
      success: true,
      deletedDocumentCount,
      deletedDirectoryCount: allDirectoryIds.length,
    };
  }

  /**
   * Get directory tree for a user
   */
  async getDirectoryTree(userId: string): Promise<GetDirectoryTreeResponse> {
    logger.info('Getting directory tree', { userId });

    // Get all directories for user
    const snapshot = await firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
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
    const subdirSnapshot = await firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
      .where('parentId', '==', directoryId)
      .orderBy('name', 'asc')
      .get();

    const subdirectories: Directory[] = subdirSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Directory));

    // Get documents in this directory
    const docsSnapshot = await firestore
      .collection(this.DOCUMENTS_COLLECTION)
      .where('userId', '==', userId)
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
      newPath = `${targetParent!.path}/${directory.name}`;
      newLevel = targetParent!.level + 1;
    } else {
      newPath = `/${directory.name}`;
      newLevel = 0;
    }

    // Update old parent's child count
    if (directory.parentId) {
      await firestore
        .collection(this.COLLECTION)
        .doc(directory.parentId)
        .update({
          childCount: FieldValue.increment(-1),
          updatedAt: new Date(),
        });
    }

    // Update new parent's child count
    if (request.targetParentId) {
      await firestore
        .collection(this.COLLECTION)
        .doc(request.targetParentId)
        .update({
          childCount: FieldValue.increment(1),
          updatedAt: new Date(),
        });
    }

    // Update directory
    await firestore
      .collection(this.COLLECTION)
      .doc(directoryId)
      .update({
        parentId: request.targetParentId || null,
        path: newPath,
        level: newLevel,
        updatedAt: new Date(),
      });

    // Update paths of all descendants
    const descendants = await this.updateDescendantPaths(userId, directoryId, newPath);

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

    const snapshot = await firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
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

    if (DIRECTORY_CONSTRAINTS.RESERVED_NAMES.includes(name.toLowerCase() as any)) {
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
    const snapshot = await firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
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
      const node = nodeMap.get(dir.id)!;
      if (dir.parentId && nodeMap.has(dir.parentId)) {
        nodeMap.get(dir.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
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

    const snapshot = await firestore
      .collection(this.COLLECTION)
      .where('userId', '==', userId)
      .where('path', '>=', directory.path + '/')
      .where('path', '<', directory.path + '0') // '0' is next character after '/'
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

    const batch = firestore.batch();
    const oldPath = directory.path;

    descendants.forEach(desc => {
      const updatedPath = desc.path.replace(oldPath, newPath);
      const pathParts = updatedPath.split('/').filter(p => p.length > 0);
      const updatedLevel = pathParts.length;

      batch.update(firestore.collection(this.COLLECTION).doc(desc.id), {
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
