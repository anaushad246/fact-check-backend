import { google } from 'googleapis';
import dotenv from 'dotenv';
import AIService from '../services/ai.service.js';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function searchFactChecks(content) {
  if (!GOOGLE_API_KEY) {
    throw new Error("Google API Key not set. Please configure GOOGLE_API_KEY in .env");
  }

  try {
    // Step 1: Initial AI analysis (run concurrently)
    const aiAnalysisPromise = AIService.analyzeClaim(content);
    const aiCategorizationPromise = AIService.categorizeClaim(content);

    // Step 2: Query Google Fact Check API
    const factchecktools = google.factchecktools({
      version: 'v1alpha1',
      auth: GOOGLE_API_KEY,
    });
    const response = await factchecktools.claims.search({
      query: content,
      languageCode: 'en-US',
    });
    const claims = response.data.claims || [];

    // Step 3: Summarize the Fact Check Results (with Gemini)
    const aiSummaryPromise = AIService.generateSummary(claims);

    // Await all AI promises concurrently
    const [aiAnalysis, aiCategorization, aiSummary] = await Promise.all([
      aiAnalysisPromise,
      aiCategorizationPromise,
      aiSummaryPromise,
    ]);

    // Step 4: Structure and Return the Final Response
    const enhancedResults = {
      summary: {
        text: aiSummary.overview,
        consensus: aiSummary.consensus,
        conclusion: aiSummary.conclusion,
        labels: aiCategorization.categories || [],
        claimReviewCount: claims.length,
      },
      data: {
        initialClaimAnalysis: aiAnalysis,
        initialClaimCategorization: aiCategorization.message,
        factCheckResults: claims,
      },
    };

    // console.log('Sending enhanced results:', JSON.stringify(enhancedResults, null, 2));
    return enhancedResults;

  } catch (error) {
    console.error("Error in fact check process:", error.message);

    if (error.code === 404 && error.message.includes("API not found")) {
      console.error("Check if the API is enabled in your Google Cloud console.");
    } else if (error.message.includes("Failed to discover API")) {
      console.error("Check internet connectivity and Google API service status.");
    }

    throw new Error("Failed to process fact check request.");
  }
}

async function getFactCheckArticles(query = '', category = '', page = 1, limit = 20) {
  if (!GOOGLE_API_KEY) {
    throw new Error("Google API Key not set. Please configure GOOGLE_API_KEY in .env");
  }

  try {
    const factchecktools = google.factchecktools({
      version: 'v1alpha1',
      auth: GOOGLE_API_KEY,
    });

    // Build search query
    let searchQuery = query;
    if (category && category !== 'all') {
      searchQuery = `${category} ${query}`.trim();
    }

    // Search for fact-check claims
    const response = await factchecktools.claims.search({
      query: searchQuery || 'fact check news',
      languageCode: 'en-US',
      maxAgeDays: 365, // Get articles from the last year
      pageSize: limit,
      pageToken: page > 1 ? `page-${page}` : undefined,
    });

    const claims = response.data.claims || [];
    const nextPageToken = response.data.nextPageToken;

    // Transform claims into blog article format
    const articles = claims.map((claim, index) => {
      // Get the first review for verdict
      const firstReview = claim.claimReview?.[0];
      const verdict = firstReview?.textualRating?.toLowerCase() || 'unverified';
      
      // Extract publisher from review
      const publisher = firstReview?.publisher?.name || 'Unknown Publisher';
      
      // Create excerpt from claim text
      const excerpt = claim.text?.length > 150 
        ? claim.text.substring(0, 150) + '...' 
        : claim.text || 'No description available';

      // Determine category based on claim text
      let articleCategory = 'general';
      const claimText = claim.text?.toLowerCase() || '';
      if (claimText.includes('covid') || claimText.includes('vaccine') || claimText.includes('health')) {
        articleCategory = 'health';
      } else if (claimText.includes('election') || claimText.includes('politic') || claimText.includes('vote')) {
        articleCategory = 'politics';
      } else if (claimText.includes('ai') || claimText.includes('technology') || claimText.includes('tech')) {
        articleCategory = 'technology';
      } else if (claimText.includes('climate') || claimText.includes('science') || claimText.includes('research')) {
        articleCategory = 'science';
      }

      return {
        id: claim.name || `claim-${index}`,
        title: claim.text || 'Untitled Fact Check',
        excerpt: excerpt,
        date: claim.claimDate || new Date().toISOString().split('T')[0],
        publisher: publisher,
        url: firstReview?.url || claim.url || '#',
        imageUrl: null, // Google Fact Check API doesn't provide images
        verdict: verdict,
        category: articleCategory,
        claimDate: claim.claimDate,
        reviewCount: claim.claimReview?.length || 0,
        originalClaim: claim.text
      };
    });

    return {
      articles,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(claims.length / limit),
        hasNextPage: !!nextPageToken,
        nextPageToken
      },
      totalResults: claims.length
    };

  } catch (error) {
    console.error("Error fetching fact-check articles:", error.message);
    
    if (error.code === 404 && error.message.includes("API not found")) {
      console.error("Check if the API is enabled in your Google Cloud console.");
    } else if (error.message.includes("Failed to discover API")) {
      console.error("Check internet connectivity and Google API service status.");
    }

    throw new Error("Failed to fetch fact-check articles.");
  }
}

export { searchFactChecks, getFactCheckArticles };
