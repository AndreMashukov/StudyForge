import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { directoryService } from '../services/directory';
import {
  CreateDirectoryRequest,
  UpdateDirectoryRequest,
  MoveDirectoryRequest,
  CreateDirectoryResponse,
  GetDirectoryResponse,
  GetDirectoryTreeResponse,
  GetDirectoryContentsResponse,
  GetDirectoryAncestorsResponse,
  MoveDirectoryResponse,
  DeleteDirectoryResponse,
} from '../../libs/shared-types/src/index';

/**
 * Authentication middleware for callable functions
 */
async function validateAuth(context: { auth?: { uid?: string } }): Promise<string> {
  if (!context.auth || !context.auth.uid) {
    throw new Error('Unauthenticated: User must be logged in');
  }
  return context.auth.uid;
}


/**
 * Create a new directory
 */
export const createDirectory = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateDirectoryRequest;

      // Validate request
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Directory name is required');
      }

      logger.info('Creating directory', { userId, name: data.name });

      const directory = await directoryService.createDirectory(userId, data);

      const response: CreateDirectoryResponse = {
        directoryId: directory.id,
        directory,
      };

      return response;
    } catch (error) {
      logger.error('Error creating directory', { error });
      throw error;
    }
  }
);


/**
 * Get a directory by ID
 */
export const getDirectory = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId } = request.data as { directoryId: string };

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Getting directory', { userId, directoryId });

      const directory = await directoryService.getDirectory(userId, directoryId);

      if (!directory) {
        throw new Error('Directory not found');
      }

      const response: GetDirectoryResponse = { directory };
      return response;
    } catch (error) {
      logger.error('Error getting directory', { error });
      throw error;
    }
  }
);

/**
 * Update a directory
 */
export const updateDirectory = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId, ...updateData } = request.data as { directoryId: string } & UpdateDirectoryRequest;

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Updating directory', { userId, directoryId });

      const directory = await directoryService.updateDirectory(userId, directoryId, updateData);

      const response: GetDirectoryResponse = { directory };
      return response;
    } catch (error) {
      logger.error('Error updating directory', { error });
      throw error;
    }
  }
);

/**
 * Delete a directory and all its contents
 */
export const deleteDirectory = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId } = request.data as { directoryId: string };

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Deleting directory', { userId, directoryId });

      const result = await directoryService.deleteDirectory(userId, directoryId);
      return result;
    } catch (error) {
      logger.error('Error deleting directory', { error });
      throw error;
    }
  }
);

/**
 * Get directory tree for the user
 */
export const getDirectoryTree = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);

      logger.info('Getting directory tree', { userId });

      const result = await directoryService.getDirectoryTree(userId);
      return result;
    } catch (error) {
      logger.error('Error getting directory tree', { error });
      throw error;
    }
  }
);

/**
 * Get directory contents (subdirectories and documents)
 */
export const getDirectoryContents = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId } = request.data as { directoryId?: string | null };

      logger.info('Getting directory contents', { userId, directoryId });

      const result = await directoryService.getDirectoryContents(userId, directoryId || null);
      return result;
    } catch (error) {
      logger.error('Error getting directory contents', { error });
      throw error;
    }
  }
);

/**
 * Get directory ancestors (breadcrumb path)
 */
export const getDirectoryAncestors = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId } = request.data as { directoryId: string };

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Getting directory ancestors', { userId, directoryId });

      const result = await directoryService.getDirectoryAncestors(userId, directoryId);
      return result;
    } catch (error) {
      logger.error('Error getting directory ancestors', { error });
      throw error;
    }
  }
);

/**
 * Move a directory to a new parent
 */
export const moveDirectory = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId, ...moveData } = request.data as { directoryId: string } & MoveDirectoryRequest;

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Moving directory', { 
        userId, 
        directoryId,
        targetParentId: moveData.targetParentId,
      });

      const result = await directoryService.moveDirectory(userId, directoryId, moveData);
      return result;
    } catch (error) {
      logger.error('Error moving directory', { error });
      throw error;
    }
  }
);

/**
 * Get directory by path
 */
export const getDirectoryByPath = onCall(
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { path } = request.data as { path: string };

      if (!path) {
        throw new Error('Path parameter is required');
      }

      logger.info('Getting directory by path', { userId, path });

      const directory = await directoryService.getDirectoryByPath(userId, path);

      if (!directory) {
        throw new Error('Directory not found');
      }

      const response: GetDirectoryResponse = { directory };
      return response;
    } catch (error) {
      logger.error('Error getting directory by path', { error });
      throw error;
    }
  }
);
