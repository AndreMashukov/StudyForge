# Firebase Backup Scripts

This directory contains scripts for backing up Firebase Authentication users and Firestore database data.

## Overview

The backup system consists of three main scripts:

1. **`backup-firebase-auth.ts`** - Backs up Firebase Authentication users
2. **`backup-firestore.ts`** - Backs up Firestore database collections and documents
3. **`backup-firebase.ts`** - Complete backup script that runs both auth and firestore backups

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

## Usage

### Complete Backup (Recommended)

Backs up both Authentication users and Firestore database:

```bash
# Using npm script
yarn backup:firebase

# Or directly with tsx
npx tsx scripts/backup-firebase.ts

# With custom output directory
npx tsx scripts/backup-firebase.ts ./my-backup-dir
```

### Authentication Users Only

```bash
# Using npm script
yarn backup:auth

# Or directly
npx tsx scripts/backup-firebase-auth.ts [output-dir]
```

### Firestore Database Only

```bash
# Using npm script
yarn backup:firestore

# Or directly
npx tsx scripts/backup-firestore.ts [output-dir]
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
    └── firestore/
        ├── metadata.json           # Firestore backup metadata
        ├── statistics.json         # Collection statistics
        └── collections/
            ├── collection1.json   # Collection documents
            ├── collection2.json
            └── ...
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

This project includes restore scripts that can restore Firebase Authentication users and Firestore data from backups.

### Restore Latest Backup (Quick Restore)

Automatically finds and restores the most recent backup:

```bash
# Restore the latest backup
yarn restore:latest

# Dry run first (recommended)
yarn restore:latest --dry-run

# List all available backups
yarn restore:latest --list
```

This is the quickest way to restore - it automatically finds the backup with the latest timestamp and restores it.

### Complete Restore (Recommended)

Restores both Authentication users and Firestore database:

```bash
# Using npm script
yarn restore:firebase <backup-directory-path>

# Or directly with tsx
npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00

# Dry run (preview what would be restored)
npx tsx scripts/restore-firebase.ts backups/firebase-backup-2024-01-01_12-00-00 --dry-run
```

### Restoring Authentication Users Only

```bash
# Using npm script
yarn restore:auth <backup-file-path>

# Or directly
npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json

# Dry run
npx tsx scripts/restore-firebase-auth.ts backups/firebase-backup-2024-01-01_12-00-00/auth/users.json --dry-run
```

**Important Notes:**
- Password hashes are **not** included in backups (Firebase Admin SDK limitation)
- Users will need to reset passwords or use passwordless authentication after restore
- Email verification status is preserved
- Custom claims are restored automatically

### Restoring Firestore Database Only

```bash
# Using npm script
yarn restore:firestore <backup-directory-path>

# Or directly
npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore

# Dry run
npx tsx scripts/restore-firestore.ts backups/firebase-backup-2024-01-01_12-00-00/firestore --dry-run
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

## License

MIT

