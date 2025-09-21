# Firebase Storage Integration Plan

## 📋 Overview
Design Firebase Storage integration for storing markdown documents with proper security rules, file organization, and access patterns.

## 🗂️ Storage Structure
```
/users/{userId}/documents/{documentId}/
├── content.md          # The actual markdown content
├── metadata.json       # Document metadata (optional, can be stored in Firestore)
└── versions/           # Future: version history (not in Phase 1)
    ├── v1.md
    ├── v2.md
    └── ...
```

## 🔒 Security Rules

### Storage Rules (storage.rules)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own documents
    match /users/{userId}/documents/{documentId}/{fileName} {
      allow read, write: if request.auth != null 
                      && request.auth.uid == userId;
    }
    
    // Additional validation for uploads
    match /users/{userId}/documents/{documentId}/content.md {
      allow write: if request.auth != null 
                  && request.auth.uid == userId
                  && validateMarkdownFile(request.resource);
    }
  }
}

// Validation function for markdown files
function validateMarkdownFile(resource) {
  return resource.size < 100 * 1024 // 100KB max size
      && resource.contentType == 'text/markdown'
      && resource.name.matches('.*\\.md$');
}
```

## 🏗️ Firebase Functions Integration

### Document Service (New)
```typescript
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

export class DocumentService {
  private static storage = getStorage();
  private static db = getFirestore();

  // Upload markdown content to Storage
  static async uploadDocument(
    userId: string, 
    documentId: string, 
    content: string,
    metadata: DocumentMetadata
  ): Promise<StorageFile> {
    const bucket = this.storage.bucket();
    const filePath = `users/${userId}/documents/${documentId}/content.md`;
    const file = bucket.file(filePath);

    // Upload the markdown content
    await file.save(content, {
      metadata: {
        contentType: 'text/markdown',
        cacheControl: 'public, max-age=3600',
        customMetadata: {
          documentId,
          title: metadata.title,
          sourceType: metadata.sourceType,
          wordCount: metadata.wordCount.toString(),
          createdAt: metadata.createdAt.toISOString(),
        }
      }
    });

    // Generate signed URL for download
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    return {
      path: filePath,
      downloadUrl,
      metadata: {
        contentType: 'text/markdown',
        size: Buffer.byteLength(content, 'utf8'),
        timeCreated: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    };
  }

  // Get document content from Storage
  static async getDocumentContent(
    userId: string, 
    documentId: string
  ): Promise<string> {
    const bucket = this.storage.bucket();
    const filePath = `users/${userId}/documents/${documentId}/content.md`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Document not found in storage');
    }

    const [content] = await file.download();
    return content.toString('utf8');
  }

  // Delete document from Storage
  static async deleteDocument(
    userId: string, 
    documentId: string
  ): Promise<void> {
    const bucket = this.storage.bucket();
    const filePath = `users/${userId}/documents/${documentId}/content.md`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }
  }

  // Generate download URL for document
  static async getDownloadUrl(
    userId: string, 
    documentId: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    const bucket = this.storage.bucket();
    const filePath = `users/${userId}/documents/${documentId}/content.md`;
    const file = bucket.file(filePath);

    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000
    });

    return downloadUrl;
  }
}
```

## 🔧 Storage Configuration

### Environment Variables
```bash
# Firebase Storage bucket name
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Optional: Custom storage bucket for documents
FIREBASE_DOCUMENTS_BUCKET=your-project-documents.appspot.com
```

### Firebase Config (firebase.json)
```json
{
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

## 📊 File Organization Best Practices

### Path Structure
- **Predictable**: `/users/{userId}/documents/{documentId}/content.md`
- **Scalable**: Easy to implement permissions and cleanup
- **Secure**: User isolation built into the path structure

### Naming Conventions
- **Document ID**: UUID v4 generated by Firestore
- **File Extension**: Always `.md` for consistency
- **Content File**: Always named `content.md`

### Metadata Storage Strategy
1. **Firestore**: Store document metadata (title, wordCount, createdAt, etc.)
2. **Storage Metadata**: Store minimal technical metadata (contentType, size)
3. **Custom Metadata**: Store document-specific data in Storage custom metadata

## 🚀 Implementation Steps

### Phase 1: Basic Storage Setup
1. ✅ Define storage rules
2. ✅ Create DocumentService class
3. ✅ Implement upload/download methods
4. ⏳ Test with Firebase Functions
5. ⏳ Add error handling and validation

### Phase 2: Advanced Features
1. File validation (size, type, content)
2. Batch operations for multiple documents
3. Storage usage monitoring and quotas
4. Cleanup of orphaned files

### Phase 3: Optimization
1. CDN integration for faster downloads
2. Compression for large documents
3. Caching strategies
4. Performance monitoring

## 🔍 Security Considerations

### Access Control
- **User Isolation**: Users can only access their own documents
- **Authentication Required**: All operations require valid Firebase Auth token
- **Time-limited URLs**: Download URLs expire after reasonable time

### Content Validation
- **File Size**: Maximum 100KB per document
- **File Type**: Only text/markdown content allowed
- **Content Sanitization**: Remove potentially harmful content

### Data Protection
- **Encryption**: Firebase Storage provides encryption at rest and in transit
- **Backup Strategy**: Firestore backup includes document references
- **GDPR Compliance**: Easy user data deletion with path-based organization

## 📈 Monitoring and Quotas

### Storage Quotas
- **Free Tier**: 5GB storage, 1GB/day download
- **Paid Tier**: $0.026/GB-month storage, $0.12/GB download

### Monitoring
- Track storage usage per user
- Monitor download patterns
- Alert on quota approaching limits

### Cost Optimization
- Use appropriate cache headers
- Implement cleanup for unused documents
- Monitor and optimize file sizes

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('DocumentService', () => {
  it('should upload document to correct path', async () => {
    const userId = 'test-user-id';
    const documentId = 'test-doc-id';
    const content = '# Test Document\n\nThis is a test.';
    
    const result = await DocumentService.uploadDocument(userId, documentId, content, metadata);
    
    expect(result.path).toBe(`users/${userId}/documents/${documentId}/content.md`);
    expect(result.downloadUrl).toBeDefined();
  });
});
```

### Integration Tests
- Test with Firebase Auth
- Test storage rules enforcement
- Test file upload/download flow
- Test error scenarios (file not found, permission denied)

## 🔗 Integration Points

### With Firestore
- Document metadata stored in `/documents/{documentId}`
- Storage URL stored as `storageUrl` field
- Consistent document ID across services

### With Firebase Functions
- Upload handling in `uploadDocument` function
- Download URL generation in `getDocument` function
- Cleanup in `deleteDocument` function

### With Frontend
- File upload via signed URLs or direct Functions call
- Document viewing via download URLs
- Real-time updates via Firestore listeners

This comprehensive Firebase Storage integration ensures secure, scalable, and efficient document storage for the document-centric architecture.