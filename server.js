import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const wishlistPath = path.join(__dirname, 'data', 'wishlist.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureWishlistFile() {
  try {
    await fs.access(wishlistPath);
  } catch {
    await fs.writeFile(wishlistPath, '[]', 'utf-8');
  }
}

async function readWishlist() {
  await ensureWishlistFile();
  const raw = await fs.readFile(wishlistPath, 'utf-8');
  return JSON.parse(raw);
}

async function writeWishlist(data) {
  await fs.writeFile(wishlistPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function fetchImdbId(mediaType, tmdbId) {
  try {
    const { data } = await axios.get(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}/external_ids`, {
      params: { api_key: TMDB_API_KEY }
    });
    return data.imdb_id || null;
  } catch (error) {
    console.error('Failed to fetch imdb id', error.message);
    return null;
  }
}

app.get('/api/search', async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) {
    return res.status(400).json({ message: 'Missing search query parameter "q".' });
  }

  if (!TMDB_API_KEY) {
    return res.status(500).json({ message: 'TMDB_API_KEY is not configured on the server.' });
  }

  try {
    const { data } = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query,
        include_adult: false,
        language: 'zh-CN'
      }
    });

    const filtered = (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    const topTen = filtered.slice(0, 10);

    const enriched = await Promise.all(topTen.map(async item => {
      const imdbId = await fetchImdbId(item.media_type, item.id);
      const title = item.media_type === 'movie' ? item.title : item.name;
      return {
        tmdbId: item.id,
        mediaType: item.media_type,
        title,
        overview: item.overview || '暂无简介',
        rating: item.vote_average ?? null,
        releaseDate: item.release_date || item.first_air_date || null,
        posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        imdbId
      };
    }));

    res.json({ query, results: enriched });
  } catch (error) {
    console.error('TMDB search failed:', error.message);
    res.status(502).json({ message: 'Failed to reach TMDB. Please try again later.' });
  }
});

app.get('/api/wishlist', async (_req, res) => {
  try {
    const wishlist = await readWishlist();
    res.json(wishlist);
  } catch (error) {
    console.error('Failed to read wishlist:', error.message);
    res.status(500).json({ message: 'Unable to read wishlist.' });
  }
});

app.post('/api/wishlist', async (req, res) => {
  const { tmdbId, title, mediaType, imdbId } = req.body || {};

  if (!tmdbId || !title || !mediaType) {
    return res.status(400).json({ message: 'tmdbId, title, and mediaType are required.' });
  }

  try {
    const wishlist = await readWishlist();
    const exists = wishlist.some(item => item.tmdbId === tmdbId || (imdbId && item.imdbId === imdbId));
    if (exists) {
      return res.status(409).json({ message: 'Item is already in the wishlist.' });
    }

    const newEntry = {
      tmdbId,
      title,
      mediaType,
      imdbId: imdbId || null,
      createdAt: new Date().toISOString()
    };

    wishlist.push(newEntry);
    await writeWishlist(wishlist);
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('Failed to update wishlist:', error.message);
    res.status(500).json({ message: 'Unable to update wishlist.' });
  }
});

app.delete('/api/wishlist/:tmdbId', async (req, res) => {
  try {
    const wishlist = await readWishlist();
    const updated = wishlist.filter(item => String(item.tmdbId) !== req.params.tmdbId);

    if (updated.length === wishlist.length) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    await writeWishlist(updated);
    res.json({ message: 'Item removed.' });
  } catch (error) {
    console.error('Failed to delete wishlist item:', error.message);
    res.status(500).json({ message: 'Unable to delete wishlist item.' });
  }
});

app.post('/api/wishlist/clear', async (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ message: 'ADMIN_PASSWORD is not configured.' });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ message: '密码错误。' });
  }

  try {
    await writeWishlist([]);
    res.json({ message: 'Wishlist cleared.' });
  } catch (error) {
    console.error('Failed to clear wishlist:', error.message);
    res.status(500).json({ message: 'Unable to clear wishlist.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
