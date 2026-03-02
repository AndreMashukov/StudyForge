import * as fs from 'fs';
import * as path from 'path';

const backupPath = 'backups/firestore-backup-with-docs/collections/users.json';
const oldUserId = 'fkJUAbAapgRx1HKnP7lr68M9sTM2';
const newUserId = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';

// Read the backup file
const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

// Update the user ID
function updateUserId(obj) {
  if (typeof obj === 'string') {
    return obj.replace(new RegExp(oldUserId, 'g'), newUserId);
  } else if (Array.isArray(obj)) {
    return obj.map(updateUserId);
  } else if (typeof obj === 'object' && obj !== null) {
    const updated = {};
    for (const key in obj) {
      const newKey = key.replace(new RegExp(oldUserId, 'g'), newUserId);
      updated[newKey] = updateUserId(obj[key]);
    }
    return updated;
  }
  return obj;
}

const updated = updateUserId(data);

// Write back
fs.writeFileSync(backupPath, JSON.stringify(updated, null, 2));

console.log('✅ Updated user IDs in backup from', oldUserId, 'to', newUserId);
