# Firebase Backup Scripts

This directory contains scripts for backing up Firebase Authentication users and Firestore database data.

## Overview

The backup system consists of several main scripts:

1. **`backup-firebase-auth.ts`** - Backs up Firebase Authentication users
2. **`backup-firestore.ts`** - Backs up Firestore database collections and documents
3. **`backup-firebase.ts`** - Complete backup script that runs both auth and firestore backups
4. **`clear-firestore.ts`** - ⚠️ Clears all data from Firestore (use with caution!)

## Prerequisites

1. **Firebase Admin SDK Setup**: Ensure Firebase Admin SDK is properly initialized with credentials
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to your service account key file, OR
   - Use Application Default Credentials (ADC) if running on Google Cloud

2. **Dependencies**: Install required packages
   ```bash
   yarn add -D tsx
   ```

3. **Firebase Project Access**: Ensure you have proper permissions to:
   - List and read Firebase Authentication users
   - Read Firestore database collections and documents

## Quick Start

**Two Simple Commands:**

```bash
# Backup everything (Auth users + Firestore + Rules)
yarn backup:all

# Restore everything from the latest backup
yarn restore:latest
```

That's it! These two commands handle all your Firebase backup and restore needs.

## Usage

### Backup Everything

```bash
# Backup all Firebase data (Auth users, Firestore, Rules)
yarn backup:all

# Or directly with tsx
npx tsx scripts/backup-firebase.ts [output-dir]
```

This creates a complete backup with:
- Firebase Authentication users
- Firestore database (all collections and documents)
- Firebase Security Rules (Firestore and Storage)

### Restore Latest Backup

```bash
# Restore everything from the most recent backup
yarn restore:latest

# Dry run first (recommended)
yarn restore:latest --dry-run

# List all available backups
yarn restore:latest --list
```

This automatically:
- Finds the backup with the latest timestamp
- Restores Authentication users
- Restores Firestore database
- Restores Security Rules

## Advanced Usage

If you need more control, you can run the individual scripts directly:

### Individual Backup Scripts

```bash
# Backup only Authentication users
npx tsx scripts/backup-firebase-auth.ts [output-dir]

# Backup only Firestore database
npx tsx scripts/backup-firestore.ts [output-dir]

# Backup only Security Rules
npx tsx scripts/backup-firebase-rules.ts [output-dir]
```

### Individual Restore Scripts

```bash
# Restore from a specific backup directory
npx tsx scripts/restore-firebase.ts <backup-directory-path> [--dry-run]

# Restore only Authentication users
npx tsx scripts/restore-firebase-auth.ts <backup-file-path> [--dry-run]

# Restore only Firestore database
npx tsx scripts/restore-firestore.ts <backup-directory-path> [--dry-run]

# Restore only Security Rules
npx tsx scripts/restore-firebase-rules.ts <backup-directory-path> [--dry-run]
```

## Backup Structure

### Complete Backup Structure

```
backups/
└── firebase-backup-YYYY-MM-DD_HH-MM-SS/
    ├── backup-report.json          # Complete backup metadata
    ├── auth/
    │   ├── metadata.json           # Auth backup metadata
    │   └── users.json              # All authentication users
    ├── firestore/
    │   ├── metadata.json           # Firestore backup metadata
    │   ├── statistics.json         # Collection statistics
    │   └── collections/
    │       ├── collection1.json   # Collection documents
    │       ├── collection2.json
    │       └── ...
    └── rules/
        ├── firestore.rules         # Firestore security rules
        └── storage.rules           # Storage security rules
```

### Authentication Backup Format

The `users.json` file contains an array of user objects with the following structure:

```json
[
  {
    "uid": "user-id",
    "email": "user@example.com",
    "emailVerified": true,
    "displayName": "User Name",
    "photoURL": "https://...",
    "phoneNumber": "+1234567890",
    "disabled": false,
    "metadata": {
      "creationTime": "2024-01-01T00:00:00.000Z",
      "lastSignInTime": "2024-01-02T00:00:00.000Z",
      "lastRefreshTime": "2024-01-02T00:00:00.000Z"
    },
    "customClaims": {
      "role": "admin"
    },
    "providerData": [
      {
        "uid": "provider-uid",
        "email": "user@example.com",
        "displayName": "User Name",
        "providerId": "password",
        "photoURL": null,
        "phoneNumber": null
      }
    ]
  }
]
```

**Note**: Password hashes are not included in the backup as they cannot be retrieved via the Admin SDK. To backup password hashes, use the Firebase CLI command:
```bash
firebase auth:export users.json --format=json
```

### Firestore Backup Format

