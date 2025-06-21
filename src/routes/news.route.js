import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Route for fetching news from NewsAPI
router.route('/').get(async (req, res) => {
  try {
    const { category, q: keyword } = req.query;
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'News API key is not configured on the server.' });
    }

    let url;
    if (category) {
      url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&apiKey=${apiKey}`;
    } else if (keyword) {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
    } else {
      // Default case if no category or keyword is provided
      url = `https://newsapi.org/v2/top-headlines?country=us&category=general&apiKey=${apiKey}`;
    }

    const response = await axios.get(url);
    res.json(response.data);

  } catch (error) {
    const errorMessage = error.response ? error.response.data.message : error.message;
    console.error('Error fetching from NewsAPI:', errorMessage);
    res.status(500).json({ error: 'Failed to fetch news articles.' });
  }
});

export default router; 