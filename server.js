import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MAIL_HOST = process.env.MAIL_HOST || 'smtp.gmail.com';
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_SECURE = process.env.MAIL_SECURE ? process.env.MAIL_SECURE === 'true' : true;
const MAIL_NOTIFY_TO = process.env.MAIL_NOTIFY_TO || null;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Movie Wishlist Bot';
const wishlistPath = path.join(__dirname, 'data', 'wishlist.json');
const emailConfigPath = path.join(__dirname, 'data', 'email-config.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureWishlistFile() {
  try {
    await fs.access(wishlistPath);
  } catch {
    await fs.writeFile(wishlistPath, '[]', 'utf-8');
  }
}

async function ensureEmailConfigFile() {
  try {
    await fs.access(emailConfigPath);
  } catch {
    await fs.writeFile(emailConfigPath, JSON.stringify({ email: null, password: null }, null, 2), 'utf-8');
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

async function removeWishlistItems(tmdbIds) {
  const normalized = tmdbIds.map(id => String(id));
  const wishlist = await readWishlist();
  const targetIds = new Set(normalized);
  const updated = wishlist.filter(item => !targetIds.has(String(item.tmdbId)));
  const removedCount = wishlist.length - updated.length;

  if (removedCount > 0) {
    await writeWishlist(updated);
  }

  return { removedCount };
}

async function readEmailConfig() {
  await ensureEmailConfigFile();
  const raw = await fs.readFile(emailConfigPath, 'utf-8');
  return JSON.parse(raw);
}

async function writeEmailConfig(config) {
  await fs.writeFile(emailConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

function isEmailConfigured(config) {
  return Boolean(config?.email && config?.password);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function notifyAdmin(newEntry) {
  const config = await readEmailConfig();
  if (!isEmailConfigured(config)) {
    console.warn('Email notification is not configured. Skipping notification.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: MAIL_HOST,
      port: MAIL_PORT,
      secure: MAIL_SECURE,
      auth: {
        user: config.email,
        pass: config.password
      }
    });

    const toAddress = MAIL_NOTIFY_TO || config.email;
    const subject = `新增愿望单：${newEntry.title}`;
    const escapedSubject = escapeHtml(subject);
    const lines = [
      `媒体类型：${newEntry.mediaType === 'movie' ? '电影' : '剧集'}`,
      `TMDB ID：${newEntry.tmdbId}`,
      `IMDb ID：${newEntry.imdbId || '暂无'}`,
      `加入时间：${newEntry.createdAt}`
    ];

    await transporter.sendMail({
      from: `${MAIL_FROM_NAME} <${config.email}>`,
      to: toAddress,
      subject,
      text: `${subject}\n${lines.join('\n')}`,
      html: `<p>${escapedSubject}</p><ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    });

    console.info(`Notification email sent to ${toAddress} for "${newEntry.title}".`);
  } catch (error) {
    console.error('Failed to send notification email:', error.message);
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

app.get('/api/email-config', async (_req, res) => {
  try {
    const config = await readEmailConfig();
    res.json({
      email: config.email,
      configured: isEmailConfigured(config)
    });
  } catch (error) {
    console.error('Failed to read email config:', error.message);
    res.status(500).json({ message: 'Unable to read email config.' });
  }
});

app.post('/api/email-config', async (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ message: 'ADMIN_PASSWORD is not configured.' });
  }

  const { adminPassword, email, password } = req.body || {};
  if (!adminPassword || !email || !password) {
    return res.status(400).json({ message: 'adminPassword, email, and password are required.' });
  }

  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ message: '密码错误。' });
  }

  try {
    await writeEmailConfig({ email, password });
    res.json({ message: 'Email configuration updated.' });
  } catch (error) {
    console.error('Failed to update email config:', error.message);
    res.status(500).json({ message: 'Unable to update email config.' });
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

    notifyAdmin(newEntry);
  } catch (error) {
    console.error('Failed to update wishlist:', error.message);
    res.status(500).json({ message: 'Unable to update wishlist.' });
  }
});

app.delete('/api/wishlist/:tmdbId', async (req, res) => {
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
    const { removedCount } = await removeWishlistItems([req.params.tmdbId]);
    if (!removedCount) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    res.json({ message: 'Item removed.' });
  } catch (error) {
    console.error('Failed to delete wishlist item:', error.message);
    res.status(500).json({ message: 'Unable to delete wishlist item.' });
  }
});

app.delete('/api/wishlist', async (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ message: 'ADMIN_PASSWORD is not configured.' });
  }

  const body = req.body || {};
  const tmdbIds = Array.isArray(body.tmdbIds) ? body.tmdbIds.filter(Boolean) : [];
  const password = body.password;

  if (!tmdbIds.length) {
    return res.status(400).json({ message: 'tmdbIds must be a non-empty array.' });
  }

  if (!password) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ message: '密码错误。' });
  }

  try {
    const { removedCount } = await removeWishlistItems(tmdbIds);
    if (!removedCount) {
      return res.status(404).json({ message: 'No matching items found.' });
    }

    res.json({ message: `Removed ${removedCount} item${removedCount > 1 ? 's' : ''}.`, removed: removedCount });
  } catch (error) {
    console.error('Failed to delete wishlist items:', error.message);
    res.status(500).json({ message: 'Unable to delete wishlist items.' });
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