Each collection is saved as a JSON file containing an array of documents:

```json
[
  {
    "id": "document-id",
    "data": {
      "field1": "value1",
      "field2": 123,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "geopoint": {
        "_type": "geopoint",
        "latitude": 37.7749,
        "longitude": -122.4194
      },
      "reference": {
        "_type": "reference",
        "path": "collection/document-id",
        "id": "document-id"
      }
    },
    "createTime": "2024-01-01T00:00:00.000Z",
    "updateTime": "2024-01-02T00:00:00.000Z",
    "subcollections": {
      "subcollection-name": [
        {
          "id": "sub-doc-id",
          "data": { ... }
        }
      ]
    }
  }
]
```

## Features

### Authentication Backup Features

- ✅ Exports all users with pagination support
- ✅ Includes user metadata (creation time, last sign-in, etc.)
- ✅ Preserves custom claims
- ✅ Includes provider data (email, Google, Facebook, etc.)
- ✅ Handles disabled users
- ✅ Generates backup statistics

### Firestore Backup Features

- ✅ Recursively exports all collections and subcollections
- ✅ Preserves document structure and metadata
- ✅ Converts Firestore Timestamps to ISO strings
- ✅ Handles GeoPoints and DocumentReferences
- ✅ Processes documents in batches to avoid memory issues
- ✅ Generates collection statistics
- ✅ Creates organized directory structure

## Environment Setup

### Option 1: Service Account Key File

1. Download your Firebase service account key from Firebase Console
2. Set the environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

### Option 2: Application Default Credentials (ADC)

If running on Google Cloud or with `gcloud` CLI configured:

```bash
gcloud auth application-default login
```

## Restoring Backups

This project includes restore scripts that can restore Firebase Authentication users, Firestore data, and Security Rules from backups.

### Restore Latest Backup (Recommended)

Automatically finds and restores the most recent backup:

```bash
# Restore the latest backup
yarn restore:latest

# Dry run first (recommended)
yarn restore:latest --dry-run

# List all available backups
yarn restore:latest --list
```

This is the quickest way to restore - it automatically finds the backup with the latest timestamp and restores:
- Authentication users
- Firestore database
- Security Rules

### Restore from Specific Backup Directory

Restores from a specific backup directory:

```bash
# Restore from a specific backup
npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00

# Dry run (preview what would be restored)
npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00 --dry-run
```

### Restoring Individual Components

**Authentication Users Only:**

```bash
npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json

# Dry run
npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json --dry-run
```

**Important Notes:**
- Password hashes are **not** included in backups (Firebase Admin SDK limitation)
- Users will need to reset passwords or use passwordless authentication after restore
- Email verification status is preserved
- Custom claims are restored automatically

**Firestore Database Only:**

```bash
npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore

# Dry run
npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore --dry-run
```

**Security Rules Only:**

```bash
npx tsx scripts/restore-firebase-rules.ts backups/firebase-backup-2024-01-01_12-00-00
```

**Features:**
- Automatically converts ISO timestamps back to Firestore Timestamps
- Restores GeoPoints and DocumentReferences
- Recursively restores subcollections
- Uses batch writes for efficiency
- Preserves document structure and metadata

### Restore Process

1. **Dry Run First**: Always test with `--dry-run` to preview what will be restored
2. **Start Emulators**: Make sure Firebase emulators are running (for emulator restore)
3. **Run Restore**: Execute the restore script with the backup directory path
4. **Verify**: Check the restore report and verify data in Firebase console/emulator UI

### Restore Report

After restoration, a `restore-report.json` file is created in the backup directory with:
- Timestamp of restore
- Number of users restored
- Number of collections and documents restored
- Success/failure status for each operation

### Alternative: Firebase CLI Import

For Authentication users, you can also use Firebase CLI:

```bash
firebase auth:import users.json --format=json
```

However, the restore scripts provide more features:
- Better error handling
- Progress reporting
- Dry run mode
- Custom claims restoration
- Batch processing

## Best Practices

1. **Regular Backups**: Schedule regular backups (daily/weekly) using cron jobs or CI/CD pipelines
2. **Secure Storage**: Store backups in secure, encrypted locations
3. **Version Control**: Keep multiple backup versions for disaster recovery
4. **Test Restores**: Periodically test restore procedures to ensure backups are valid
5. **Monitor Size**: Large databases may take significant time and storage space

## Troubleshooting

### Error: "Firebase Admin SDK not initialized"

Ensure Firebase Admin SDK is properly initialized. The scripts will auto-initialize, but you need valid credentials.

### Error: "Permission denied"

