import { onRequest } from 'firebase-functions/v2/https';
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
  ApiResponse,
} from '../../../libs/shared-types/src/index';

/**
 * Helper function to verify authentication
 */
function verifyAuth(req: any): string {
  const userId = req.headers['x-user-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!userId) {
    throw new Error('Unauthorized: Missing user ID');
  }
  
  return userId as string;
}

/**
 * Helper function to send JSON response
 */
function sendResponse<T>(res: any, statusCode: number, data: ApiResponse<T>) {
  res.status(statusCode).json(data);
}

/**
 * Helper function to handle errors
 */
function handleError(res: any, error: unknown) {
  logger.error('API error', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  const message = error instanceof Error ? error.message : 'Internal server error';
  const statusCode = message.includes('not found') ? 404 
    : message.includes('Unauthorized') ? 401
    : message.includes('already exists') ? 409
    : 400;

  sendResponse(res, statusCode, {
    success: false,
    error: {
      code: statusCode === 404 ? 'NOT_FOUND' 
        : statusCode === 401 ? 'UNAUTHORIZED'
        : statusCode === 409 ? 'CONFLICT'
        : 'BAD_REQUEST',
      message,
    },
  });
}

/**
 * Create a new directory
 * POST /api/directories
 */
export const createDirectory = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const request: CreateDirectoryRequest = req.body;

      // Validate request
      if (!request.name || request.name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory name is required' },
        });
        return;
      }

      logger.info('Creating directory via API', { userId, name: request.name });

      const directory = await directoryService.createDirectory(userId, request);

      const response: CreateDirectoryResponse = {
        directoryId: directory.id,
        directory,
      };

      sendResponse<CreateDirectoryResponse>(res, 201, {
        success: true,
        data: response,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Get a directory by ID
 * GET /api/directories/:id
 */
export const getDirectory = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const directoryId = req.path.split('/').pop();

      if (!directoryId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory ID is required' },
        });
        return;
      }

      logger.info('Getting directory via API', { userId, directoryId });

      const directory = await directoryService.getDirectory(userId, directoryId);

      if (!directory) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Directory not found' },
        });
        return;
      }

      const response: GetDirectoryResponse = { directory };

      sendResponse<GetDirectoryResponse>(res, 200, {
        success: true,
        data: response,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Update a directory
 * PUT /api/directories/:id
 */
export const updateDirectory = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'PUT') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const directoryId = req.path.split('/').pop();
      const request: UpdateDirectoryRequest = req.body;

      if (!directoryId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory ID is required' },
        });
        return;
      }

      logger.info('Updating directory via API', { userId, directoryId });

      const directory = await directoryService.updateDirectory(userId, directoryId, request);

      const response: GetDirectoryResponse = { directory };

      sendResponse<GetDirectoryResponse>(res, 200, {
        success: true,
        data: response,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Delete a directory and all its contents
 * DELETE /api/directories/:id
 */
export const deleteDirectory = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'DELETE') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const directoryId = req.path.split('/').pop();

      if (!directoryId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory ID is required' },
        });
        return;
      }

      logger.info('Deleting directory via API', { userId, directoryId });

      const result = await directoryService.deleteDirectory(userId, directoryId);

      sendResponse<DeleteDirectoryResponse>(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Get directory tree for the user
 * GET /api/directories/tree
 */
export const getDirectoryTree = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);

      logger.info('Getting directory tree via API', { userId });

      const result = await directoryService.getDirectoryTree(userId);

      sendResponse<GetDirectoryTreeResponse>(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Get directory contents (subdirectories and documents)
 * GET /api/directories/:id/contents
 * GET /api/directories/root/contents (for root directory)
 */
export const getDirectoryContents = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const pathParts = req.path.split('/');
      const directoryIdOrRoot = pathParts[pathParts.length - 2]; // Get the ID before 'contents'
      
      const directoryId = directoryIdOrRoot === 'root' ? null : directoryIdOrRoot;

      logger.info('Getting directory contents via API', { userId, directoryId });

      const result = await directoryService.getDirectoryContents(userId, directoryId);

      sendResponse<GetDirectoryContentsResponse>(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Get directory ancestors (breadcrumb path)
 * GET /api/directories/:id/ancestors
 */
export const getDirectoryAncestors = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const pathParts = req.path.split('/');
      const directoryId = pathParts[pathParts.length - 2]; // Get the ID before 'ancestors'

      if (!directoryId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory ID is required' },
        });
        return;
      }

      logger.info('Getting directory ancestors via API', { userId, directoryId });

      const result = await directoryService.getDirectoryAncestors(userId, directoryId);

      sendResponse<GetDirectoryAncestorsResponse>(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Move a directory to a new parent
 * POST /api/directories/:id/move
 */
export const moveDirectory = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const pathParts = req.path.split('/');
      const directoryId = pathParts[pathParts.length - 2]; // Get the ID before 'move'
      const request: MoveDirectoryRequest = req.body;

      if (!directoryId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Directory ID is required' },
        });
        return;
      }

      logger.info('Moving directory via API', { 
        userId, 
        directoryId,
        targetParentId: request.targetParentId,
      });

      const result = await directoryService.moveDirectory(userId, directoryId, request);

      sendResponse<MoveDirectoryResponse>(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);

/**
 * Get directory by path
 * GET /api/directories/by-path?path=/Projects/Web
 */
export const getDirectoryByPath = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ 
          success: false, 
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } 
        });
        return;
      }

      const userId = verifyAuth(req);
      const path = req.query.path as string;

      if (!path) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Path parameter is required' },
        });
        return;
      }

      logger.info('Getting directory by path via API', { userId, path });

      const directory = await directoryService.getDirectoryByPath(userId, path);

      if (!directory) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Directory not found' },
        });
        return;
      }

      const response: GetDirectoryResponse = { directory };

      sendResponse<GetDirectoryResponse>(res, 200, {
        success: true,
        data: response,
      });
    } catch (error) {
      handleError(res, error);
    }
  }
);
