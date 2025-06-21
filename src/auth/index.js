// index.js
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyFilePath = path.join(__dirname, 'config', 'google-service-key.json');

const auth = new GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getFactCheckResults(query) {
  try {
    const client = await auth.getClient();

    const factCheckTools = google.factchecktools({
      version: 'v1alpha1',
      auth: client,
    });

    const res = await factCheckTools.claims.search({
      query: query,
      languageCode: 'en-US',
      pageSize: 5,
    });

    console.log('Results:', res.data.claims || []);
  } catch (error) {
    console.error('❌ Error fetching fact check:', error.message);
  }
}

getFactCheckResults('moon landing');
