import express from 'express';
import { searchFactChecks, getFactCheckArticles } from '../controllers/user.controller.js';
import axios from 'axios';

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
router.route('/articles').get(async (req, res) => {
  try {
    const { query, category, page, limit } = req.query;
    const result = await getFactCheckArticles(query, category, parseInt(page, 10), parseInt(limit, 10));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New route for fetching news from NewsAPI
router.route('/news').get(async (req, res) => {
  try {
    const { category, q: keyword } = req.query;
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'News API key is not configured.' });
    }

    let url;
    if (category) {
      url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&apiKey=${apiKey}`;
    } else if (keyword) {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
    } else {
      // Default case
      url = `https://newsapi.org/v2/top-headlines?country=us&category=general&apiKey=${apiKey}`;
    }

    const response = await axios.get(url);
    res.json(response.data);

  } catch (error) {
    console.error('Error fetching from NewsAPI:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch news articles.' });
  }
});

export default router; 