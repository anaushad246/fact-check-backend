import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import vision from '@google-cloud/vision';
import { google } from 'googleapis';
import AIService from '../services/ai.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// -- NEW: Configure credentials for Google Vision --
let visionClientOptions = {};
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    visionClientOptions.credentials = credentials;
  } catch (e) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY. Is it a valid JSON string?", e);
  }
} else if (process.env.NODE_ENV !== 'production') {
  // Fallback to key file only for local development
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'google-key.json';
  console.log(`Using Google Vision key file for local dev: ${keyFilePath}`);
  visionClientOptions.keyFilename = keyFilePath;
}

// Initialize Google Vision client
const visionClient = new vision.ImageAnnotatorClient(visionClientOptions);

// Analyze image with Vision API
async function analyzeImage(imagePath) {
  try {
    console.log('Reading image file from:', imagePath);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    console.log('Image read successfully, size:', imageBuffer.length);

    console.log('Sending request to Google Vision API...');
    const [result] = await visionClient.annotateImage({
      image: { content: base64Image },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'TEXT_DETECTION' },
        { type: 'WEB_DETECTION', maxResults: 10 }
      ]
    });
    console.log('Vision API response received');

    return result;
  } catch (error) {
    console.error('Error in analyzeImage:', error);
    if (error.code === 'ENOENT') {
      throw new Error('Image file not found. Please check file path and permissions.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Could not connect to Google Vision API. Please check your internet connection and API credentials.');
    }
    throw error;
  }
}

// Fact-check extracted content using Fact Check Tools API
async function factCheckImage(imageAnalysis) {
  try {
    console.log('Starting fact check for image analysis...');
    const factchecktools = google.factchecktools({
      version: 'v1alpha1',
      auth: GOOGLE_API_KEY
    });

    const text = imageAnalysis.textAnnotations?.[0]?.description || '';
    const labels = imageAnalysis.labelAnnotations || [];

    const labelDescriptions = labels.map(label => label.description).join(' ');
    const searchQuery = `${text} ${labelDescriptions}`.trim();

    if (!searchQuery) {
      throw new Error('No meaningful text or labels found in image.');
    }

    console.log('Searching fact check with query:', searchQuery);
    const response = await factchecktools.claims.search({
      query: searchQuery,
      languageCode: 'en-US'
    });
    console.log('Fact check results received');

    return {
      imageAnalysis: {
        text,
        labels: labels.map(label => ({
          description: label.description,
          confidence: label.score
        }))
      },
      factCheckResults: response.data
    };
  } catch (error) {
    console.error('Error in factCheckImage:', error);
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API Key not configured. Please set GOOGLE_API_KEY environment variable.');
    }
    throw error;
  }
}

// Controller to handle image upload + fact check
export async function handleImageUpload(req, res) {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('File received:', req.file);
    filePath = req.file.path;

    const analysis = await analyzeImage(filePath);
    const result = await factCheckImage(analysis);
    const claims = result.factCheckResults.claims || [];

    // Generate an AI summary based on the fact-check results.
    const aiSummary = await AIService.generateSummary(claims);

    // --- NORMALIZED RESPONSE ---
    // This structure now matches the text-based fact-check response.
    const normalizedResponse = {
      summary: {
        text: aiSummary.overview,
        labels: result.imageAnalysis.labels.map(l => l.description),
        claimReviewCount: claims.length,
        consensus: aiSummary.consensus,
        conclusion: aiSummary.conclusion,
      },
      data: {
        factCheckResults: claims,
        initialClaimAnalysis: `Image contained text: "${result.imageAnalysis.text || 'N/A'}" and labels like: ${result.imageAnalysis.labels.map(l => l.description).join(', ')}.`,
        initialClaimCategorization: `Image labels: ${result.imageAnalysis.labels.map(l => l.description).join(', ')}`,
      },
    };

    res.json(normalizedResponse);

  } catch (error) {
    console.error('Error during image fact check:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up successfully');
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
  }
}
