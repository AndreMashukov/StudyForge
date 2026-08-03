function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert simple markdown seed content into a wrapped HTML document for Storage.
 */
export function markdownToHtmlDocument(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const bodyParts: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      bodyParts.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('# ')) {
      closeList();
      bodyParts.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      bodyParts.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      bodyParts.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        bodyParts.push('<ul>');
        inList = true;
      }
      bodyParts.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
      continue;
    }

    if (line.trim() === '') {
      closeList();
      continue;
    }

    closeList();
    bodyParts.push(`<p>${escapeHtml(line.trim())}</p>`);
  }

  closeList();

  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`;
}

export function buildHtmlStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.html`;
}

export function buildHtmlStorageUrl(
  userId: string,
  documentId: string,
  storageHost: string,
  bucket: string
): string {
  const encodedPath = `users%2F${encodeURIComponent(userId)}%2Fdocuments%2F${documentId}%2Fcontent.html`;
  return `http://${storageHost}/v0/b/${bucket}/o/${encodedPath}?alt=media`;
}