Check that your service account has the following IAM roles:
- `Firebase Admin SDK Administrator Service Agent`
- `Cloud Datastore User`
- `Firebase Authentication Admin`

### Error: "Out of memory"

For very large databases, consider:
- Backing up collections individually
- Using the Firebase CLI export command for Firestore: `gcloud firestore export gs://bucket-name`
- Increasing Node.js memory limit: `node --max-old-space-size=4096 scripts/backup-firestore.ts`

## Alternative: Firebase CLI Export

For production environments, consider using Firebase CLI commands:

### Export Authentication Users
```bash
firebase auth:export users.json --format=json
```

### Export Firestore Database
```bash
gcloud firestore export gs://your-bucket-name
```

These CLI commands are more efficient for very large datasets and can be automated with Cloud Functions or Cloud Scheduler.

## Clearing Firestore Database

⚠️ **WARNING: This operation is DESTRUCTIVE and will DELETE ALL DATA from Firestore!**

The `clear-firestore.ts` script provides a safe way to clear all data from your Firestore database. This is useful for:
- Resetting test/development environments
- Starting fresh after migration
- Cleaning up before restoring from a backup

### Safety Features

The clear script includes multiple safety mechanisms:
- **Confirmation prompt**: Requires typing "DELETE ALL DATA" to confirm
- **Dry run mode**: Preview what will be deleted without actually deleting
- **Force mode**: Skip confirmation for automation (use with extreme caution)
- **Detailed logging**: See exactly what is being deleted

### Usage

**Dry Run (Safe - Just Preview):**
```bash
npx tsx scripts/clear-firestore.ts --dry-run
```

**Clear with Confirmation Prompt (Recommended):**
```bash
npx tsx scripts/clear-firestore.ts
```

You will be prompted:
```
⚠️  ========================================
⚠️  WARNING: DESTRUCTIVE OPERATION
⚠️  ========================================
⚠️  You are about to DELETE ALL DATA from Firestore!
⚠️  Project ID: your-project-id
⚠️  This action CANNOT be undone!
⚠️  ========================================

Are you absolutely sure you want to continue? Type "DELETE ALL DATA" to confirm:
```

**Force Mode (No Confirmation - Dangerous!):**
```bash
npx tsx scripts/clear-firestore.ts --force
```

**Help:**
```bash
npx tsx scripts/clear-firestore.ts --help
```

### What Gets Deleted

The script recursively deletes:
- ✅ All top-level collections
- ✅ All documents in each collection
- ✅ All subcollections and their documents
- ✅ Everything from Firestore database

### Best Practices

1. **Always create a backup first:**
   ```bash
   # Create backup before clearing
   npx tsx scripts/backup-firestore.ts
   
   # Then clear
   npx tsx scripts/clear-firestore.ts
   ```

2. **Use dry run first:**
   ```bash
   # Preview what will be deleted
   npx tsx scripts/clear-firestore.ts --dry-run
   
   # Review the output, then proceed
   npx tsx scripts/clear-firestore.ts
   ```

3. **For production environments:**
   - Always backup first
   - Use the confirmation prompt (never use --force)
   - Consider using Firestore emulator for testing
   - Verify you're connected to the correct project

4. **For CI/CD automation:**
   ```bash
   # Use force mode only in non-production environments
   if [ "$ENVIRONMENT" != "production" ]; then
     npx tsx scripts/clear-firestore.ts --force
   fi
   ```

### Clear Summary

After completion, you'll see a summary like:
```
✅ CLEAR COMPLETED SUCCESSFULLY
   📚 Collections deleted: 5
   📄 Total documents deleted: 1,234
   📁 Subcollections deleted: 89

📊 Collection Statistics:
   users: 456 documents, 12 subcollections
   posts: 678 documents, 45 subcollections
   ...

⚠️  All data has been permanently deleted from Firestore!

💡 Tip: Always create a backup before clearing data:
   npx tsx scripts/backup-firestore.ts
```

### Environment Variables

The script respects the same environment variables as other Firebase scripts:

**For Production:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

**For Emulator:**
```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
export GCLOUD_PROJECT=your-project-id
```

### Troubleshooting

**Error: "Permission denied"**
- Ensure your service account has Firestore delete permissions
- Required IAM role: `Cloud Datastore User` or `Firestore Admin`

**Timeout or slow deletion:**
- For very large databases, the script processes documents in batches of 500
- Consider using Firestore batch operations or Cloud Functions for massive deletions
- Alternative: `gcloud firestore databases delete --database=(default)`

**Want to delete only specific collections:**
- Modify the script or use Firebase Console
- Use Firestore delete collection functionality
- Write a custom script targeting specific collections

## License

MIT

