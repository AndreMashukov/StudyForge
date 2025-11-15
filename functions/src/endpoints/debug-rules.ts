import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { Rule } from '@shared-types';

const db = getFirestore();

/**
 * Validate authentication and return user ID
 */
async function validateAuth(request: CallableRequest): Promise<string> {
  if (!request.auth) {
    throw new Error('Authentication required');
  }
  return request.auth.uid;
}

/**
 * Debug endpoint to diagnose rule attachment issues
 * This endpoint helps identify if rules are accidentally attached to wrong directories
 */
export const debugDirectoryRules = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { directoryId } = request.data as { directoryId: string };

      if (!directoryId) {
        throw new Error('Directory ID is required');
      }

      logger.info('Debug: Analyzing directory rules', { userId, directoryId });

      // Get the directory
      const dirDoc = await db.collection('directories').doc(directoryId).get();
      
      if (!dirDoc.exists) {
        throw new Error('Directory not found');
      }

      const dirData = dirDoc.data();
      
      if (dirData?.userId !== userId) {
        throw new Error('Access denied');
      }

      // Get all rules for this user
      const rulesSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('rules')
        .get();

      const allRules: Rule[] = rulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as Rule));

      // Find rules that claim to be attached to this directory
      const rulesClaimingAttachment = allRules.filter(rule => 
        (rule.directoryIds || []).includes(directoryId)
      );

      // Get the directory's ruleIds array
      const directoryRuleIds = dirData?.ruleIds || [];

      // Find mismatches
      const rulesInDirButNotInRule = directoryRuleIds.filter(
        (ruleId: string) => !rulesClaimingAttachment.some(r => r.id === ruleId)
      );

      const rulesInRuleButNotInDir = rulesClaimingAttachment.filter(
        rule => !directoryRuleIds.includes(rule.id)
      );

      // Get parent directory chain
      const ancestors = [];
      let currentParentId = dirData?.parentId;
      
      while (currentParentId) {
        const parentDoc = await db.collection('directories').doc(currentParentId).get();
        if (!parentDoc.exists) break;
        
        const parentData = parentDoc.data();
        ancestors.push({
          id: parentDoc.id,
          name: parentData?.name,
          path: parentData?.path,
          ruleIds: parentData?.ruleIds || [],
        });
        
        currentParentId = parentData?.parentId;
      }

      const report = {
        directory: {
          id: dirDoc.id,
          name: dirData?.name,
          path: dirData?.path,
          parentId: dirData?.parentId,
          ruleIds: directoryRuleIds,
        },
        ancestors: ancestors.reverse(),
        rulesAttachedToDirectory: rulesClaimingAttachment.map(r => ({
          id: r.id,
          name: r.name,
          directoryIds: r.directoryIds,
        })),
        inconsistencies: {
          rulesInDirButNotInRule: rulesInDirButNotInRule.map((id: string) => {
            const rule = allRules.find(r => r.id === id);
            return {
              ruleId: id,
              ruleName: rule?.name || 'Unknown',
              directoryIds: rule?.directoryIds || [],
            };
          }),
          rulesInRuleButNotInDir: rulesInRuleButNotInDir.map(r => ({
            ruleId: r.id,
            ruleName: r.name,
            directoryIds: r.directoryIds,
          })),
        },
        totalInconsistencies: rulesInDirButNotInRule.length + rulesInRuleButNotInDir.length,
      };

      logger.info('Debug report generated', { 
        directoryId, 
        inconsistencies: report.totalInconsistencies 
      });

      return {
        success: true,
        report,
      };
    } catch (error) {
      logger.error('Debug failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
