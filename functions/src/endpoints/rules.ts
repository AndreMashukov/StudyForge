import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  CreateRuleRequest,
  UpdateRuleRequest,
  DeleteRuleRequest,
  AttachRuleToDirectoryRequest,
  DetachRuleFromDirectoryRequest,
  GetDirectoryRulesRequest,
  GetApplicableRulesRequest,
  FormatRulesForPromptRequest,
} from '@shared-types';
import {
  createRule,
  getRule,
  getRules,
  updateRule,
  deleteRule,
  attachRuleToDirectory,
  detachRuleFromDirectory,
  getRuleTags,
} from '../services/rule-crud';
import {
  resolveRulesForDirectory,
  getApplicableRules,
  formatRulesForPrompt,
  getDirectoryRules,
} from '../services/rule-resolution';

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
 * Create a new rule
 */
export const createRuleEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateRuleRequest;

      logger.info('Creating rule', {
        userId,
        ruleName: data.name,
        applicableTo: data.applicableTo,
      });

      // Validate request
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Rule name is required');
      }

      if (data.name.length > 100) {
        throw new Error('Rule name cannot exceed 100 characters');
      }

      if (!data.content || data.content.trim().length === 0) {
        throw new Error('Rule content is required');
      }

      if (data.content.length > 10000) {
        throw new Error('Rule content cannot exceed 10,000 characters');
      }

      if (!data.applicableTo || data.applicableTo.length === 0) {
        throw new Error('Rule must be applicable to at least one operation type');
      }

      if (!data.color) {
        throw new Error('Rule color is required');
      }

      // Create rule
      const rule = await createRule(userId, data);

      logger.info('Rule created successfully', {
        userId,
        ruleId: rule.id,
        name: rule.name,
      });

      return {
        success: true,
        ruleId: rule.id,
        rule,
      };
    } catch (error) {
      logger.error('Failed to create rule', {
        error: error instanceof Error ? error.message : String(error),
        data: request.data,
      });
      throw new Error(
        `Failed to create rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Get a single rule by ID
 */
export const getRuleEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { ruleId } = request.data as { ruleId: string };

      if (!ruleId) {
        throw new Error('Rule ID is required');
      }

      const rule = await getRule(userId, ruleId);

      if (!rule) {
        throw new Error('Rule not found');
      }

      return {
        success: true,
        rule,
      };
    } catch (error) {
      logger.error('Failed to get rule', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Get all rules for a user
 */
export const getRulesEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);

      const rules = await getRules(userId);

      return {
        success: true,
        rules,
      };
    } catch (error) {
      logger.error('Failed to get rules', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get rules: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Update a rule
 */
export const updateRuleEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as UpdateRuleRequest;

      logger.info('Updating rule', {
        userId,
        ruleId: data.ruleId,
      });

      if (!data.ruleId) {
        throw new Error('Rule ID is required');
      }

      // Validate field updates
      if (data.name !== undefined && data.name.length > 100) {
        throw new Error('Rule name cannot exceed 100 characters');
      }

      if (data.content !== undefined && data.content.length > 10000) {
        throw new Error('Rule content cannot exceed 10,000 characters');
      }

      if (data.applicableTo !== undefined && data.applicableTo.length === 0) {
        throw new Error('Rule must be applicable to at least one operation type');
      }

      const rule = await updateRule(userId, data);

      logger.info('Rule updated successfully', {
        userId,
        ruleId: rule.id,
      });

      return {
        success: true,
        rule,
      };
    } catch (error) {
      logger.error('Failed to update rule', {
        error: error instanceof Error ? error.message : String(error),
        data: request.data,
      });
      throw new Error(
        `Failed to update rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Delete a rule (only if not attached to directories)
 */
export const deleteRuleEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as DeleteRuleRequest;

      logger.info('Deleting rule', {
        userId,
        ruleId: data.ruleId,
      });

      if (!data.ruleId) {
        throw new Error('Rule ID is required');
      }

      const result = await deleteRule(userId, data.ruleId);

      if (!result.success) {
        logger.warn('Cannot delete rule - attached to directories', {
          userId,
          ruleId: data.ruleId,
          error: result.error,
        });
        return {
          success: false,
          error: result.error,
        };
      }

      logger.info('Rule deleted successfully', {
        userId,
        ruleId: data.ruleId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to delete rule', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to delete rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Attach a rule to a directory
 */
export const attachRuleToDirectoryEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as AttachRuleToDirectoryRequest;

      logger.info('Attaching rule to directory', {
        userId,
        ruleId: data.ruleId,
        directoryId: data.directoryId,
      });

      if (!data.ruleId || !data.directoryId) {
        throw new Error('Rule ID and Directory ID are required');
      }

      await attachRuleToDirectory(userId, data.ruleId, data.directoryId);

      logger.info('Rule attached to directory successfully', {
        userId,
        ruleId: data.ruleId,
        directoryId: data.directoryId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to attach rule to directory', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to attach rule to directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Detach a rule from a directory
 */
export const detachRuleFromDirectoryEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as DetachRuleFromDirectoryRequest;

      logger.info('Detaching rule from directory', {
        userId,
        ruleId: data.ruleId,
        directoryId: data.directoryId,
      });

      if (!data.ruleId || !data.directoryId) {
        throw new Error('Rule ID and Directory ID are required');
      }

      await detachRuleFromDirectory(userId, data.ruleId, data.directoryId);

      logger.info('Rule detached from directory successfully', {
        userId,
        ruleId: data.ruleId,
        directoryId: data.directoryId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to detach rule from directory', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to detach rule from directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Get all rules for a directory (including cascading from ancestors)
 */
export const getDirectoryRulesEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetDirectoryRulesRequest;

      if (!data.directoryId) {
        throw new Error('Directory ID is required');
      }

      if (data.includeAncestors) {
        // Get cascading rules
        const { rules, inheritanceMap } = await resolveRulesForDirectory(
          userId,
          data.directoryId
        );

        return {
          success: true,
          rules,
          inheritanceMap,
        };
      } else {
        // Get only rules directly attached to this directory
        const rules = await getDirectoryRules(userId, data.directoryId);

        return {
          success: true,
          rules,
          inheritanceMap: {
            [data.directoryId]: rules,
          },
        };
      }
    } catch (error) {
      logger.error('Failed to get directory rules', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get directory rules: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Get applicable rules for a specific operation in a directory
 */
export const getApplicableRulesEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetApplicableRulesRequest;

      if (!data.directoryId || !data.operation) {
        throw new Error('Directory ID and operation type are required');
      }

      const { rules, defaultRuleIds } = await getApplicableRules(
        userId,
        data.directoryId,
        data.operation
      );

      return {
        success: true,
        rules,
        defaultRuleIds,
      };
    } catch (error) {
      logger.error('Failed to get applicable rules', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get applicable rules: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Format selected rules for AI prompt injection
 */
export const formatRulesForPromptEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as FormatRulesForPromptRequest;

      if (!data.ruleIds || !Array.isArray(data.ruleIds)) {
        throw new Error('Rule IDs array is required');
      }

      const formattedRules = await formatRulesForPrompt(userId, data.ruleIds);

      return {
        success: true,
        formattedRules,
      };
    } catch (error) {
      logger.error('Failed to format rules for prompt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to format rules for prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

/**
 * Get all unique tags used by a user's rules
 */
export const getRuleTagsEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);

      const tags = await getRuleTags(userId);

      return {
        success: true,
        tags,
      };
    } catch (error) {
      logger.error('Failed to get rule tags', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get rule tags: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
