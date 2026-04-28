const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

// Configuration détaillée de CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    const thumbnailsDir = path.join(__dirname, '../uploads/thumbnails');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Fonction pour générer une vignette
const generateThumbnail = (videoPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '320x180'
      })
      .on('end', () => resolve(thumbnailPath))
      .on('error', (err) => reject(err));
  });
};

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Base de données en mémoire pour les métadonnées
let mediaFiles = [];

// Stockage persistant des scénarios publiés
const publishedDir = path.join(__dirname, '../published');

const ensurePublishedDir = () => {
  if (!fs.existsSync(publishedDir)) {
    fs.mkdirSync(publishedDir, { recursive: true });
  }
};

const publishedFilePath = (id) => path.join(publishedDir, `${id}.json`);

const isValidPublishPayload = (value) => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

// Routes
app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Aucun fichier uploadé');
    }

    const file = req.file;
    let tags = [];
    
    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch (e) {
        console.warn('Impossible de parser les tags:', e);
      }
    }

    // Générer la vignette
    const thumbnailFilename = path.basename(file.filename, path.extname(file.filename)) + '.jpg';
    const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', thumbnailFilename);
    await generateThumbnail(file.path, thumbnailPath);

    const metadata = {
      id: Date.now().toString(),
      name: file.originalname,
      type: file.mimetype.startsWith('video/') ? 'video' : 'image',
      mimeType: file.mimetype,
      size: file.size,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mediaFile = {
      metadata,
      url: `http://localhost:${port}/uploads/${file.filename}`,
      thumbnailUrl: `http://localhost:${port}/uploads/thumbnails/${thumbnailFilename}`
    };

    mediaFiles.push({
      ...mediaFile,
      filename: file.filename,
      thumbnailFilename
    });

    res.json(mediaFile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/media', (req, res) => {
  const { search, tags } = req.query;
  let filteredFiles = [...mediaFiles];

  if (search) {
    const searchLower = search.toLowerCase();
    filteredFiles = filteredFiles.filter(file => 
      file.metadata.name.toLowerCase().includes(searchLower) ||
      file.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  if (tags) {
    const tagList = tags.split(',');
    filteredFiles = filteredFiles.filter(file =>
      tagList.some(tag => file.metadata.tags.includes(tag))
    );
  }

  const filesWithUrls = filteredFiles.map(file => ({
    metadata: file.metadata,
    url: `http://localhost:${port}/uploads/${file.filename}`,
    thumbnailUrl: `http://localhost:${port}/uploads/thumbnails/${file.thumbnailFilename}`
  }));

  res.json(filesWithUrls);
});

app.get('/api/media/:id', (req, res) => {
  const { id } = req.params;
  const file = mediaFiles.find(f => f.metadata.id === id);
  
  if (!file) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  res.json({
    metadata: file.metadata,
    url: `http://localhost:${port}/uploads/${file.filename}`,
    thumbnailUrl: `http://localhost:${port}/uploads/thumbnails/${file.thumbnailFilename}`
  });
});

app.delete('/api/media/:id', (req, res) => {
  const { id } = req.params;
  const fileIndex = mediaFiles.findIndex(f => f.metadata.id === id);
  
  if (fileIndex === -1) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  const file = mediaFiles[fileIndex];
  const filePath = path.join(__dirname, '../uploads', file.filename);
  const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', file.thumbnailFilename);

  try {
    fs.unlinkSync(filePath);
    fs.unlinkSync(thumbnailPath);
    mediaFiles = mediaFiles.filter(f => f.metadata.id !== id);
    res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du fichier' });
  }
});

app.patch('/api/media/:id', (req, res) => {
  const { id } = req.params;
  const fileIndex = mediaFiles.findIndex(f => f.metadata.id === id);
  
  if (fileIndex === -1) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  const updates = req.body;
  const file = mediaFiles[fileIndex];

  if (updates.tags) {
    file.metadata.tags = updates.tags;
  }

  file.metadata.updatedAt = new Date().toISOString();
  mediaFiles[fileIndex] = file;

  res.json({
    metadata: file.metadata,
    url: `http://localhost:${port}/uploads/${file.filename}`,
    thumbnailUrl: `http://localhost:${port}/uploads/thumbnails/${file.thumbnailFilename}`
  });
});

app.get('/api/published/:id', (req, res) => {
  try {
    ensurePublishedDir();
    const { id } = req.params;
    const filePath = publishedFilePath(id);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Publication non trouvée',
        id,
      });
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (error) {
    console.error('Error loading published scenario:', error);
    return res.status(500).json({ error: 'Erreur lors du chargement de la publication' });
  }
});

app.post('/api/published', (req, res) => {
  try {
    ensurePublishedDir();
    const payload = req.body?.payload ?? req.body;

    if (!isValidPublishPayload(payload)) {
      return res.status(400).json({
        error: 'Payload de publication invalide',
      });
    }

    const id = req.body?.id || randomUUID();
    const now = new Date().toISOString();
    const filePath = publishedFilePath(id);

    const record = {
      id,
      createdAt: now,
      updatedAt: now,
      payload,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');

    return res.status(201).json({
      id,
      createdAt: now,
      updatedAt: now,
      url: `/api/published/${id}`,
      record,
    });
  } catch (error) {
    console.error('Error creating published scenario:', error);
    return res.status(500).json({ error: 'Erreur lors de la publication du scénario' });
  }
});

app.put('/api/published/:id', (req, res) => {
  try {
    ensurePublishedDir();
    const { id } = req.params;
    const payload = req.body?.payload ?? req.body;

    if (!isValidPublishPayload(payload)) {
      return res.status(400).json({
        error: 'Payload de publication invalide',
      });
    }

    const filePath = publishedFilePath(id);
    const now = new Date().toISOString();

    let createdAt = now;
    if (fs.existsSync(filePath)) {
      try {
        const previous = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (previous?.createdAt) {
          createdAt = previous.createdAt;
        }
      } catch (readError) {
        console.warn(`Could not parse previous publication ${id}:`, readError);
      }
    }

    const record = {
      id,
      createdAt,
      updatedAt: now,
      payload,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');

    return res.json({
      id,
      createdAt,
      updatedAt: now,
      url: `/api/published/${id}`,
      record,
    });
  } catch (error) {
    console.error('Error updating published scenario:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la publication' });
  }
});

app.delete('/api/published/:id', (req, res) => {
  try {
    ensurePublishedDir();
    const { id } = req.params;
    const filePath = publishedFilePath(id);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Publication non trouvée',
        id,
      });
    }

    fs.unlinkSync(filePath);
    return res.json({ message: 'Publication supprimée', id });
  } catch (error) {
    console.error('Error deleting published scenario:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression de la publication' });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
