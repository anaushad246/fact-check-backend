import express from 'express';
import { searchFactChecks, getFactCheckArticles } from '../controllers/user.controller.js';

const router = express.Router();

// Text-based fact check endpoint
router.post('/fact-check', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    console.log('Received fact check request for content:', content);
    
    const result = await searchFactChecks(content);
    console.log('Fact check result structure:', {
      hasSummary: !!result.summary,
      hasData: !!result.data,
      hasFactCheckResults: !!(result.data?.factCheckResults),
      resultCount: result.data?.factCheckResults?.length
    });
    
    res.json(result);
  } catch (error) {
    console.error('Fact check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get fact-check articles for blog page
router.get('/articles', async (req, res) => {
  try {
    const { query = '', category = '', page = 1, limit = 20 } = req.query;
    console.log('Fetching fact-check articles:', { query, category, page, limit });
    
    const articles = await getFactCheckArticles(query, category, parseInt(page), parseInt(limit));
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 