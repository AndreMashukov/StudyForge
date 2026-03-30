const admin = require('firebase-admin');
const http = require('http');

admin.initializeApp({ projectId: 'code-insights-quiz-ai' });

function callApi(fnName, data, idToken) {
  const postData = JSON.stringify({ data });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5001,
      path: '/code-insights-quiz-ai/asia-east1/' + fnName,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + idToken,
        'Content-Length': postData.length
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const customToken = await admin.auth().createCustomToken('VRdMPh0JjhaplKZeVigSD91mSXib');
  console.log('Custom token created');

  const postData = JSON.stringify({ token: customToken, returnSecureToken: true });
  const idToken = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 9099,
      path: '/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=code-insights-quiz-ai',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).idToken));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  console.log('Got ID token, length:', idToken.length);

  // Test getDirectory
  console.log('\n--- Testing getDirectory ---');
  const dirRes = await callApi('getDirectory', { directoryId: 'test-dir-1' }, idToken);
  if (dirRes.result) {
    console.log('Directory:', dirRes.result.directory?.name);
  } else if (dirRes.error) {
    console.log('Error:', JSON.stringify(dirRes.error));
  }

  // Test getDirectoryContentsWithArtifacts
  console.log('\n--- Testing getDirectoryContentsWithArtifacts ---');
  const contentsRes = await callApi('getDirectoryContentsWithArtifacts', {
    directoryId: 'test-dir-1', includeArtifacts: true, includeRules: true, artifactLimit: 20
  }, idToken);
  if (contentsRes.result) {
    const r = contentsRes.result;
    console.log('Directory:', r.directory?.name);
    console.log('Subdirs:', r.subdirectories?.length);
    console.log('Documents:', r.documents?.length);
    console.log('Quizzes:', r.quizzes?.length);
    console.log('FlashcardSets:', r.flashcardSets?.length);
    console.log('SlideDecks:', r.slideDecks?.length);
    console.log('ResolvedRules:', r.resolvedRules?.rules?.length);
  } else if (contentsRes.error) {
    console.log('Error:', JSON.stringify(contentsRes.error));
  }

  // Test getDirectoryAncestors
  console.log('\n--- Testing getDirectoryAncestors ---');
  const ancRes = await callApi('getDirectoryAncestors', { directoryId: 'test-dir-1' }, idToken);
  if (ancRes.result) {
    console.log('Ancestors:', ancRes.result.ancestors?.length);
  } else if (ancRes.error) {
    console.log('Error:', JSON.stringify(ancRes.error));
  }
}

main().catch(e => console.error('FAIL:', e.message));
