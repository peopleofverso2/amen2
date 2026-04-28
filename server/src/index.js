const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const QRCode = require('qrcode');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');
const firebaseAdmin = require('firebase-admin');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, '../uploads');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const exportsDir = path.join(uploadsDir, 'exports');
const analyticsDir = path.join(uploadsDir, 'analytics');
const publishedScenariosDir = path.join(uploadsDir, 'published-scenarios');
const publishedScenariosIndexPath = path.join(publishedScenariosDir, 'index.json');
const clientDistDir = path.join(__dirname, '../../dist');
const clientIndexPath = path.join(clientDistDir, 'index.html');
const youtubeEndScreenAssistantScriptPath = path.join(
  __dirname,
  '../../scripts/youtube-endscreen-assistant.mjs'
);
const mediaIndexPath = path.join(uploadsDir, 'media-index.json');
const analyticsEventsPath = path.join(analyticsDir, 'events.ndjson');
const authUsersPath = process.env.AUTH_USERS_PATH || path.join(uploadsDir, 'auth-users.json');
const authSessionsPath =
  process.env.AUTH_SESSIONS_PATH || path.join(uploadsDir, 'auth-sessions.json');
const authCookieName = process.env.AUTH_COOKIE_NAME || 'amen_auth';
const authSessionSecret = process.env.AUTH_SESSION_SECRET || 'change-me-in-production';
const authSessionTtlMs = Math.max(
  5 * 60 * 1000,
  Number(process.env.AUTH_SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 30)
);
const authCookieSecure =
  process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const firebaseProjectId =
  typeof process.env.FIREBASE_PROJECT_ID === 'string' ? process.env.FIREBASE_PROJECT_ID.trim() : '';
const firebaseClientEmail =
  typeof process.env.FIREBASE_CLIENT_EMAIL === 'string'
    ? process.env.FIREBASE_CLIENT_EMAIL.trim()
    : '';
const firebasePrivateKeyRaw =
  typeof process.env.FIREBASE_PRIVATE_KEY === 'string' ? process.env.FIREBASE_PRIVATE_KEY.trim() : '';
const firebasePrivateKey = firebasePrivateKeyRaw ? firebasePrivateKeyRaw.replace(/\\n/g, '\n') : '';
const hasFirebaseCredentialFields = Boolean(firebaseClientEmail && firebasePrivateKey);
const isFirebaseAuthEnabled = Boolean(firebaseProjectId || hasFirebaseCredentialFields);
const youtubeTokenPath =
  process.env.YOUTUBE_TOKEN_PATH || path.join(uploadsDir, 'youtube-oauth.json');
const youtubeConfigPath =
  process.env.YOUTUBE_CONFIG_PATH || path.join(uploadsDir, 'youtube-oauth-config.json');
const gcsBucketName =
  typeof process.env.GCS_BUCKET === 'string' ? process.env.GCS_BUCKET.trim() : '';
const gcsPrefixRaw =
  typeof process.env.GCS_PREFIX === 'string' ? process.env.GCS_PREFIX.trim() : '';
const gcsPrefix = gcsPrefixRaw.replace(/^\/+|\/+$/g, '');
const isPersistentStorageEnabled = Boolean(gcsBucketName);
const gcsStorage = isPersistentStorageEnabled ? new Storage() : null;
const gcsBucket = isPersistentStorageEnabled ? gcsStorage.bucket(gcsBucketName) : null;
const comfyBaseUrlRaw =
  typeof process.env.COMFYUI_BASE_URL === 'string' ? process.env.COMFYUI_BASE_URL.trim() : '';
const comfyBaseUrl = comfyBaseUrlRaw.replace(/\/+$/g, '');
const comfyModeRaw =
  typeof process.env.COMFYUI_MODE === 'string' ? process.env.COMFYUI_MODE.trim().toLowerCase() : '';
const comfyMode =
  comfyModeRaw === 'cloud' || comfyModeRaw === 'local'
    ? comfyModeRaw
    : comfyBaseUrl.includes('cloud.comfy.org')
      ? 'cloud'
      : 'local';
const comfyApiPrefixRaw =
  typeof process.env.COMFYUI_API_PREFIX === 'string' ? process.env.COMFYUI_API_PREFIX.trim() : '';
const comfyApiPrefix = comfyApiPrefixRaw
  ? `/${comfyApiPrefixRaw.replace(/^\/+|\/+$/g, '')}`.replace(/\/+/g, '/')
  : comfyMode === 'cloud'
    ? '/api'
    : '';
const comfyApiKey =
  typeof process.env.COMFYUI_API_KEY === 'string' ? process.env.COMFYUI_API_KEY.trim() : '';
const comfyRequestTimeoutMs = Math.max(
  2000,
  Number(process.env.COMFYUI_REQUEST_TIMEOUT_MS || 30000)
);
const comfyJobTimeoutMs = Math.max(5000, Number(process.env.COMFYUI_JOB_TIMEOUT_MS || 300000));
const comfyPollIntervalMs = Math.max(500, Number(process.env.COMFYUI_POLL_INTERVAL_MS || 2000));
const comfyWorkflowTemplateDir =
  typeof process.env.COMFYUI_WORKFLOW_TEMPLATE_DIR === 'string' &&
  process.env.COMFYUI_WORKFLOW_TEMPLATE_DIR.trim()
    ? process.env.COMFYUI_WORKFLOW_TEMPLATE_DIR.trim()
    : path.join(__dirname, '../workflows/comfyui');

const mimeByExtension = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const supportedMimePrefixes = ['video/', 'image/'];

const isSupportedMime = (mimeType) =>
  supportedMimePrefixes.some((prefix) => mimeType.startsWith(prefix));

const toSafeRelativePath = (rawPath) => {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return null;
  }

  const normalized = path.posix
    .normalize(rawPath.replace(/\\/g, '/').replace(/^\/+/, ''))
    .trim();
  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    return null;
  }

  return normalized;
};

const toStorageObjectKey = (relativePath) => {
  const safeRelativePath = toSafeRelativePath(relativePath);
  if (!safeRelativePath) {
    return null;
  }
  return gcsPrefix ? `${gcsPrefix}/${safeRelativePath}` : safeRelativePath;
};

const toLocalUploadPath = (relativePath) => {
  const safeRelativePath = toSafeRelativePath(relativePath);
  if (!safeRelativePath) {
    return null;
  }

  const localRelativePath = safeRelativePath.split('/').join(path.sep);
  const resolvedPath = path.join(uploadsDir, localRelativePath);
  if (!resolvedPath.startsWith(uploadsDir)) {
    return null;
  }
  return resolvedPath;
};

const contentTypeForPath = (relativePath) => {
  const extension = path.extname(relativePath).toLowerCase();
  return mimeByExtension[extension] || 'application/octet-stream';
};

const writeBufferToPersistentStorage = async (relativePath, buffer, contentType) => {
  if (!isPersistentStorageEnabled || !gcsBucket) {
    return;
  }

  const objectKey = toStorageObjectKey(relativePath);
  if (!objectKey) {
    return;
  }

  const file = gcsBucket.file(objectKey);
  await file.save(buffer, {
    resumable: false,
    metadata: contentType ? { contentType } : undefined,
  });
};

const uploadLocalFileToPersistentStorage = async (relativePath) => {
  if (!isPersistentStorageEnabled || !gcsBucket) {
    return;
  }

  const objectKey = toStorageObjectKey(relativePath);
  const localPath = toLocalUploadPath(relativePath);
  if (!objectKey || !localPath || !fs.existsSync(localPath)) {
    return;
  }

  await gcsBucket.upload(localPath, {
    destination: objectKey,
    resumable: false,
    metadata: {
      contentType: contentTypeForPath(relativePath),
    },
  });
};

const readTextFromPersistentStorage = async (relativePath) => {
  if (!isPersistentStorageEnabled || !gcsBucket) {
    return null;
  }

  const objectKey = toStorageObjectKey(relativePath);
  if (!objectKey) {
    return null;
  }

  const file = gcsBucket.file(objectKey);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [buffer] = await file.download();
  return buffer.toString('utf8');
};

const deleteFromPersistentStorage = async (relativePath) => {
  if (!isPersistentStorageEnabled || !gcsBucket) {
    return;
  }

  const objectKey = toStorageObjectKey(relativePath);
  if (!objectKey) {
    return;
  }

  await gcsBucket.file(objectKey).delete({ ignoreNotFound: true });
};

const ensureLocalFileAvailable = async (relativePath) => {
  const safeRelativePath = toSafeRelativePath(relativePath);
  if (!safeRelativePath) {
    return null;
  }

  const localPath = toLocalUploadPath(safeRelativePath);
  if (!localPath) {
    return null;
  }

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  if (!isPersistentStorageEnabled || !gcsBucket) {
    return null;
  }

  const objectKey = toStorageObjectKey(safeRelativePath);
  if (!objectKey) {
    return null;
  }

  const file = gcsBucket.file(objectKey);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  await file.download({ destination: localPath });
  return localPath;
};

const ensureStorageDirectories = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  if (!fs.existsSync(analyticsDir)) {
    fs.mkdirSync(analyticsDir, { recursive: true });
  }
  if (!fs.existsSync(publishedScenariosDir)) {
    fs.mkdirSync(publishedScenariosDir, { recursive: true });
  }
  const youtubeTokenDir = path.dirname(youtubeTokenPath);
  if (!fs.existsSync(youtubeTokenDir)) {
    fs.mkdirSync(youtubeTokenDir, { recursive: true });
  }
  const youtubeConfigDir = path.dirname(youtubeConfigPath);
  if (!fs.existsSync(youtubeConfigDir)) {
    fs.mkdirSync(youtubeConfigDir, { recursive: true });
  }
  const authUsersDir = path.dirname(authUsersPath);
  if (!fs.existsSync(authUsersDir)) {
    fs.mkdirSync(authUsersDir, { recursive: true });
  }
  const authSessionsDir = path.dirname(authSessionsPath);
  if (!fs.existsSync(authSessionsDir)) {
    fs.mkdirSync(authSessionsDir, { recursive: true });
  }
};

const toPublicMediaFile = (file) => ({
  metadata: file.metadata,
  url: `/uploads/${file.filename}`,
  thumbnailUrl: file.thumbnailFilename
    ? `/uploads/thumbnails/${file.thumbnailFilename}`
    : undefined,
});

const saveMediaIndex = async (mediaFiles) => {
  try {
    ensureStorageDirectories();
    const payload = JSON.stringify(mediaFiles, null, 2);
    fs.writeFileSync(mediaIndexPath, payload, 'utf8');
    await writeBufferToPersistentStorage('media-index.json', Buffer.from(payload, 'utf8'), 'application/json');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de media-index.json:', error);
  }
};

const buildRecordFromDiskFile = (filename) => {
  const fullPath = path.join(uploadsDir, filename);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return null;
  }

  const extension = path.extname(filename).toLowerCase();
  const mimeType = mimeByExtension[extension];
  if (!mimeType || !isSupportedMime(mimeType)) {
    return null;
  }

  const stats = fs.statSync(fullPath);
  const baseName = path.basename(filename, extension);
  const thumbnailCandidate = `${baseName}.jpg`;
  const thumbnailPath = path.join(thumbnailsDir, thumbnailCandidate);
  const thumbnailFilename =
    mimeType.startsWith('video/') && fs.existsSync(thumbnailPath)
      ? thumbnailCandidate
      : undefined;
  const timestamp = stats.mtime.toISOString();

  return {
    metadata: {
      id: `legacy-${baseName}-${Math.round(stats.mtimeMs)}`,
      name: filename,
      type: mimeType.startsWith('video/') ? 'video' : 'image',
      mimeType,
      size: stats.size,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    filename,
    thumbnailFilename,
  };
};

const rebuildMediaIndexFromPersistentStorage = async () => {
  if (!isPersistentStorageEnabled || !gcsBucket) {
    return [];
  }

  try {
    const prefix = gcsPrefix ? `${gcsPrefix}/` : '';
    const [files] = await gcsBucket.getFiles({
      prefix,
      autoPaginate: true,
    });

    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    const objectMap = new Map();
    files.forEach((file) => {
      const objectName = String(file.name || '');
      const relativeName = prefix && objectName.startsWith(prefix)
        ? objectName.slice(prefix.length)
        : objectName;
      const safeRelativeName = toSafeRelativePath(relativeName);
      if (!safeRelativeName) {
        return;
      }
      objectMap.set(safeRelativeName, file);
    });

    const records = [];
    objectMap.forEach((file, relativeName) => {
      if (relativeName.includes('/')) {
        return;
      }

      const extension = path.extname(relativeName).toLowerCase();
      const mimeType = mimeByExtension[extension];
      if (!mimeType || !isSupportedMime(mimeType)) {
        return;
      }

      const baseName = path.basename(relativeName, extension);
      const thumbnailCandidate = `thumbnails/${baseName}.jpg`;
      const fileMetadata = file.metadata || {};
      const timestamp = fileMetadata.updated || new Date().toISOString();
      const size = Number(fileMetadata.size) || 0;

      records.push({
        metadata: {
          id: `persistent-${baseName}-${Math.round(Date.parse(timestamp) || Date.now())}`,
          name: relativeName,
          type: mimeType.startsWith('video/') ? 'video' : 'image',
          mimeType,
          size,
          tags: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        filename: relativeName,
        thumbnailFilename: objectMap.has(thumbnailCandidate)
          ? path.basename(thumbnailCandidate)
          : undefined,
      });
    });

    return records;
  } catch (error) {
    console.warn('Impossible de reconstruire media-index depuis le stockage persistant:', error);
    return [];
  }
};

const loadMediaIndex = async () => {
  ensureStorageDirectories();

  if (isPersistentStorageEnabled) {
    try {
      const remoteRaw = await readTextFromPersistentStorage('media-index.json');
      if (remoteRaw) {
        const parsed = JSON.parse(remoteRaw);
        if (Array.isArray(parsed)) {
          fs.writeFileSync(mediaIndexPath, JSON.stringify(parsed, null, 2), 'utf8');
          return parsed.filter((file) => file && file.filename);
        }
      }
    } catch (error) {
      console.warn('media-index.json distant invalide, fallback local.', error);
    }
  }

  if (fs.existsSync(mediaIndexPath)) {
    try {
      const raw = fs.readFileSync(mediaIndexPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((file) => file && file.filename);
      }
    } catch (error) {
      console.warn('media-index.json invalide, reconstruction depuis uploads/', error);
    }
  }

  const files = fs
    .readdirSync(uploadsDir)
    .filter((name) => name !== 'thumbnails' && name !== 'media-index.json');

  const records = files.map(buildRecordFromDiskFile).filter(Boolean);
  if (records.length > 0) {
    await saveMediaIndex(records);
    return records;
  }

  if (isPersistentStorageEnabled) {
    const persistentRecords = await rebuildMediaIndexFromPersistentStorage();
    if (persistentRecords.length > 0) {
      await saveMediaIndex(persistentRecords);
      return persistentRecords;
    }
  }

  await saveMediaIndex(records);
  return records;
};

let mediaFiles = [];

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', (req, res, next) => {
  if (!isPersistentStorageEnabled || !['GET', 'HEAD'].includes(req.method)) {
    return next();
  }

  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(String(req.path || '')).replace(/^\/+/, '');
  } catch (error) {
    return res.status(400).json({ error: 'Chemin upload invalide' });
  }

  const safeRelativePath = toSafeRelativePath(decodedPath);
  if (!safeRelativePath) {
    return next();
  }

  void ensureLocalFileAvailable(safeRelativePath)
    .then(() => next())
    .catch((error) => next(error));
});
app.use('/uploads', express.static(uploadsDir));
app.get('/tools/youtube-endscreen-assistant.mjs', (req, res) => {
  if (!fs.existsSync(youtubeEndScreenAssistantScriptPath)) {
    return res.status(404).send('Assistant script not found');
  }

  res.type('application/javascript');
  return res.sendFile(youtubeEndScreenAssistantScriptPath);
});
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureStorageDirectories();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (isSupportedMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Une image (png/jpg/webp) est requise'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const generateThumbnail = (videoPath, thumbnailPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '320x180',
      })
      .on('end', () => resolve(thumbnailPath))
      .on('error', (err) => reject(err));
  });

const probeMediaStreams = (inputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }

      const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
      const hasVideo = streams.some((stream) => stream?.codec_type === 'video');
      const hasAudio = streams.some((stream) => stream?.codec_type === 'audio');
      const videoStream = streams.find((stream) => stream?.codec_type === 'video');
      const durationCandidate = Number(metadata?.format?.duration);
      const durationSeconds =
        Number.isFinite(durationCandidate) && durationCandidate > 0 ? durationCandidate : null;
      resolve({
        hasVideo,
        hasAudio,
        durationSeconds,
        width: Number(videoStream?.width) || null,
        height: Number(videoStream?.height) || null,
      });
    });
  });

const escapeDrawtextValue = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\r?\n/g, ' ');

const normalizeYoutubeOverlayText = (value, { fallback = '', maxLength = 64 } = {}) => {
  const singleLine = String(value || '')
    .replace(/\r?\n/g, ' ')
    .trim();
  const withFallback = singleLine || fallback;
  return withFallback.slice(0, Math.max(1, maxLength));
};

const shortenCompanionUrlForOverlay = (url, maxLength = 86) => {
  if (typeof url !== 'string') {
    return '';
  }
  if (url.length <= maxLength) {
    return url;
  }
  return `${url.slice(0, Math.max(0, maxLength - 3))}...`;
};

const youtubeOverlayFontCandidates = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
];

const resolveYoutubeOverlayFontPath = () =>
  youtubeOverlayFontCandidates.find((fontPath) => fs.existsSync(fontPath)) || null;

const applyYoutubeCompanionCtaOverlay = async ({
  inputPath,
  outputPath,
  companionUrl,
  companionCtaText = 'Version interactive',
  ctaDurationSeconds = 5,
}) => {
  const streamInfo = await probeMediaStreams(inputPath);
  if (!streamInfo.hasVideo) {
    throw new Error('Impossible d’appliquer le CTA interactif: piste vidéo absente');
  }

  ensureStorageDirectories();
  const qrPath = path.join(
    exportsDir,
    `youtube-companion-qr-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`
  );
  await QRCode.toFile(qrPath, companionUrl, {
    type: 'png',
    width: 200,
    margin: 1,
    color: {
      dark: '#000000FF',
      light: '#FFFFFFFF',
    },
  });

  const duration = Number(streamInfo.durationSeconds) || 0;
  const safeCtaDuration = Math.max(2, Math.min(10, Number(ctaDurationSeconds) || 5));
  const ctaStart = duration > 0 ? Math.max(0, duration - safeCtaDuration) : 0;
  const enableExpr = `gte(t\\,${ctaStart.toFixed(3)})`;
  const displayUrl = shortenCompanionUrlForOverlay(companionUrl);
  const ctaTitleText = normalizeYoutubeOverlayText(companionCtaText, {
    fallback: 'Version interactive',
    maxLength: 64,
  });
  const ctaButtonText = normalizeYoutubeOverlayText(companionCtaText, {
    fallback: ctaTitleText,
    maxLength: 42,
  });
  const fontPath = resolveYoutubeOverlayFontPath();
  const videoWidth = Math.max(320, Number(streamInfo.width) || 1280);
  const videoHeight = Math.max(180, Number(streamInfo.height) || 720);
  const buttonWidth = Math.max(240, Math.min(560, videoWidth - 320));
  const buttonCenterX = 40 + Math.round(buttonWidth / 2);
  const safeRightPadding = 24;
  const qrMaxSizeByWidth = Math.max(80, videoWidth - 2 * safeRightPadding);
  const qrMaxSizeByHeight = Math.max(80, videoHeight - 260);
  const qrSize = Math.max(96, Math.min(176, qrMaxSizeByWidth, qrMaxSizeByHeight));
  const qrX = Math.max(8, videoWidth - qrSize - safeRightPadding);
  const qrY = Math.max(8, videoHeight - qrSize - 28);
  const drawtextFontPrefix = fontPath
    ? `fontfile='${escapeDrawtextValue(fontPath)}':`
    : '';

  const fullComplexFilters = [
    `[0:v]drawbox=x=0:y=ih-236:w=iw:h=236:color=black@0.62:t=fill:enable='${enableExpr}'[base]`,
    `[base]drawtext=${drawtextFontPrefix}text='${escapeDrawtextValue(ctaTitleText)}':fontcolor=white:fontsize=50:x=40:y=h-204:enable='${enableExpr}'[t1]`,
    `[t1]drawtext=${drawtextFontPrefix}text='Scannez le QR ou utilisez le bouton de fin':fontcolor=white:fontsize=28:x=40:y=h-152:enable='${enableExpr}'[t2]`,
    `[t2]drawbox=x=40:y=h-108:w=${buttonWidth}:h=50:color=0x2196f3@0.92:t=fill:enable='${enableExpr}'[t3]`,
    `[t3]drawbox=x=40:y=h-108:w=${buttonWidth}:h=50:color=0xffffff@0.95:t=2:enable='${enableExpr}'[t4]`,
    `[t4]drawtext=${drawtextFontPrefix}text='${escapeDrawtextValue(ctaButtonText)}':fontcolor=white:fontsize=26:x=${buttonCenterX}-text_w/2:y=h-108+25-text_h/2:enable='${enableExpr}'[t5]`,
    `[t5]drawtext=${drawtextFontPrefix}text='${escapeDrawtextValue(displayUrl)}':fontcolor=white:fontsize=22:x=40:y=h-54:enable='${enableExpr}'[t6]`,
    `[1:v]format=rgb24,scale=${qrSize}:${qrSize},setsar=1[qr]`,
    `[t6][qr]overlay=x=${qrX}:y=${qrY}:eof_action=repeat:enable='${enableExpr}',scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[vout]`,
  ];

  const fallbackQrOnlyFilters = [
    `[0:v]drawbox=x=0:y=ih-236:w=iw:h=236:color=black@0.62:t=fill:enable='${enableExpr}'[base]`,
    `[1:v]format=rgb24,scale=${qrSize}:${qrSize},setsar=1[qr]`,
    `[base][qr]overlay=x=${qrX}:y=${qrY}:eof_action=repeat:enable='${enableExpr}',scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[vout]`,
  ];

  const audioOptions = streamInfo.hasAudio
    ? ['-map 0:a:0?', '-c:a aac', '-b:a 160k', '-ac 2']
    : ['-an'];

  const runOverlayRender = (complexFilters) =>
    new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .input(qrPath)
        .complexFilter(complexFilters)
        .outputOptions([
          '-map [vout]',
          ...audioOptions,
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          '-r 30',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
        ])
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (error) => reject(error));

      if (duration > 0) {
        command.setDuration(duration);
      }
    });

  try {
    try {
      await runOverlayRender(fullComplexFilters);
      return {
        outputPath,
        applied: true,
        mode: 'full',
      };
    } catch (error) {
      const primaryMessage = error?.message || String(error);
      console.warn(
        `CTA YouTube: échec overlay texte (${primaryMessage}). Fallback QR-only activé.`
      );

      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupError) {
        console.warn(
          'CTA YouTube: impossible de nettoyer le fichier partiel avant fallback:',
          cleanupError?.message || cleanupError
        );
      }

      try {
        await runOverlayRender(fallbackQrOnlyFilters);
        return {
          outputPath,
          applied: true,
          mode: 'qr_only',
        };
      } catch (fallbackError) {
        const fallbackMessage = fallbackError?.message || String(fallbackError);
        throw new Error(
          `CTA YouTube impossible (${primaryMessage}) ; fallback QR-only échoué (${fallbackMessage})`
        );
      }
    }
  } finally {
    try {
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
    } catch (error) {
      console.warn('Impossible de supprimer le QR temporaire:', error?.message || error);
    }
  }
};

const mapOptionsFromStreams = ({ hasVideo, hasAudio, requireVideo }) => {
  if (requireVideo && !hasVideo) {
    throw new Error('Le média sélectionné ne contient pas de piste vidéo exploitable');
  }

  const options = [];
  if (hasVideo) {
    options.push('-map 0:v:0?');
  }
  if (hasAudio) {
    options.push('-map 0:a:0?');
  } else {
    options.push('-an');
  }
  return options;
};

const normalizeVideoForWebPlayback = async (inputPath, outputPath) => {
  const streamInfo = await probeMediaStreams(inputPath);
  const mapOptions = mapOptionsFromStreams({
    hasVideo: streamInfo.hasVideo,
    hasAudio: streamInfo.hasAudio,
    requireVideo: true,
  });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        ...mapOptions,
        '-c:v libx264',
        '-profile:v main',
        '-level 4.0',
        '-preset veryfast',
        '-crf 23',
        '-r 30',
        '-g 30',
        '-keyint_min 30',
        '-sc_threshold 0',
        '-pix_fmt yuv420p',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:a aac',
        '-b:a 128k',
        '-ac 2',
        '-movflags +faststart',
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error));
  });
};

const createMediaRecord = ({ filename, originalName, mimeType, tags = [], thumbnailFilename }) => {
  const fullPath = path.join(uploadsDir, filename);
  const stats = fs.statSync(fullPath);

  return {
    metadata: {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      name: originalName,
      type: mimeType.startsWith('video/') ? 'video' : 'image',
      mimeType,
      size: stats.size,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    filename,
    thumbnailFilename,
  };
};

const resolveOpenAIApiKey = (providedApiKey) => {
  const directApiKey =
    typeof providedApiKey === 'string' && providedApiKey.trim()
      ? providedApiKey.trim()
      : undefined;
  const envApiKey =
    typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim()
      ? process.env.OPENAI_API_KEY.trim()
      : undefined;
  const apiKey = directApiKey || envApiKey;

  if (!apiKey) {
    throw new Error(
      'Clé API OpenAI manquante: définir OPENAI_API_KEY côté serveur ou renseigner la clé dans les paramètres du modèle'
    );
  }

  return apiKey;
};

const generateImageBufferFromPrompt = async (prompt, providedApiKey) => {
  const apiKey = resolveOpenAIApiKey(providedApiKey);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || 'Erreur lors de la génération de l’image IA';
    throw new Error(message);
  }

  const base64Image = payload?.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error('Réponse IA invalide: image absente');
  }

  return Buffer.from(base64Image, 'base64');
};

const createVideoFromImage = (imagePath, outputPath, durationSeconds, animated) =>
  new Promise((resolve, reject) => {
    const safeDuration = Math.max(1, Math.min(30, durationSeconds));
    const command = ffmpeg(imagePath).inputOptions(['-loop 1']);

    if (animated) {
      command.outputOptions([
        '-t',
        String(safeDuration),
        '-r',
        '30',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0012,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30",
      ]);
    } else {
      command.outputOptions([
        '-t',
        String(safeDuration),
        '-r',
        '30',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      ]);
    }

    command
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error));
  });

const workflowThumbnailFontPath =
  typeof process.env.WORKFLOW_THUMBNAIL_FONT_PATH === 'string' &&
  process.env.WORKFLOW_THUMBNAIL_FONT_PATH.trim()
    ? process.env.WORKFLOW_THUMBNAIL_FONT_PATH.trim()
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const escapeFfmpegDrawtext = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%');

const buildWorkflowHeadline = (prompt, fallbackLabel = '') => {
  const raw = String(prompt || fallbackLabel || '').trim();
  if (!raw) {
    return '';
  }

  const normalized = raw
    .split(/[.!?]/)[0]
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
};

const thumbnailPackStyleFilters = [
  'eq=contrast=1.15:saturation=1.18:brightness=0.03,unsharp=7:7:1.0:7:7:0.0',
  'crop=iw*0.86:ih*0.86:(iw-iw*0.86)/2:(ih-ih*0.86)/2,scale=1280:720,eq=contrast=1.22:saturation=1.25:brightness=0.02,unsharp=7:7:1.1:7:7:0.0',
  'eq=contrast=1.08:saturation=0.94:brightness=0.04,hue=h=-12,unsharp=5:5:0.8:5:5:0.0',
  'eq=contrast=1.2:saturation=1.06:brightness=0.01,vignette=PI/7,unsharp=5:5:0.9:5:5:0.0',
  'eq=contrast=1.1:saturation=1.3:brightness=0.02,hue=h=8,unsharp=7:7:1.0:7:7:0.0',
  'crop=iw*0.92:ih*0.92:(iw-iw*0.92)/2:(ih-ih*0.92)/2,scale=1280:720,eq=contrast=1.18:saturation=1.08:brightness=0.01',
];

const buildThumbnailTextFilters = (headline, variantIndex) => {
  if (!headline) {
    return [];
  }

  const safeHeadline = escapeFfmpegDrawtext(headline);
  const fontFile = fs.existsSync(workflowThumbnailFontPath)
    ? workflowThumbnailFontPath.replace(/\\/g, '/')
    : '';

  if (!fontFile) {
    return [];
  }

  const textLayouts = [
    {
      boxY: 'h-188',
      textY: 'h-134',
    },
    {
      boxY: '46',
      textY: '94',
    },
    {
      boxY: 'h-248',
      textY: 'h-194',
    },
  ];
  const layout = textLayouts[variantIndex % textLayouts.length];

  return [
    `drawbox=x=0:y=${layout.boxY}:w=w:h=142:color=black@0.42:t=fill`,
    `drawtext=fontfile='${fontFile}':text='${safeHeadline}':fontcolor=white:fontsize=68:line_spacing=8:x=(w-text_w)/2:y=${layout.textY}:shadowcolor=black@0.65:shadowx=2:shadowy=2`,
  ];
};

const createThumbnailPackImage = ({ sourcePath, outputPath, variantIndex, headline }) =>
  new Promise((resolve, reject) => {
    const baseFilter = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720';
    const styleFilter = thumbnailPackStyleFilters[variantIndex % thumbnailPackStyleFilters.length];
    const filterChain = [
      baseFilter,
      styleFilter,
      ...buildThumbnailTextFilters(headline, variantIndex),
    ]
      .filter(Boolean)
      .join(',');

    ffmpeg(sourcePath)
      .outputOptions(['-frames:v', '1', '-q:v', '2', '-vf', filterChain])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error));
  });

const waitForDelay = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const inferMimeTypeFromFilename = (filename, fallbackMediaType = 'image') => {
  const extension = path.extname(String(filename || '')).toLowerCase();
  const mimeType = mimeByExtension[extension];
  if (mimeType) {
    return mimeType;
  }
  return fallbackMediaType === 'video' ? 'video/mp4' : 'image/png';
};

const buildComfyApiUrl = (routePath) => {
  if (!comfyBaseUrl) {
    throw new Error('COMFYUI_BASE_URL non configuré');
  }

  const parsedBaseUrl = new URL(comfyBaseUrl);
  const normalizedBasePath = parsedBaseUrl.pathname.replace(/\/+$/g, '');
  const normalizedRoute = String(routePath || '').startsWith('/')
    ? String(routePath)
    : `/${String(routePath || '')}`;
  const pathname = `${normalizedBasePath}${comfyApiPrefix}${normalizedRoute}`.replace(/\/{2,}/g, '/');
  return `${parsedBaseUrl.origin}${pathname}`;
};

const buildComfyHeaders = (headers = {}) => {
  const nextHeaders = { ...headers };
  if (comfyApiKey) {
    nextHeaders['X-API-Key'] = comfyApiKey;
  }
  return nextHeaders;
};

const parseComfyErrorPayload = async (response, fallbackMessage) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      return (
        payload.error ||
        payload.message ||
        payload.detail ||
        payload.reason ||
        fallbackMessage
      );
    }
  } catch {
    try {
      const text = await response.text();
      if (text && text.trim()) {
        return text.trim();
      }
    } catch {
      // Ignore parsing failures and fallback to the provided message.
    }
  }

  return fallbackMessage;
};

const fetchComfyResponse = async (
  routePath,
  { method = 'GET', headers, body, redirect = 'follow', timeoutMs = comfyRequestTimeoutMs } = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(buildComfyApiUrl(routePath), {
      method,
      headers: buildComfyHeaders(headers),
      body,
      redirect,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Timeout ComfyUI (${method} ${routePath})`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchComfyJson = async (routePath, options = {}, fallbackMessage = 'Erreur ComfyUI') => {
  const response = await fetchComfyResponse(routePath, options);
  if (!response.ok) {
    const errorMessage = await parseComfyErrorPayload(response, fallbackMessage);
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Réponse JSON ComfyUI invalide (${routePath})`);
  }
};

const toComfyTemplateEnvToken = (preset) =>
  String(preset || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

const resolveComfyWorkflowTemplateDefinition = (preset) => {
  const envToken = toComfyTemplateEnvToken(preset);
  const inlineJsonKey = `COMFYUI_${envToken}_WORKFLOW_JSON`;
  const filePathKey = `COMFYUI_${envToken}_WORKFLOW_PATH`;
  const inlineJson =
    typeof process.env[inlineJsonKey] === 'string' ? process.env[inlineJsonKey].trim() : '';
  const configuredFilePath =
    typeof process.env[filePathKey] === 'string' ? process.env[filePathKey].trim() : '';
  const defaultFilePath = path.join(comfyWorkflowTemplateDir, `${preset}.api.json`);

  if (inlineJson) {
    return {
      source: `env:${inlineJsonKey}`,
      rawJson: inlineJson,
    };
  }

  if (configuredFilePath) {
    return {
      source: configuredFilePath,
      rawJson: fs.readFileSync(configuredFilePath, 'utf8'),
    };
  }

  if (fs.existsSync(defaultFilePath)) {
    return {
      source: defaultFilePath,
      rawJson: fs.readFileSync(defaultFilePath, 'utf8'),
    };
  }

  return null;
};

const loadComfyWorkflowTemplate = (preset) => {
  const definition = resolveComfyWorkflowTemplateDefinition(preset);
  if (!definition) {
    return null;
  }

  try {
    const parsed = JSON.parse(definition.rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Le template doit être un objet JSON au format API');
    }

    return {
      source: definition.source,
      workflow: parsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON invalide';
    throw new Error(`Template ComfyUI invalide pour ${preset}: ${message}`);
  }
};

const replaceComfyWorkflowPlaceholders = (value, replacements) => {
  if (Array.isArray(value)) {
    return value.map((item) => replaceComfyWorkflowPlaceholders(item, replacements));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        replaceComfyWorkflowPlaceholders(childValue, replacements),
      ])
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (Object.prototype.hasOwnProperty.call(replacements, value)) {
    return replacements[value];
  }

  return Object.entries(replacements).reduce((acc, [token, replacement]) => {
    if (typeof acc !== 'string') {
      return acc;
    }

    if (!acc.includes(token) || typeof replacement !== 'string') {
      return acc;
    }

    return acc.split(token).join(replacement);
  }, value);
};

const pingComfyBackend = async () => {
  if (!comfyBaseUrl) {
    return {
      configured: false,
      reachable: false,
      mode: 'disabled',
      error: 'COMFYUI_BASE_URL non configuré',
    };
  }

  try {
    await fetchComfyJson('/prompt', { method: 'GET', timeoutMs: Math.min(comfyRequestTimeoutMs, 5000) });
    return {
      configured: true,
      reachable: true,
      mode: comfyMode,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      mode: comfyMode,
      error: error instanceof Error ? error.message : 'Backend ComfyUI indisponible',
    };
  }
};

const buildWorkflowCapabilities = async () => {
  let templateError = null;
  let hasThumbnailPackTemplate = false;

  try {
    hasThumbnailPackTemplate = Boolean(resolveComfyWorkflowTemplateDefinition('thumbnail_pack'));
    if (hasThumbnailPackTemplate) {
      loadComfyWorkflowTemplate('thumbnail_pack');
    }
  } catch (error) {
    templateError = error instanceof Error ? error.message : 'Template ComfyUI invalide';
  }

  const comfyStatus = await pingComfyBackend();
  const comfyReady =
    comfyStatus.configured && comfyStatus.reachable && hasThumbnailPackTemplate && !templateError;

  return {
    comfyui: {
      configured: comfyStatus.configured,
      reachable: comfyStatus.reachable,
      mode: comfyStatus.mode,
      readyPresets: comfyReady ? ['thumbnail_pack'] : [],
      error: templateError || comfyStatus.error || null,
    },
    presets: {
      thumbnail_pack: {
        executable: true,
        provider: comfyReady ? 'comfyui' : 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: hasThumbnailPackTemplate && !templateError,
      },
      style_transfer: {
        executable: false,
        provider: 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: false,
      },
      inpaint: {
        executable: false,
        provider: 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: false,
      },
      image_to_video: {
        executable: false,
        provider: 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: false,
      },
      video_upscale: {
        executable: false,
        provider: 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: false,
      },
      batch_variations: {
        executable: false,
        provider: 'server',
        fallbackProvider: 'server',
        comfyTemplateConfigured: false,
      },
    },
  };
};

const uploadImageToComfy = async (sourcePath, sourceLabel = 'workflow-source') => {
  const sourceExtension = path.extname(sourcePath).toLowerCase() || '.png';
  const uploadMimeType = inferMimeTypeFromFilename(sourcePath, 'image');
  const safeBaseName =
    path
      .basename(sourceLabel, path.extname(sourceLabel))
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'workflow-source';
  const uploadFilename = `${safeBaseName}-${Date.now()}${sourceExtension}`;
  const fileBuffer = fs.readFileSync(sourcePath);
  const formData = new FormData();
  formData.append('image', new Blob([fileBuffer], { type: uploadMimeType }), uploadFilename);
  formData.append('type', 'input');
  formData.append('overwrite', 'true');

  const payload = await fetchComfyJson(
    '/upload/image',
    {
      method: 'POST',
      body: formData,
    },
    'Upload image ComfyUI impossible'
  );

  const uploadedName = String(payload?.name || uploadFilename).trim();
  if (!uploadedName) {
    throw new Error('Réponse upload ComfyUI invalide: nom de fichier absent');
  }

  return {
    name: uploadedName,
    subfolder: String(payload?.subfolder || '').trim(),
    type: String(payload?.type || 'input').trim() || 'input',
  };
};

const submitComfyWorkflowPrompt = async (workflowPrompt) => {
  const payload = await fetchComfyJson(
    '/prompt',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: crypto.randomUUID(),
        prompt: workflowPrompt,
      }),
    },
    'Envoi du workflow ComfyUI impossible'
  );

  const promptId = String(payload?.prompt_id || '').trim();
  if (!promptId) {
    throw new Error('Réponse ComfyUI invalide: prompt_id absent');
  }

  return {
    promptId,
    number: payload?.number,
  };
};

const fetchComfyHistoryPayload = async (promptId) => {
  const encodedPromptId = encodeURIComponent(String(promptId || '').trim());
  const candidateRoutes =
    comfyMode === 'cloud'
      ? [`/history_v2/${encodedPromptId}`, `/history/${encodedPromptId}`]
      : [`/history/${encodedPromptId}`];
  let lastError = null;

  for (const routePath of candidateRoutes) {
    const response = await fetchComfyResponse(routePath, {
      method: 'GET',
      timeoutMs: Math.min(comfyRequestTimeoutMs, 10000),
    });

    if (response.ok) {
      const text = await response.text();
      if (!text.trim()) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Réponse history ComfyUI invalide (${routePath})`);
      }
    }

    if ([400, 404, 405].includes(response.status)) {
      lastError = await parseComfyErrorPayload(response, 'History ComfyUI indisponible');
      continue;
    }

    throw new Error(await parseComfyErrorPayload(response, 'History ComfyUI indisponible'));
  }

  if (lastError) {
    throw new Error(lastError);
  }

  return {};
};

const extractComfyHistoryRecord = (historyPayload, promptId) => {
  if (!historyPayload || typeof historyPayload !== 'object' || Array.isArray(historyPayload)) {
    return null;
  }

  if (historyPayload.outputs && typeof historyPayload.outputs === 'object') {
    return historyPayload;
  }

  const directRecord = historyPayload[String(promptId || '').trim()];
  if (directRecord && typeof directRecord === 'object') {
    return directRecord;
  }

  if (
    historyPayload.prompt_id &&
    String(historyPayload.prompt_id).trim() === String(promptId || '').trim()
  ) {
    return historyPayload;
  }

  return null;
};

const extractComfyOutputsFromHistory = (historyPayload, promptId) => {
  const record = extractComfyHistoryRecord(historyPayload, promptId);
  if (!record || !record.outputs || typeof record.outputs !== 'object') {
    return null;
  }
  return record.outputs;
};

const waitForComfyOutputs = async (promptId) => {
  const deadline = Date.now() + comfyJobTimeoutMs;
  let finalStatus = 'queued';

  while (Date.now() < deadline) {
    if (comfyMode === 'cloud') {
      const jobStatusPayload = await fetchComfyJson(
        `/job/${encodeURIComponent(promptId)}/status`,
        {
          method: 'GET',
          timeoutMs: Math.min(comfyRequestTimeoutMs, 10000),
        },
        'Impossible de lire le statut du job ComfyUI'
      );
      finalStatus = String(jobStatusPayload?.status || '').trim() || finalStatus;
      if (['failed', 'cancelled'].includes(finalStatus)) {
        throw new Error(`Job ComfyUI ${finalStatus}`);
      }
    }

    const historyPayload = await fetchComfyHistoryPayload(promptId);
    const outputs = extractComfyOutputsFromHistory(historyPayload, promptId);
    if (outputs && Object.keys(outputs).length > 0) {
      return {
        outputs,
        status: finalStatus || 'completed',
      };
    }

    await waitForDelay(comfyPollIntervalMs);
  }

  throw new Error('Timeout en attente des sorties ComfyUI');
};

const comfyOutputCollections = [
  ['images', 'image'],
  ['image', 'image'],
  ['videos', 'video'],
  ['video', 'video'],
  ['gifs', 'video'],
  ['audio', 'audio'],
];

const collectComfyOutputAssets = (outputsByNode) => {
  const assets = [];

  Object.entries(outputsByNode || {}).forEach(([nodeId, nodeOutputs]) => {
    if (!nodeOutputs || typeof nodeOutputs !== 'object') {
      return;
    }

    comfyOutputCollections.forEach(([collectionKey, mediaType]) => {
      const items = nodeOutputs[collectionKey];
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach((item, itemIndex) => {
        if (!item || typeof item !== 'object' || !item.filename) {
          return;
        }

        assets.push({
          nodeId,
          collectionKey,
          mediaType,
          index: itemIndex,
          filename: String(item.filename).trim(),
          subfolder: String(item.subfolder || '').trim(),
          type: String(item.type || 'output').trim() || 'output',
        });
      });
    });
  });

  return assets;
};

const downloadComfyOutputAsset = async (asset) => {
  const params = new URLSearchParams({
    filename: asset.filename,
    subfolder: asset.subfolder || '',
    type: asset.type || 'output',
  });

  const response = await fetchComfyResponse(`/view?${params.toString()}`, {
    method: 'GET',
    redirect: 'follow',
    timeoutMs: Math.max(comfyRequestTimeoutMs, 60000),
  });

  if (!response.ok) {
    const errorMessage = await parseComfyErrorPayload(
      response,
      `Téléchargement ComfyUI impossible (${asset.filename})`
    );
    throw new Error(errorMessage);
  }

  return Buffer.from(await response.arrayBuffer());
};

const persistWorkflowGeneratedBuffer = async ({
  buffer,
  presetTag,
  sourceFilename,
  originalName,
  tags = [],
  mediaType = 'image',
}) => {
  ensureStorageDirectories();

  const sourceExtension = path.extname(String(sourceFilename || '')).toLowerCase();
  const fallbackExtension = mediaType === 'video' ? '.mp4' : '.png';
  const extension = sourceExtension || fallbackExtension;
  const mimeType = inferMimeTypeFromFilename(sourceFilename || extension, mediaType);
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const storedFilename = `workflow-${presetTag}-${uniqueSuffix}${extension}`;
  const storedPath = path.join(uploadsDir, storedFilename);
  fs.writeFileSync(storedPath, buffer);

  let thumbnailFilename;
  if (mimeType.startsWith('video/')) {
    thumbnailFilename = `${path.parse(storedFilename).name}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    await generateThumbnail(storedPath, thumbnailPath);
  }

  const mediaRecord = createMediaRecord({
    filename: storedFilename,
    originalName: originalName || path.basename(storedFilename),
    mimeType,
    tags,
    thumbnailFilename,
  });

  await persistUploadFiles([
    storedFilename,
    thumbnailFilename ? `thumbnails/${thumbnailFilename}` : null,
  ]);

  return mediaRecord;
};

const executeThumbnailPackLocally = async ({ sourceMedia, prompt, expectedOutputs }) => {
  const cleanupPaths = [];
  const generatedOutputPaths = [];

  try {
    const { sourcePath, cleanupPaths: derivedCleanupPaths } = await resolveWorkflowSourceImage(
      sourceMedia
    );
    cleanupPaths.push(...derivedCleanupPaths);

    if (!sourcePath) {
      throw new Error('Impossible de charger le média source localement');
    }

    const sourceLabel = sourceMedia.metadata?.name || 'media-source';
    const baseLabel = path.parse(sourceLabel).name || 'miniature';
    const headline = buildWorkflowHeadline(prompt, baseLabel);
    const generatedMediaRecords = [];

    await runWithUploadSlot(async () => {
      for (let index = 0; index < expectedOutputs; index += 1) {
        const uniqueSuffix = `${Date.now()}-${index}-${Math.round(Math.random() * 1e9)}`;
        const filename = `workflow-thumbnail-pack-${uniqueSuffix}.jpg`;
        const outputPath = path.join(uploadsDir, filename);
        generatedOutputPaths.push(outputPath);

        await createThumbnailPackImage({
          sourcePath,
          outputPath,
          variantIndex: index,
          headline,
        });

        generatedMediaRecords.push(
          createMediaRecord({
            filename,
            originalName: `${baseLabel} - miniature ${index + 1}.jpg`,
            mimeType: 'image/jpeg',
            tags: [
              'workflow-generated',
              'thumbnail-pack',
              'server-local',
              sourceMedia.metadata?.type === 'video' ? 'from-video' : 'from-image',
            ],
          })
        );
      }
    });

    await persistUploadFiles(generatedMediaRecords.map((record) => record.filename));
    mediaFiles.push(...generatedMediaRecords);
    await saveMediaIndex(mediaFiles);

    cleanupPaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    return {
      provider: 'server',
      engine: 'thumbnail-pack-v1',
      executedAt: new Date().toISOString(),
      outputs: generatedMediaRecords.map(toPublicMediaFile),
    };
  } catch (error) {
    generatedOutputPaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    cleanupPaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    throw error;
  }
};

const executeThumbnailPackWithComfy = async ({
  sourceMedia,
  prompt,
  negativePrompt,
  notes,
  expectedOutputs,
}) => {
  const template = loadComfyWorkflowTemplate('thumbnail_pack');
  if (!template) {
    throw new Error('Aucun template ComfyUI configuré pour thumbnail_pack');
  }

  const { sourcePath, cleanupPaths } = await resolveWorkflowSourceImage(sourceMedia);

  try {
    if (!sourcePath) {
      throw new Error('Impossible de charger le média source localement');
    }

    const sourceLabel = sourceMedia.metadata?.name || 'media-source';
    const baseLabel = path.parse(sourceLabel).name || 'miniature';
    const headline = buildWorkflowHeadline(prompt, baseLabel);
    const uploadedInput = await uploadImageToComfy(sourcePath, sourceLabel);
    const workflowPrompt = replaceComfyWorkflowPlaceholders(template.workflow, {
      __INPUT_IMAGE__: uploadedInput.name,
      __INPUT_IMAGE_NAME__: uploadedInput.name,
      __INPUT_IMAGE_SUBFOLDER__: uploadedInput.subfolder,
      __INPUT_IMAGE_TYPE__: uploadedInput.type,
      __PROMPT__: String(prompt || ''),
      __NEGATIVE_PROMPT__: String(negativePrompt || ''),
      __NOTES__: String(notes || ''),
      __HEADLINE__: String(headline || ''),
      __BATCH_SIZE__: expectedOutputs,
      __OUTPUT_PREFIX__: `amen-workflow-${Date.now()}`,
    });

    const { promptId } = await submitComfyWorkflowPrompt(workflowPrompt);
    const { outputs: outputsByNode } = await waitForComfyOutputs(promptId);
    const collectedAssets = collectComfyOutputAssets(outputsByNode).filter((asset) =>
      ['image', 'video'].includes(asset.mediaType)
    );

    if (collectedAssets.length === 0) {
      throw new Error('ComfyUI a terminé sans produire de média exploitable');
    }

    const limitedAssets = collectedAssets.slice(0, expectedOutputs);
    const generatedMediaRecords = [];

    for (let index = 0; index < limitedAssets.length; index += 1) {
      const asset = limitedAssets[index];
      const outputBuffer = await downloadComfyOutputAsset(asset);
      generatedMediaRecords.push(
        await persistWorkflowGeneratedBuffer({
          buffer: outputBuffer,
          presetTag: 'thumbnail-pack-comfyui',
          sourceFilename: asset.filename,
          originalName: `${baseLabel} - comfy ${index + 1}${path.extname(asset.filename) || ''}`,
          tags: [
            'workflow-generated',
            'thumbnail-pack',
            'comfyui',
            comfyMode === 'cloud' ? 'comfyui-cloud' : 'comfyui-local',
            sourceMedia.metadata?.type === 'video' ? 'from-video' : 'from-image',
          ],
          mediaType: asset.mediaType,
        })
      );
    }

    mediaFiles.push(...generatedMediaRecords);
    await saveMediaIndex(mediaFiles);

    return {
      provider: 'comfyui',
      engine: comfyMode === 'cloud' ? 'cloud' : 'local',
      executedAt: new Date().toISOString(),
      outputs: generatedMediaRecords.map(toPublicMediaFile),
      templateSource: template.source,
      promptId,
    };
  } finally {
    cleanupPaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
};

const resolveMediaFileById = (mediaId) =>
  mediaFiles.find((file) => String(file?.metadata?.id || '').trim() === String(mediaId || '').trim()) ||
  null;

const resolveWorkflowSourceImage = async (mediaFile) => {
  if (!mediaFile) {
    return { sourcePath: null, cleanupPaths: [] };
  }

  if (mediaFile.metadata?.type === 'image') {
    return {
      sourcePath: await ensureLocalFileAvailable(mediaFile.filename),
      cleanupPaths: [],
    };
  }

  if (mediaFile.metadata?.type === 'video') {
    if (mediaFile.thumbnailFilename) {
      const thumbnailPath = await ensureLocalFileAvailable(`thumbnails/${mediaFile.thumbnailFilename}`);
      if (thumbnailPath) {
        return {
          sourcePath: thumbnailPath,
          cleanupPaths: [],
        };
      }
    }

    const localVideoPath = await ensureLocalFileAvailable(mediaFile.filename);
    if (!localVideoPath) {
      return { sourcePath: null, cleanupPaths: [] };
    }

    const tempThumbnailPath = path.join(
      thumbnailsDir,
      `workflow-source-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`
    );
    await generateThumbnail(localVideoPath, tempThumbnailPath);
    return {
      sourcePath: tempThumbnailPath,
      cleanupPaths: [tempThumbnailPath],
    };
  }

  return { sourcePath: null, cleanupPaths: [] };
};

const allowedSoraModels = new Set(['sora-2', 'sora-2-pro']);
const allowedSoraSeconds = [4, 8, 12];
const allowedVideoSizes = new Set(['1280x720', '720x1280', '1792x1024', '1024x1792']);

const pickNearestSoraDuration = (secondsRaw) => {
  const parsed = Number(secondsRaw);
  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return allowedSoraSeconds.reduce((closest, candidate) => {
    return Math.abs(candidate - parsed) < Math.abs(closest - parsed) ? candidate : closest;
  }, allowedSoraSeconds[0]);
};

const normalizeVideoSize = (sizeRaw) => {
  const requested = typeof sizeRaw === 'string' ? sizeRaw.trim() : '';
  if (allowedVideoSizes.has(requested)) {
    return requested;
  }
  return '1280x720';
};

const prepareImageReferenceForVideo = ({ inputPath, outputPath, size }) =>
  new Promise((resolve, reject) => {
    const [width, height] = size.split('x');
    ffmpeg(inputPath)
      .outputOptions([
        '-frames:v 1',
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error));
  });

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseApiErrorMessage = async (response, fallbackMessage) => {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.error || payload?.message || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
};

const createSoraVideoFromImage = async ({
  prompt,
  model,
  seconds,
  size,
  referenceImagePath,
  outputPath,
  apiKey: providedApiKey,
}) => {
  const apiKey = resolveOpenAIApiKey(providedApiKey);

  const imageBuffer = fs.readFileSync(referenceImagePath);
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('model', model);
  formData.append('prompt', prompt);
  formData.append('seconds', String(seconds));
  formData.append('size', size);
  formData.append('input_reference', imageBlob, 'reference.png');

  const createResponse = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!createResponse.ok) {
    const message = await parseApiErrorMessage(
      createResponse,
      'Erreur lors de la création de la vidéo Sora'
    );
    throw new Error(message);
  }

  const createdVideo = await createResponse.json();
  const videoId = createdVideo?.id;
  if (!videoId) {
    throw new Error('Réponse Sora invalide: identifiant vidéo manquant');
  }

  const terminalSuccessStatuses = new Set(['completed', 'succeeded']);
  const terminalFailureStatuses = new Set(['failed', 'cancelled', 'expired']);

  let videoState = createdVideo;
  let status = String(videoState?.status || '').toLowerCase();
  const maxPollAttempts = 120;

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    if (terminalSuccessStatuses.has(status)) {
      break;
    }
    if (terminalFailureStatuses.has(status)) {
      const reason =
        videoState?.error?.message || videoState?.error || 'La génération Sora a échoué';
      throw new Error(reason);
    }

    await delay(2500);
    const statusResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      const message = await parseApiErrorMessage(
        statusResponse,
        'Impossible de récupérer l’état de la génération vidéo'
      );
      throw new Error(message);
    }

    videoState = await statusResponse.json();
    status = String(videoState?.status || '').toLowerCase();
  }

  if (!terminalSuccessStatuses.has(status)) {
    throw new Error('Timeout: la génération vidéo a dépassé le délai');
  }

  const contentResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!contentResponse.ok) {
    const message = await parseApiErrorMessage(
      contentResponse,
      'Impossible de télécharger la vidéo générée'
    );
    throw new Error(message);
  }

  const contentBuffer = Buffer.from(await contentResponse.arrayBuffer());
  fs.writeFileSync(outputPath, contentBuffer);

  return {
    videoId,
    status: videoState?.status || 'completed',
  };
};

const youtubeScopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => sanitizeString(value).toLowerCase();
const authMaxSessionsPerUser = 8;

let cachedAuthUsers = null;
let cachedAuthSessions = null;
let cachedPublishedScenariosIndex = null;
let firebaseAdminAuth = null;
let firebaseAdminInitError = null;

const toPersistentRelativePathFromAbsolute = (absolutePath) => {
  const relativePath = path.relative(uploadsDir, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  return relativePath.split(path.sep).join('/');
};

const readJsonFileWithPersistentFallback = async (absolutePath, fallbackValue) => {
  ensureStorageDirectories();
  if (fs.existsSync(absolutePath)) {
    try {
      const raw = fs.readFileSync(absolutePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed ?? fallbackValue;
    } catch (error) {
      console.warn(`JSON invalide (${absolutePath}):`, error.message);
      return fallbackValue;
    }
  }

  const persistentRelativePath = toPersistentRelativePathFromAbsolute(absolutePath);
  if (!persistentRelativePath) {
    return fallbackValue;
  }

  try {
    const persistedText = await readTextFromPersistentStorage(persistentRelativePath);
    if (!persistedText) {
      return fallbackValue;
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, persistedText, 'utf8');
    const parsed = JSON.parse(persistedText);
    return parsed ?? fallbackValue;
  } catch (error) {
    console.warn(`Impossible de lire ${persistentRelativePath} depuis le stockage persistant:`, error.message);
    return fallbackValue;
  }
};

const writeJsonFileWithPersistentSync = async (absolutePath, payload) => {
  ensureStorageDirectories();
  const jsonPayload = JSON.stringify(payload, null, 2);
  fs.writeFileSync(absolutePath, jsonPayload, 'utf8');

  const persistentRelativePath = toPersistentRelativePathFromAbsolute(absolutePath);
  if (persistentRelativePath) {
    await writeBufferToPersistentStorage(
      persistentRelativePath,
      Buffer.from(jsonPayload, 'utf8'),
      'application/json'
    );
  }
};

const normalizePublishedSlug = (value) =>
  sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const buildPublishedScenarioPath = (slug) => path.join(publishedScenariosDir, `${slug}.json`);

const readPublishedScenariosIndex = async () => {
  if (Array.isArray(cachedPublishedScenariosIndex)) {
    return cachedPublishedScenariosIndex;
  }

  const indexEntries = await readJsonFileWithPersistentFallback(publishedScenariosIndexPath, []);
  cachedPublishedScenariosIndex = Array.isArray(indexEntries) ? indexEntries : [];
  return cachedPublishedScenariosIndex;
};

const savePublishedScenariosIndex = async (entries) => {
  cachedPublishedScenariosIndex = Array.isArray(entries) ? entries : [];
  await writeJsonFileWithPersistentSync(publishedScenariosIndexPath, cachedPublishedScenariosIndex);
};

const readPublishedScenarioRecord = async (slug) => {
  const normalizedSlug = normalizePublishedSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const scenarioPath = buildPublishedScenarioPath(normalizedSlug);
  const scenarioRecord = await readJsonFileWithPersistentFallback(scenarioPath, null);
  if (!scenarioRecord || typeof scenarioRecord !== 'object') {
    return null;
  }

  return scenarioRecord;
};

const findPublishedEntryByIdentifier = (entries, identifier) => {
  if (!Array.isArray(entries)) {
    return null;
  }

  const normalizedIdentifier = normalizePublishedSlug(identifier);
  const rawIdentifier = sanitizeString(identifier);
  if (!normalizedIdentifier && !rawIdentifier) {
    return null;
  }

  const slugMatch =
    normalizedIdentifier &&
    entries.find((entry) => normalizePublishedSlug(entry?.slug) === normalizedIdentifier);
  if (slugMatch) {
    const resolvedSlug = normalizePublishedSlug(slugMatch?.slug) || normalizedIdentifier;
    return {
      entry: slugMatch,
      slug: resolvedSlug,
    };
  }

  const projectMatch =
    rawIdentifier &&
    entries.find((entry) => sanitizeString(entry?.projectId) === rawIdentifier);
  if (!projectMatch) {
    return null;
  }

  const resolvedSlug = normalizePublishedSlug(projectMatch?.slug);
  if (!resolvedSlug) {
    return null;
  }

  return {
    entry: projectMatch,
    slug: resolvedSlug,
  };
};

const savePublishedScenarioRecord = async (slug, record) => {
  const normalizedSlug = normalizePublishedSlug(slug);
  if (!normalizedSlug) {
    throw new Error('Slug de publication invalide');
  }

  await writeJsonFileWithPersistentSync(buildPublishedScenarioPath(normalizedSlug), record);
};

const generatePublishedSlug = (title, entries) => {
  const baseSlug = normalizePublishedSlug(title).slice(0, 54) || 'scenario';
  const existingSlugs = new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizePublishedSlug(entry?.slug))
      .filter(Boolean)
  );

  let candidate = baseSlug;
  if (!existingSlugs.has(candidate)) {
    return candidate;
  }

  let attempts = 0;
  while (attempts < 48) {
    const suffix = crypto.randomBytes(2).toString('hex');
    candidate = `${baseSlug}-${suffix}`;
    if (!existingSlugs.has(candidate)) {
      return candidate;
    }
    attempts += 1;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
};

const buildPublicWatchUrl = (req, slug) => {
  const normalizedSlug = normalizePublishedSlug(slug);
  if (!normalizedSlug) {
    return '/';
  }

  const forwardedProto = sanitizeString(req.headers['x-forwarded-proto']).split(',')[0].trim();
  const protocol = forwardedProto || sanitizeString(req.protocol) || 'https';
  const forwardedHost = sanitizeString(req.headers['x-forwarded-host']).split(',')[0].trim();
  const host = forwardedHost || sanitizeString(req.headers.host);
  const query = `watch=${encodeURIComponent(normalizedSlug)}`;

  if (!host) {
    return `/?${query}`;
  }

  return `${protocol}://${host}/?${query}`;
};

const buildPublicEmbedCode = (watchUrl) =>
  `<iframe src="${watchUrl}" width="1280" height="720" style="border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

const readAuthUsers = async () => {
  if (Array.isArray(cachedAuthUsers)) {
    return cachedAuthUsers;
  }

  const users = await readJsonFileWithPersistentFallback(authUsersPath, []);
  cachedAuthUsers = Array.isArray(users) ? users : [];
  return cachedAuthUsers;
};

const saveAuthUsers = async (users) => {
  cachedAuthUsers = Array.isArray(users) ? users : [];
  await writeJsonFileWithPersistentSync(authUsersPath, cachedAuthUsers);
};

const readAuthSessions = async () => {
  if (Array.isArray(cachedAuthSessions)) {
    return cachedAuthSessions;
  }

  const sessions = await readJsonFileWithPersistentFallback(authSessionsPath, []);
  cachedAuthSessions = Array.isArray(sessions) ? sessions : [];
  return cachedAuthSessions;
};

const saveAuthSessions = async (sessions) => {
  cachedAuthSessions = Array.isArray(sessions) ? sessions : [];
  await writeJsonFileWithPersistentSync(authSessionsPath, cachedAuthSessions);
};

const sanitizeAuthUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role || 'creator',
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null,
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const initFirebaseAdminAuth = () => {
  if (!isFirebaseAuthEnabled) {
    return null;
  }

  if (firebaseAdminAuth) {
    return firebaseAdminAuth;
  }

  if (firebaseAdminInitError) {
    throw firebaseAdminInitError;
  }

  try {
    if (!firebaseAdmin.apps.length) {
      const initConfig = {};
      if (hasFirebaseCredentialFields) {
        initConfig.credential = firebaseAdmin.credential.cert({
          projectId: firebaseProjectId || undefined,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        });
      }
      if (firebaseProjectId) {
        initConfig.projectId = firebaseProjectId;
      }
      firebaseAdmin.initializeApp(initConfig);
    }

    firebaseAdminAuth = firebaseAdmin.auth();
    return firebaseAdminAuth;
  } catch (error) {
    firebaseAdminInitError = error;
    throw error;
  }
};

const verifyFirebaseIdToken = async (idToken) => {
  const auth = initFirebaseAdminAuth();
  if (!auth) {
    throw new Error('Configuration Firebase manquante');
  }

  return auth.verifyIdToken(idToken, true);
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (typeof storedHash !== 'string' || !storedHash.startsWith('scrypt$')) {
    return false;
  }

  const [, salt, hash] = storedHash.split('$');
  if (!salt || !hash) {
    return false;
  }

  const computedHash = crypto.scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(hash, 'hex');
  if (computedHash.length !== expectedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(computedHash, expectedHash);
};

const hashSessionToken = (token) =>
  crypto.createHmac('sha256', authSessionSecret).update(token).digest('hex');

const generateSessionToken = () => crypto.randomBytes(32).toString('hex');

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  cookieHeader.split(';').forEach((part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) {
      return;
    }
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  });

  return cookies;
};

const buildAuthCookieHeader = (token) => {
  const maxAgeSeconds = Math.floor(authSessionTtlMs / 1000);
  return `${authCookieName}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${authCookieSecure ? '; Secure' : ''}`;
};

const clearAuthCookieHeader = () =>
  `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${authCookieSecure ? '; Secure' : ''}`;

const removeExpiredSessions = (sessions) => {
  const now = Date.now();
  return sessions.filter((session) => {
    const expiration = new Date(session.expiresAt).getTime();
    return Number.isFinite(expiration) && expiration > now;
  });
};

const createAuthSession = async (userId, req) => {
  const rawToken = generateSessionToken();
  const now = Date.now();
  const expiresAt = new Date(now + authSessionTtlMs).toISOString();
  const nowIso = new Date(now).toISOString();

  const sessions = removeExpiredSessions(await readAuthSessions()).filter(
    (session) => session.userId !== userId
  );

  sessions.push({
    id: `session_${crypto.randomUUID()}`,
    userId,
    tokenHash: hashSessionToken(rawToken),
    createdAt: nowIso,
    expiresAt,
    userAgent: sanitizeString(req.headers['user-agent']).slice(0, 240),
    ipAddress:
      sanitizeString(req.headers['x-forwarded-for']).split(',')[0].trim() ||
      sanitizeString(req.ip),
  });

  const sessionsByUser = sessions.filter((session) => session.userId === userId);
  if (sessionsByUser.length > authMaxSessionsPerUser) {
    sessionsByUser
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, sessionsByUser.length - authMaxSessionsPerUser)
      .forEach((sessionToDrop) => {
        const indexToDrop = sessions.findIndex((session) => session.id === sessionToDrop.id);
        if (indexToDrop !== -1) {
          sessions.splice(indexToDrop, 1);
        }
      });
  }

  await saveAuthSessions(sessions);
  return { rawToken, expiresAt };
};

const resolveAuthContextFromRequest = async (req) => {
  const token = parseCookies(req.headers.cookie || '')[authCookieName];
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const sessions = await readAuthSessions();
  const activeSessions = removeExpiredSessions(sessions);

  if (activeSessions.length !== sessions.length) {
    await saveAuthSessions(activeSessions);
  }

  const session = activeSessions.find((item) => item.tokenHash === tokenHash);
  if (!session) {
    return null;
  }

  const users = await readAuthUsers();
  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }

  return {
    user,
    session,
  };
};

const requireAuth = async (req, res, next) => {
  try {
    const authContext = await resolveAuthContextFromRequest(req);
    if (!authContext) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    req.auth = authContext;
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Impossible de vérifier la session' });
  }
};

let cachedYoutubeOauthConfig = null;

const sanitizeYoutubeOauthConfig = (rawConfig) => {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return null;
  }
  const clientId = sanitizeString(rawConfig.clientId);
  const clientSecret = sanitizeString(rawConfig.clientSecret);
  const redirectUri = sanitizeString(rawConfig.redirectUri);
  if (!clientId && !clientSecret && !redirectUri) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
  };
};

const loadStoredYoutubeOauthConfig = async () => {
  if (cachedYoutubeOauthConfig) {
    return cachedYoutubeOauthConfig;
  }

  const fileConfig = sanitizeYoutubeOauthConfig(
    await readJsonFileWithPersistentFallback(youtubeConfigPath, null)
  );
  if (fileConfig) {
    cachedYoutubeOauthConfig = fileConfig;
    return fileConfig;
  }

  // Backward compatibility: older deployments stored oauthConfig inside youtube-oauth.json.
  const legacyTokenStore = await readJsonFileWithPersistentFallback(youtubeTokenPath, null);
  const tokenStoreConfig = sanitizeYoutubeOauthConfig(legacyTokenStore?.oauthConfig);
  if (tokenStoreConfig) {
    cachedYoutubeOauthConfig = tokenStoreConfig;
    return tokenStoreConfig;
  }

  return null;
};

const resolveYoutubeOauthConfig = async () => {
  const storedConfig = await loadStoredYoutubeOauthConfig();
  const envConfig = {
    clientId: sanitizeString(process.env.YOUTUBE_CLIENT_ID),
    clientSecret: sanitizeString(process.env.YOUTUBE_CLIENT_SECRET),
    redirectUri: sanitizeString(process.env.YOUTUBE_REDIRECT_URI),
  };

  const clientId = storedConfig?.clientId || envConfig.clientId;
  const clientSecret = storedConfig?.clientSecret || envConfig.clientSecret;
  const redirectUri = storedConfig?.redirectUri || envConfig.redirectUri;

  const hasStoredConfig =
    Boolean(storedConfig?.clientId) || Boolean(storedConfig?.clientSecret) || Boolean(storedConfig?.redirectUri);
  const hasEnvConfig =
    Boolean(envConfig.clientId) || Boolean(envConfig.clientSecret) || Boolean(envConfig.redirectUri);

  let source = 'none';
  if (hasStoredConfig && hasEnvConfig) {
    source = 'mixed';
  } else if (hasStoredConfig) {
    source = 'file';
  } else if (hasEnvConfig) {
    source = 'env';
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    source,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
};

const getPublicYoutubeOauthConfig = async () => {
  const resolved = await resolveYoutubeOauthConfig();
  return {
    configured: resolved.configured,
    source: resolved.source,
    clientId: resolved.clientId || '',
    redirectUri: resolved.redirectUri || '',
    clientSecretSet: Boolean(resolved.clientSecret),
  };
};

const saveStoredYoutubeOauthConfig = async ({ clientId, clientSecret, redirectUri }) => {
  const sanitizedConfig = sanitizeYoutubeOauthConfig({
    clientId,
    clientSecret,
    redirectUri,
  });

  if (!sanitizedConfig) {
    throw new Error('Configuration YouTube vide');
  }

  cachedYoutubeOauthConfig = sanitizedConfig;
  await writeJsonFileWithPersistentSync(youtubeConfigPath, {
    ...sanitizedConfig,
    updatedAt: new Date().toISOString(),
  });
};

const hasYoutubeOauthConfig = async () => (await resolveYoutubeOauthConfig()).configured;

const createYoutubeOauthClient = async () => {
  const resolvedConfig = await resolveYoutubeOauthConfig();
  if (!resolvedConfig.configured) {
    throw new Error(
      'Configuration YouTube manquante: définir YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET et YOUTUBE_REDIRECT_URI'
    );
  }

  return new google.auth.OAuth2(
    resolvedConfig.clientId,
    resolvedConfig.clientSecret,
    resolvedConfig.redirectUri
  );
};

let cachedYoutubeTokenStore = null;

const normalizeYoutubeTokenStore = (rawStore) => {
  if (!rawStore || typeof rawStore !== 'object' || Array.isArray(rawStore)) {
    return { users: {}, oauthConfig: null, updatedAt: null };
  }

  const normalizedOauthConfig = sanitizeYoutubeOauthConfig(rawStore.oauthConfig);

  if (rawStore.users && typeof rawStore.users === 'object' && !Array.isArray(rawStore.users)) {
    return {
      users: rawStore.users,
      oauthConfig: normalizedOauthConfig,
      updatedAt: sanitizeString(rawStore.updatedAt) || null,
    };
  }

  // Backward compatibility: legacy single-token file.
  if (rawStore.refresh_token || rawStore.access_token) {
    return {
      users: {
        legacy: rawStore,
      },
      oauthConfig: normalizedOauthConfig,
      updatedAt: sanitizeString(rawStore.updatedAt) || null,
    };
  }

  return { users: {}, oauthConfig: normalizedOauthConfig, updatedAt: null };
};

const readYoutubeTokenStore = async () => {
  if (cachedYoutubeTokenStore) {
    return cachedYoutubeTokenStore;
  }

  const rawStore = await readJsonFileWithPersistentFallback(youtubeTokenPath, {
    users: {},
    oauthConfig: null,
    updatedAt: null,
  });
  cachedYoutubeTokenStore = normalizeYoutubeTokenStore(rawStore);
  return cachedYoutubeTokenStore;
};

const saveYoutubeTokenStore = async (store) => {
  const normalizedStore = normalizeYoutubeTokenStore(store);
  const payload = {
    ...normalizedStore,
    updatedAt: new Date().toISOString(),
  };
  cachedYoutubeTokenStore = payload;
  await writeJsonFileWithPersistentSync(youtubeTokenPath, payload);
};

const normalizeYoutubeTokenUserKey = (userId) => sanitizeString(userId) || 'legacy';

const loadStoredYoutubeTokensForUser = async (userId) => {
  const refreshTokenFromEnv = sanitizeString(process.env.YOUTUBE_REFRESH_TOKEN);
  if (refreshTokenFromEnv) {
    return { refresh_token: refreshTokenFromEnv };
  }

  const store = await readYoutubeTokenStore();
  const key = normalizeYoutubeTokenUserKey(userId);
  const users = store.users && typeof store.users === 'object' ? store.users : {};

  const scopedTokens = users[key];
  if (scopedTokens && typeof scopedTokens === 'object' && !Array.isArray(scopedTokens)) {
    return scopedTokens;
  }

  const legacyTokens = users.legacy;
  if (legacyTokens && typeof legacyTokens === 'object' && !Array.isArray(legacyTokens)) {
    return legacyTokens;
  }

  return null;
};

const saveYoutubeTokensForUser = async (userId, tokens) => {
  const key = normalizeYoutubeTokenUserKey(userId);
  const store = await readYoutubeTokenStore();
  const users = store.users && typeof store.users === 'object' ? { ...store.users } : {};
  users[key] = {
    ...(tokens || {}),
    updatedAt: new Date().toISOString(),
  };
  await saveYoutubeTokenStore({
    ...store,
    users,
  });
};

const clearYoutubeTokens = async () => {
  const currentStore = await readYoutubeTokenStore();
  await saveYoutubeTokenStore({
    oauthConfig: currentStore.oauthConfig || null,
    users: {},
  });
};

const ensureAnalyticsStorage = () => {
  ensureStorageDirectories();
  if (!fs.existsSync(analyticsDir)) {
    fs.mkdirSync(analyticsDir, { recursive: true });
  }
  if (!fs.existsSync(analyticsEventsPath)) {
    fs.writeFileSync(analyticsEventsPath, '', 'utf8');
  }
};

const analyticsStatsCache = new Map();
const analyticsStatsCacheTtlMs = 30 * 1000;
let analyticsEventsVersion = 0;
let analyticsWriteQueue = Promise.resolve();

const invalidateAnalyticsStatsCache = () => {
  analyticsEventsVersion += 1;
  analyticsStatsCache.clear();
};

const normalizeAnalyticsNumber = (value, { min, max } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  let bounded = parsed;
  if (typeof min === 'number') {
    bounded = Math.max(min, bounded);
  }
  if (typeof max === 'number') {
    bounded = Math.min(max, bounded);
  }
  return bounded;
};

const toEventTimeMs = (event) => {
  const parsed = Date.parse(event?.timestamp || event?.serverTimestamp || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeAnalyticsEvent = (event, req) => {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const eventType = sanitizeString(event.eventType);
  if (!eventType) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const rawTimestamp = sanitizeString(event.timestamp);
  const parsedTimestamp = Date.parse(rawTimestamp);
  const timestampIso = Number.isFinite(parsedTimestamp)
    ? new Date(parsedTimestamp).toISOString()
    : nowIso;

  const metadata =
    event.meta && typeof event.meta === 'object' && !Array.isArray(event.meta) ? event.meta : {};
  let safeMeta = {};
  try {
    const serializedMeta = JSON.stringify(metadata);
    safeMeta = serializedMeta.length <= 4000 ? metadata : { _truncated: true };
  } catch (error) {
    safeMeta = {};
  }

  const userAgent = sanitizeString(req.get('user-agent')).slice(0, 400);

  return {
    id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    eventType,
    timestamp: timestampIso,
    serverTimestamp: nowIso,
    projectId: sanitizeString(event.projectId) || null,
    scenarioVersion: sanitizeString(event.scenarioVersion) || null,
    sessionId: sanitizeString(event.sessionId) || null,
    visitorId: sanitizeString(event.visitorId) || null,
    nodeId: sanitizeString(event.nodeId) || null,
    buttonId: sanitizeString(event.buttonId) || null,
    targetNodeId: sanitizeString(event.targetNodeId) || null,
    source: sanitizeString(event.source) || null,
    durationMs: normalizeAnalyticsNumber(event.durationMs, { min: 0 }),
    playbackTimeSec: normalizeAnalyticsNumber(event.playbackTimeSec, { min: 0 }),
    progressPct: normalizeAnalyticsNumber(event.progressPct, { min: 0, max: 100 }),
    meta: safeMeta,
    userAgent,
  };
};

const appendAnalyticsEvents = async (events, req) => {
  ensureAnalyticsStorage();
  const normalizedEvents = (events || [])
    .map((event) => normalizeAnalyticsEvent(event, req))
    .filter(Boolean);

  if (normalizedEvents.length === 0) {
    return [];
  }

  const payload = normalizedEvents.map((event) => JSON.stringify(event)).join('\n') + '\n';
  const writePromise = analyticsWriteQueue.then(() =>
    fs.promises.appendFile(analyticsEventsPath, payload, 'utf8')
  );
  analyticsWriteQueue = writePromise.catch((error) => {
    console.error('Erreur écriture analytics:', error);
  });
  await writePromise;
  invalidateAnalyticsStatsCache();
  return normalizedEvents;
};

const readAnalyticsEvents = async ({ projectId, from, to, limit } = {}) => {
  ensureAnalyticsStorage();
  if (!fs.existsSync(analyticsEventsPath)) {
    return [];
  }

  const raw = await fs.promises.readFile(analyticsEventsPath, 'utf8');
  if (!raw.trim()) {
    return [];
  }

  let lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const safeLimit = Number(limit);
  if (Number.isFinite(safeLimit) && safeLimit > 0) {
    lines = lines.slice(-Math.min(50000, Math.round(safeLimit)));
  }

  const parsed = [];
  lines.forEach((line) => {
    try {
      const event = JSON.parse(line);
      if (event && typeof event === 'object') {
        parsed.push(event);
      }
    } catch (error) {
      // ignore malformed lines
    }
  });

  const projectIdFilter = sanitizeString(projectId);
  const fromMs = Number.isFinite(Date.parse(sanitizeString(from)))
    ? Date.parse(sanitizeString(from))
    : null;
  const toMs = Number.isFinite(Date.parse(sanitizeString(to))) ? Date.parse(sanitizeString(to)) : null;

  return parsed.filter((event) => {
    if (projectIdFilter && event.projectId !== projectIdFilter) {
      return false;
    }
    const eventMs = toEventTimeMs(event);
    if (fromMs !== null && eventMs < fromMs) {
      return false;
    }
    if (toMs !== null && eventMs > toMs) {
      return false;
    }
    return true;
  });
};

const getAnalyticsStatsCacheKey = ({ projectId, from, to }) =>
  JSON.stringify({
    projectId: sanitizeString(projectId) || null,
    from: sanitizeString(from) || null,
    to: sanitizeString(to) || null,
  });

const getAnalyticsStatsCached = async ({ projectId, from, to }) => {
  const key = getAnalyticsStatsCacheKey({ projectId, from, to });
  const now = Date.now();
  const cached = analyticsStatsCache.get(key);

  if (
    cached &&
    cached.version === analyticsEventsVersion &&
    now - cached.createdAt <= analyticsStatsCacheTtlMs
  ) {
    return cached.stats;
  }

  const events = await readAnalyticsEvents({ projectId, from, to, limit: 50000 });
  const stats = aggregateAnalyticsStats(events);
  analyticsStatsCache.set(key, {
    createdAt: now,
    version: analyticsEventsVersion,
    stats,
  });
  return stats;
};

const aggregateAnalyticsStats = (events) => {
  const sortedEvents = [...events].sort((first, second) => toEventTimeMs(first) - toEventTimeMs(second));
  const eventTypeCounts = {};
  const nodeEntryCounts = {};
  const pathBySession = new Map();
  const lastNodeBySession = new Map();
  const choiceByKey = new Map();
  const startedSessions = new Set();
  const endedSessions = new Set();
  const completedSessions = new Set();
  const uniqueVisitors = new Set();

  let videoStarts = 0;
  let videoCompletions = 0;
  let menusShown = 0;
  let choiceClicks = 0;
  let conversions = 0;

  sortedEvents.forEach((event) => {
    const eventType = sanitizeString(event.eventType);
    if (!eventType) {
      return;
    }

    eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;

    if (event.visitorId) {
      uniqueVisitors.add(event.visitorId);
    }

    if (event.sessionId && eventType === 'session_start') {
      startedSessions.add(event.sessionId);
    }
    if (event.sessionId && eventType === 'session_end') {
      endedSessions.add(event.sessionId);
    }
    if (event.sessionId && (eventType === 'scenario_complete' || eventType === 'conversion')) {
      completedSessions.add(event.sessionId);
    }

    if (eventType === 'node_enter' && event.nodeId) {
      nodeEntryCounts[event.nodeId] = (nodeEntryCounts[event.nodeId] || 0) + 1;

      if (event.sessionId) {
        const sessionPath = pathBySession.get(event.sessionId) || [];
        if (sessionPath[sessionPath.length - 1] !== event.nodeId) {
          sessionPath.push(event.nodeId);
          pathBySession.set(event.sessionId, sessionPath);
        }
        lastNodeBySession.set(event.sessionId, event.nodeId);
      }
    }

    if (eventType === 'video_start') {
      videoStarts += 1;
    }
    if (eventType === 'video_complete') {
      videoCompletions += 1;
    }
    if (eventType === 'menu_shown') {
      menusShown += 1;
    }
    if (eventType === 'choice_click') {
      choiceClicks += 1;
      const choiceKey = `${event.buttonId || 'unknown'}|${event.targetNodeId || 'unknown'}|${event.nodeId || 'unknown'}`;
      const current = choiceByKey.get(choiceKey) || {
        buttonId: event.buttonId || null,
        targetNodeId: event.targetNodeId || null,
        nodeId: event.nodeId || null,
        label: sanitizeString(event.meta?.label) || null,
        count: 0,
      };
      current.count += 1;
      choiceByKey.set(choiceKey, current);
    }
    if (eventType === 'conversion') {
      conversions += 1;
    }
  });

  const pathCounts = new Map();
  pathBySession.forEach((pathItems) => {
    if (!Array.isArray(pathItems) || pathItems.length === 0) {
      return;
    }
    const key = pathItems.join(' > ');
    pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
  });

  const dropOffByNode = {};
  startedSessions.forEach((sessionId) => {
    if (!endedSessions.has(sessionId) || completedSessions.has(sessionId)) {
      return;
    }
    const lastNodeId = lastNodeBySession.get(sessionId);
    if (!lastNodeId) {
      return;
    }
    dropOffByNode[lastNodeId] = (dropOffByNode[lastNodeId] || 0) + 1;
  });

  const toSortedArray = (input, keyLabel) =>
    Object.entries(input)
      .map(([key, count]) => ({ [keyLabel]: key, count }))
      .sort((first, second) => second.count - first.count);

  const startedCount = startedSessions.size;
  const endedCount = endedSessions.size;
  const completedCount = completedSessions.size;

  const round = (value) => Math.round(value * 100) / 100;
  const videoCompletionRatePct =
    videoStarts > 0 ? round((videoCompletions / videoStarts) * 100) : 0;
  const sessionCompletionRatePct =
    startedCount > 0 ? round((completedCount / startedCount) * 100) : 0;

  const topPaths = Array.from(pathCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((first, second) => second.count - first.count)
    .slice(0, 12);

  const topChoices = Array.from(choiceByKey.values())
    .sort((first, second) => second.count - first.count)
    .slice(0, 20);

  return {
    totalEvents: sortedEvents.length,
    sessions: {
      started: startedCount,
      ended: endedCount,
      active: Math.max(0, startedCount - endedCount),
      completed: completedCount,
      uniqueVisitors: uniqueVisitors.size,
      completionRatePct: sessionCompletionRatePct,
    },
    engagement: {
      videoStarts,
      videoCompletions,
      videoCompletionRatePct,
      menusShown,
      choiceClicks,
      conversions,
    },
    topNodes: toSortedArray(nodeEntryCounts, 'nodeId').slice(0, 20),
    topChoices,
    topPaths,
    dropOffNodes: toSortedArray(dropOffByNode, 'nodeId').slice(0, 20),
    eventTypeBreakdown: toSortedArray(eventTypeCounts, 'eventType'),
  };
};

const getAuthorizedYoutubeClient = async (userId) => {
  const normalizedUserId = sanitizeString(userId);
  if (!normalizedUserId) {
    throw new Error('Utilisateur non authentifié pour YouTube');
  }

  const oauthClient = await createYoutubeOauthClient();
  const storedTokens = await loadStoredYoutubeTokensForUser(normalizedUserId);

  if (!storedTokens || (!storedTokens.refresh_token && !storedTokens.access_token)) {
    throw new Error('Non connecté à YouTube. Lancez /api/youtube/auth/url puis validez la connexion');
  }

  oauthClient.setCredentials(storedTokens);
  await oauthClient.getAccessToken();

  const mergedTokens = {
    ...storedTokens,
    ...oauthClient.credentials,
    refresh_token:
      oauthClient.credentials.refresh_token ||
      storedTokens.refresh_token ||
      process.env.YOUTUBE_REFRESH_TOKEN,
  };

  if (mergedTokens.refresh_token || mergedTokens.access_token) {
    await saveYoutubeTokensForUser(normalizedUserId, mergedTokens);
  }

  return oauthClient;
};

const youtubeUploadJobs = new Map();
const youtubeUploadJobRetentionLimit = 120;

const pruneYoutubeUploadJobs = () => {
  if (youtubeUploadJobs.size <= youtubeUploadJobRetentionLimit) {
    return;
  }

  const jobsSorted = Array.from(youtubeUploadJobs.values()).sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );

  const excess = jobsSorted.length - youtubeUploadJobRetentionLimit;
  for (let index = 0; index < excess; index += 1) {
    const jobToDelete = jobsSorted[index];
    if (jobToDelete?.id) {
      youtubeUploadJobs.delete(jobToDelete.id);
    }
  }
};

const setYoutubeUploadJob = (job) => {
  youtubeUploadJobs.set(job.id, job);
  pruneYoutubeUploadJobs();
  return job;
};

const patchYoutubeUploadJob = (jobId, updates) => {
  const currentJob = youtubeUploadJobs.get(jobId);
  if (!currentJob) {
    return null;
  }

  const nextJob = {
    ...currentJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  youtubeUploadJobs.set(jobId, nextJob);
  return nextJob;
};

const toYoutubeUploadJobResponse = (job) => ({
  jobId: job.id,
  status: job.status,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  error: job.error || null,
  result: job.result || null,
});

const buildYoutubeEndScreenPlan = ({ uploadMode, scenarioPlan, uploadedVideos }) => {
  if (
    uploadMode !== 'scenario' ||
    !Array.isArray(scenarioPlan) ||
    scenarioPlan.length === 0 ||
    !Array.isArray(uploadedVideos) ||
    uploadedVideos.length === 0
  ) {
    return [];
  }

  const videosByNodeId = new Map();
  uploadedVideos.forEach((video) => {
    const nodeId = sanitizeString(video?.nodeId);
    const kind = sanitizeString(video?.kind || 'main');
    if (nodeId && kind === 'main') {
      videosByNodeId.set(nodeId, video);
    }
  });

  const endScreenPlan = [];

  scenarioPlan.forEach((segment) => {
    const sourceNodeId = sanitizeString(segment?.nodeId);
    if (!sourceNodeId) {
      return;
    }

    const sourceVideo = videosByNodeId.get(sourceNodeId);
    if (!sourceVideo?.id) {
      return;
    }

    const nextNodeIds = Array.isArray(segment?.nextVideoNodeIds) ? segment.nextVideoNodeIds : [];
    const seenTargets = new Set();
    const targets = [];

    nextNodeIds.forEach((targetNodeIdRaw) => {
      const targetNodeId = sanitizeString(targetNodeIdRaw);
      if (!targetNodeId || targetNodeId === sourceNodeId || seenTargets.has(targetNodeId)) {
        return;
      }
      seenTargets.add(targetNodeId);

      const targetVideo = videosByNodeId.get(targetNodeId);
      if (!targetVideo?.id) {
        return;
      }

      targets.push({
        targetNodeId,
        targetLabel: sanitizeString(targetVideo?.title) || targetNodeId,
        targetVideoId: sanitizeString(targetVideo?.id) || null,
        targetUrl: sanitizeString(targetVideo?.url) || null,
        targetStudioUrl: sanitizeString(targetVideo?.studioUrl) || null,
      });
    });

    if (targets.length === 0) {
      return;
    }

    endScreenPlan.push({
      sourceNodeId,
      sourceLabel: sanitizeString(segment?.label) || sourceNodeId,
      sourceVideoId: sanitizeString(sourceVideo?.id) || null,
      sourceUrl: sanitizeString(sourceVideo?.url) || null,
      sourceStudioUrl: sanitizeString(sourceVideo?.studioUrl) || null,
      recommendedStartFromEndSeconds: 20,
      totalTargets: targets.length,
      targets: targets.slice(0, 4),
    });
  });

  return endScreenPlan;
};

const executeYoutubeUpload = async ({ authClient, payload }) => {
  const temporaryFiles = [];
  let companionCtaApplied = false;
  let companionCtaMode = null;
  let companionCtaError = null;
  let companionVideoUploadError = null;
  let uploadLimitExceeded = false;
  let uploadLimitMessage = null;

  try {
    const title =
      typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : `Export interactif ${new Date().toISOString().slice(0, 10)}`;
    const description = typeof payload?.description === 'string' ? payload.description.trim() : '';
    const privacyStatus = normalizePrivacyStatus(
      typeof payload?.privacyStatus === 'string' ? payload.privacyStatus.trim() : ''
    );
    const companionUrl = sanitizeCompanionUrl(payload?.companionUrl || payload?.interactiveUrl);
    const companionCtaText = normalizeYoutubeOverlayText(payload?.companionCtaText, {
      fallback: 'Version interactive',
      maxLength: 64,
    });
    const includeCompanionCta = payload?.includeCompanionCta !== false && Boolean(companionUrl);
    const tags = Array.isArray(payload?.tags)
      ? payload.tags.filter((tag) => typeof tag === 'string' && tag.trim())
      : [];

    const preparedUploads = [];
    let uploadMode = 'media';
    let segmentCount = 1;
    let exportedNodeIds = [];
    let scenarioExportPlan = [];

    const scenario = payload?.scenario;
    const hasScenarioPayload =
      scenario &&
      typeof scenario === 'object' &&
      Array.isArray(scenario.nodes) &&
      Array.isArray(scenario.edges);

    if (hasScenarioPayload) {
      const exportPlan = buildScenarioExportPlan({
        scenario,
        startNodeId: payload?.startNodeId,
        maxSegments: payload?.maxSegments,
      });
      scenarioExportPlan = exportPlan;
      uploadMode = 'scenario';
      segmentCount = exportPlan.length;
      exportedNodeIds = exportPlan.map((item) => item.nodeId);

      for (let index = 0; index < exportPlan.length; index += 1) {
        const segment = exportPlan[index];
        const inputPath = await resolveUploadPathFromUrl(segment.videoUrl);
        if (!inputPath || !fs.existsSync(inputPath)) {
          throw new Error(`Vidéo locale introuvable pour le node ${segment.nodeId}`);
        }

        const outputPath = path.join(
          exportsDir,
          `youtube-scenario-${Date.now()}-${Math.round(Math.random() * 1e6)}-${index}.mp4`
        );
        const durationSeconds =
          typeof segment.mediaOut === 'number'
            ? Math.max(0.1, segment.mediaOut - segment.mediaIn)
            : undefined;

        await transcodeVideoForYoutube({
          inputPath,
          outputPath,
          startAt: segment.mediaIn,
          durationSeconds,
          menuOptions: segment.menuOptions,
        });
        temporaryFiles.push(outputPath);
        preparedUploads.push({
          filePath: outputPath,
          nodeId: segment.nodeId,
          label: segment.label || segment.nodeId,
        });
      }
    } else {
      let mediaUrl = typeof payload?.mediaUrl === 'string' ? payload.mediaUrl.trim() : '';

      if (!mediaUrl && typeof payload?.mediaId === 'string' && payload.mediaId.trim()) {
        const mediaEntry = mediaFiles.find((item) => item.metadata.id === payload.mediaId.trim());
        if (mediaEntry) {
          mediaUrl = `/uploads/${mediaEntry.filename}`;
        }
      }

      if (!mediaUrl) {
        throw new Error('Payload invalide: fournir mediaUrl, mediaId ou scenario');
      }

      const inputPath = await resolveUploadPathFromUrl(mediaUrl);
      if (!inputPath || !fs.existsSync(inputPath)) {
        throw new Error('Impossible de résoudre un fichier vidéo local depuis mediaUrl');
      }

      const outputPath = path.join(
        exportsDir,
        `youtube-media-${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`
      );
      await transcodeVideoForYoutube({ inputPath, outputPath });
      temporaryFiles.push(outputPath);
      preparedUploads.push({
        filePath: outputPath,
        nodeId: null,
        label: title,
      });
    }

    if (preparedUploads.length === 0) {
      throw new Error('Préparation vidéo impossible avant upload YouTube');
    }

    const uploadedVideos = [];
    for (let index = 0; index < preparedUploads.length; index += 1) {
      const prepared = preparedUploads[index];
      if (!prepared.filePath || !fs.existsSync(prepared.filePath)) {
        throw new Error(`Vidéo préparée introuvable avant upload (index ${index + 1})`);
      }

      const titleSuffix =
        preparedUploads.length > 1
          ? ` • ${index + 1}/${preparedUploads.length}${prepared.label ? ` • ${sanitizeString(prepared.label).slice(0, 42)}` : ''}`
          : '';
      const uploadTitle = `${title}${titleSuffix}`.slice(0, 100) || title.slice(0, 100);
      try {
        const uploadResult = await uploadVideoToYoutube({
          authClient,
          filePath: prepared.filePath,
          title: uploadTitle,
          description,
          privacyStatus,
          tags,
        });
        uploadedVideos.push({
          kind: 'main',
          nodeId: prepared.nodeId || null,
          ...uploadResult,
        });
      } catch (error) {
        const youtubeError = classifyYoutubeUploadError(error);
        if (!youtubeError.isUploadLimitExceeded) {
          throw error;
        }

        uploadLimitExceeded = true;
        uploadLimitMessage = toYoutubeUploadLimitMessage(youtubeError);
        console.warn(`YouTube upload limité pour cet export: ${uploadLimitMessage}`);

        if (uploadedVideos.length === 0) {
          throw new Error(uploadLimitMessage);
        }
        break;
      }
    }

    if (uploadedVideos.length === 0) {
      throw new Error('Upload YouTube impossible: aucune vidéo envoyée');
    }

    const requestedUploads = preparedUploads.length;
    const completedUploads = uploadedVideos.length;
    const partialUpload = completedUploads < requestedUploads;
    const uploadWarnings = [];
    if (uploadLimitExceeded) {
      uploadWarnings.push(
        uploadLimitMessage || 'Limite YouTube atteinte: export partiel, certaines vidéos non envoyées.'
      );
    }

    const mainUploadResult = uploadedVideos[0];
    let companionVideo = null;

    if (includeCompanionCta && companionUrl && !uploadLimitExceeded) {
      const companionSourcePath = preparedUploads[0]?.filePath;
      if (!companionSourcePath || !fs.existsSync(companionSourcePath)) {
        companionCtaApplied = false;
        companionCtaMode = 'failed';
        companionCtaError = 'Impossible de créer la vidéo CTA: source vidéo introuvable';
      } else {
        const ctaOutputPath = path.join(
          exportsDir,
          `youtube-companion-${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`
        );
        try {
          const ctaResult = await applyYoutubeCompanionCtaOverlay({
            inputPath: companionSourcePath,
            outputPath: ctaOutputPath,
            companionUrl,
            companionCtaText,
          });
          temporaryFiles.push(ctaOutputPath);
          companionCtaApplied = Boolean(ctaResult.applied);
          companionCtaMode = ctaResult.mode || null;

          const companionUploadTitle = `${title} • CTA version interactive`;
          const companionUploadResult = await uploadVideoToYoutube({
            authClient,
            filePath: ctaResult.outputPath,
            title: companionUploadTitle,
            description: description || `Version interactive: ${companionUrl}`,
            privacyStatus,
            tags,
          });
          companionVideo = {
            kind: 'companion_cta',
            nodeId: null,
            ...companionUploadResult,
          };
          uploadedVideos.push(companionVideo);
        } catch (error) {
          companionCtaApplied = false;
          companionCtaMode = 'failed';
          companionCtaError = error?.message || 'CTA YouTube non appliqué';
          companionVideoUploadError = companionCtaError;
          console.warn(`CTA YouTube désactivé pour cet export: ${companionCtaError}`);
          try {
            if (fs.existsSync(ctaOutputPath)) {
              fs.unlinkSync(ctaOutputPath);
            }
          } catch (cleanupError) {
            console.warn(
              'CTA YouTube: impossible de supprimer la sortie CTA partielle:',
              cleanupError?.message || cleanupError
            );
          }
        }
      }
    } else if (includeCompanionCta && companionUrl && uploadLimitExceeded) {
      companionCtaApplied = false;
      companionCtaMode = 'failed';
      companionCtaError =
        uploadLimitMessage || 'CTA YouTube ignoré: limite d’upload atteinte sur le compte.';
      companionVideoUploadError = companionCtaError;
    }

    const endScreenPlan = buildYoutubeEndScreenPlan({
      uploadMode,
      scenarioPlan: scenarioExportPlan,
      uploadedVideos,
    });

    return {
      ...mainUploadResult,
      mode: uploadMode,
      segments: segmentCount,
      pathNodeIds: exportedNodeIds,
      companionUrl: companionUrl || null,
      companionCtaText,
      companionCtaApplied,
      companionCtaMode,
      companionCtaError,
      companionVideoUploadError,
      companionVideo,
      partialUpload,
      uploadLimitExceeded,
      requestedUploads,
      completedUploads,
      uploadWarnings,
      videos: uploadedVideos,
      endScreenPlan,
    };
  } finally {
    cleanupTemporaryFiles(temporaryFiles);
  }
};

const runYoutubeUploadJob = async ({ jobId, userId, payload }) => {
  patchYoutubeUploadJob(jobId, {
    status: 'processing',
    error: null,
  });

  try {
    const authClient = await getAuthorizedYoutubeClient(userId);
    const uploadResult = await executeYoutubeUpload({ authClient, payload });
    patchYoutubeUploadJob(jobId, {
      status: 'completed',
      result: uploadResult,
      error: null,
    });
  } catch (error) {
    patchYoutubeUploadJob(jobId, {
      status: 'failed',
      result: null,
      error: error?.message || 'Upload YouTube impossible',
    });
  }
};

const cleanupTemporaryFiles = (paths) => {
  const uniquePaths = Array.from(new Set((paths || []).filter(Boolean)));
  uniquePaths.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Impossible de supprimer le fichier temporaire ${filePath}:`, error.message);
    }
  });
};

const resolveUploadPathFromUrl = async (rawUrl) => {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return null;
  }

  const input = rawUrl.trim();
  let pathname = '';

  if (input.startsWith('/uploads/')) {
    pathname = input;
  } else {
    try {
      const parsed = new URL(input);
      pathname = parsed.pathname;
    } catch (error) {
      return null;
    }
  }

  if (!pathname.startsWith('/uploads/')) {
    return null;
  }

  const relativePart = decodeURIComponent(pathname.replace('/uploads/', ''));
  const safeRelativePath = toSafeRelativePath(relativePart);
  if (!safeRelativePath) {
    return null;
  }

  return ensureLocalFileAvailable(safeRelativePath);
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const youtubeButtonDefaultStyle = {
  backgroundColor: '#2196f3',
  textColor: '#ffffff',
  fontSize: '14px',
  borderStyle: 'none',
  borderColor: '#000000',
  borderWidth: '1px',
  padding: '8px 16px',
  positionMode: 'flow',
  positionX: 24,
  positionY: 24,
  horizontalAlign: 'center',
  verticalAlign: 'bottom',
};

const youtubeButtonSizePresets = {
  small: { fontSize: 13, paddingY: 4, paddingX: 10, minWidth: 96, minHeight: 30 },
  medium: { fontSize: 14, paddingY: 8, paddingX: 16, minWidth: 120, minHeight: 38 },
  large: { fontSize: 16, paddingY: 12, paddingX: 24, minWidth: 148, minHeight: 48 },
};

const youtubeClamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parsePixelNumber = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePaddingShorthand = (value, fallbackY, fallbackX) => {
  if (typeof value !== 'string' || !value.trim()) {
    return { top: fallbackY, right: fallbackX, bottom: fallbackY, left: fallbackX };
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => parsePixelNumber(part, NaN))
    .filter((part) => Number.isFinite(part));

  if (parts.length === 0) {
    return { top: fallbackY, right: fallbackX, bottom: fallbackY, left: fallbackX };
  }
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  }
  if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  }
  if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  }
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
};

const parseCssColorToRgba = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const input = value.trim().toLowerCase();
  const named = {
    white: { r: 255, g: 255, b: 255, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    transparent: { r: 0, g: 0, b: 0, a: 0 },
  };
  if (named[input]) {
    return named[input];
  }

  const hexMatch = input.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  const rgbMatch = input.match(
    /^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+))?\s*\)$/
  );
  if (rgbMatch) {
    const r = youtubeClamp(Math.round(Number(rgbMatch[1])), 0, 255);
    const g = youtubeClamp(Math.round(Number(rgbMatch[2])), 0, 255);
    const b = youtubeClamp(Math.round(Number(rgbMatch[3])), 0, 255);
    const a =
      rgbMatch[4] !== undefined
        ? youtubeClamp(Number.parseFloat(rgbMatch[4]) || 0, 0, 1)
        : 1;
    return { r, g, b, a };
  }

  return null;
};

const toFfmpegColor = (value, fallback = '#ffffff', alphaMultiplier = 1) => {
  const rgba = parseCssColorToRgba(value) || parseCssColorToRgba(fallback) || { r: 255, g: 255, b: 255, a: 1 };
  const alpha = youtubeClamp((rgba.a ?? 1) * alphaMultiplier, 0, 1);
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `0x${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}@${alpha.toFixed(3)}`;
};

const buildScenarioGraph = (scenario) => {
  const nodes = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
  const edges = Array.isArray(scenario?.edges) ? scenario.edges : [];
  const nodeById = new Map();
  const outgoing = new Map();
  const incoming = new Map();

  nodes.forEach((node) => {
    if (node?.id) {
      nodeById.set(node.id, node);
    }
  });

  edges.forEach((edge) => {
    if (!edge?.source || !edge?.target) {
      return;
    }
    const out = outgoing.get(edge.source) || [];
    out.push(edge);
    outgoing.set(edge.source, out);

    const inc = incoming.get(edge.target) || [];
    inc.push(edge);
    incoming.set(edge.target, inc);
  });

  return { nodes, edges, nodeById, outgoing, incoming };
};

const isPlayableVideoNode = (node) =>
  node &&
  node.type === 'video' &&
  node.data &&
  typeof node.data.videoUrl === 'string' &&
  node.data.videoUrl.trim().length > 0;

const resolveNodeToVideoTargets = (startNodeId, graph, maxVisits = 256) => {
  if (!startNodeId) {
    return [];
  }

  const visited = new Set();
  const queued = new Set([startNodeId]);
  const queue = [startNodeId];
  const resolved = [];
  const seenResolved = new Set();

  while (queue.length > 0 && visited.size < maxVisits) {
    const nodeId = queue.shift();
    queued.delete(nodeId);
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const node = graph.nodeById.get(nodeId);
    if (!node) {
      continue;
    }

    if (isPlayableVideoNode(node)) {
      if (!seenResolved.has(node.id)) {
        seenResolved.add(node.id);
        resolved.push(node.id);
      }
      continue;
    }

    if (node.type === 'workflow') {
      continue;
    }

    if (node.type === 'button') {
      const buttonData = node.data || {};
      if (
        buttonData.targetNodeId &&
        !visited.has(buttonData.targetNodeId) &&
        !queued.has(buttonData.targetNodeId)
      ) {
        queue.push(buttonData.targetNodeId);
        queued.add(buttonData.targetNodeId);
      }
    }

    const outgoing = graph.outgoing.get(nodeId) || [];
    outgoing.forEach((edge) => {
      if (!visited.has(edge.target) && !queued.has(edge.target)) {
        queue.push(edge.target);
        queued.add(edge.target);
      }
    });
  }

  return resolved;
};

const resolveButtonTargetVideoId = (buttonNodeId, graph) => {
  const buttonNode = graph.nodeById.get(buttonNodeId);
  if (!buttonNode || buttonNode.type !== 'button') {
    return undefined;
  }

  return resolveNodeToVideoTargets(buttonNodeId, graph)[0];
};

const resolveScenarioMenuOptions = (videoNodeId, graph, config = {}) => {
  const includeSingleDirectChoice = config.includeSingleDirectChoice === true;
  const outgoing = graph.outgoing.get(videoNodeId) || [];
  const menuOptions = [];
  const directVideoTargets = [];
  const seenKeys = new Set();

  outgoing.forEach((edge) => {
    const targetNode = graph.nodeById.get(edge.target);
    if (!targetNode) {
      return;
    }

    if (targetNode.type === 'button') {
      const buttonData = targetNode.data || {};
      const targetVideoNodeId = resolveButtonTargetVideoId(targetNode.id, graph);
      if (!targetVideoNodeId) {
        return;
      }

      const key = `button:${targetNode.id}:${targetVideoNodeId}`;
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);

      menuOptions.push({
        id: targetNode.id,
        label: buttonData.text || buttonData.label || 'Continuer',
        targetVideoNodeId,
        style: buttonData.style,
        variant: buttonData.variant,
        size: buttonData.size,
      });
      return;
    }

    const reachableVideoTargets = resolveNodeToVideoTargets(targetNode.id, graph);
    if (reachableVideoTargets.length === 0) {
      return;
    }

    const labelHint =
      targetNode.type === 'group'
        ? (targetNode.data?.label || '').trim() || undefined
        : undefined;

    reachableVideoTargets.forEach((resolvedVideoNodeId) => {
      const key = `direct:${targetNode.id}:${resolvedVideoNodeId}`;
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      directVideoTargets.push({
        videoNodeId: resolvedVideoNodeId,
        ...(reachableVideoTargets.length === 1 && labelHint ? { labelHint } : {}),
      });
    });
  });

  const currentNode = graph.nodeById.get(videoNodeId);
  const legacyButtons = Array.isArray(currentNode?.data?.buttons) ? currentNode.data.buttons : [];
  legacyButtons.forEach((button) => {
    if (!button?.targetNodeId) {
      return;
    }

    const targetVideoNodeId = resolveNodeToVideoTargets(button.targetNodeId, graph)[0];
    if (!targetVideoNodeId) {
      return;
    }

    const key = `legacy:${button.id}:${targetVideoNodeId}`;
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);

    menuOptions.push({
      id: button.id,
      label: button.buttonText || button.label || 'Continuer',
      targetVideoNodeId,
    });
  });

  if (menuOptions.length > 0) {
    return menuOptions;
  }

  if (directVideoTargets.length > 1 || (includeSingleDirectChoice && directVideoTargets.length === 1)) {
    const labelHintCounts = directVideoTargets.reduce((acc, target) => {
      if (target.labelHint) {
        acc[target.labelHint] = (acc[target.labelHint] || 0) + 1;
      }
      return acc;
    }, {});

    return directVideoTargets.map((target, index) => {
      const targetNode = graph.nodeById.get(target.videoNodeId);
      const canUseLabelHint =
        Boolean(target.labelHint) && Boolean(target.labelHint && labelHintCounts[target.labelHint] === 1);
      return {
        id: `direct-${videoNodeId}-${target.videoNodeId}`,
        label:
          (canUseLabelHint ? target.labelHint : undefined) ||
          targetNode?.data?.label ||
          `Choix ${index + 1}`,
        targetVideoNodeId: target.videoNodeId,
      };
    });
  }

  return [];
};

const resolveNextVideoNodeIds = (videoNodeId, graph) => {
  const nextVideoNodeIds = [];
  const seenTargets = new Set();
  const pushTarget = (targetVideoNodeId) => {
    if (!targetVideoNodeId || seenTargets.has(targetVideoNodeId)) {
      return;
    }
    seenTargets.add(targetVideoNodeId);
    nextVideoNodeIds.push(targetVideoNodeId);
  };

  const outgoing = graph.outgoing.get(videoNodeId) || [];
  outgoing.forEach((edge) => {
    const targetNode = graph.nodeById.get(edge.target);
    if (!targetNode) {
      return;
    }

    if (targetNode.type === 'button') {
      pushTarget(resolveButtonTargetVideoId(targetNode.id, graph));
      return;
    }

    resolveNodeToVideoTargets(targetNode.id, graph).forEach((resolvedVideoNodeId) => {
      pushTarget(resolvedVideoNodeId);
    });
  });

  const currentNode = graph.nodeById.get(videoNodeId);
  const legacyButtons = Array.isArray(currentNode?.data?.buttons) ? currentNode.data.buttons : [];
  legacyButtons.forEach((button) => {
    if (!button?.targetNodeId) {
      return;
    }
    pushTarget(resolveNodeToVideoTargets(button.targetNodeId, graph)[0]);
  });

  return nextVideoNodeIds;
};

const resolveNextVideoNodeId = (videoNodeId, graph) => {
  const outgoing = graph.outgoing.get(videoNodeId) || [];
  const menuTargets = [];
  const directVideoTargets = [];

  outgoing.forEach((edge) => {
    const targetNode = graph.nodeById.get(edge.target);
    if (!targetNode) {
      return;
    }

    if (targetNode.type === 'button') {
      const targetVideoNodeId = resolveButtonTargetVideoId(targetNode.id, graph);
      if (targetVideoNodeId) {
        menuTargets.push(targetVideoNodeId);
      }
      return;
    }

    const reachableVideoTargets = resolveNodeToVideoTargets(targetNode.id, graph);
    reachableVideoTargets.forEach((videoTargetId) => {
      if (!directVideoTargets.includes(videoTargetId)) {
        directVideoTargets.push(videoTargetId);
      }
    });
  });

  if (menuTargets.length > 0) {
    return menuTargets[0];
  }

  const currentNode = graph.nodeById.get(videoNodeId);
  const legacyButtons = Array.isArray(currentNode?.data?.buttons) ? currentNode.data.buttons : [];
  for (const button of legacyButtons) {
    if (button?.targetNodeId) {
      const resolvedTarget = resolveNodeToVideoTargets(button.targetNodeId, graph)[0];
      if (resolvedTarget) {
        return resolvedTarget;
      }
    }
  }

  return directVideoTargets[0];
};

const findScenarioStartVideoId = (graph, explicitStartNodeId) => {
  if (explicitStartNodeId && isPlayableVideoNode(graph.nodeById.get(explicitStartNodeId))) {
    return explicitStartNodeId;
  }

  const playableVideos = graph.nodes.filter(isPlayableVideoNode);
  if (playableVideos.length === 0) {
    return null;
  }

  const rootVideo = playableVideos.find((videoNode) => {
    const incoming = graph.incoming.get(videoNode.id) || [];
    return incoming.every((edge) => {
      const sourceNode = graph.nodeById.get(edge.source);
      return !sourceNode || (sourceNode.type !== 'video' && sourceNode.type !== 'button' && sourceNode.type !== 'group');
    });
  });

  return rootVideo?.id || playableVideos[0].id;
};

const buildScenarioExportSequence = ({ scenario, startNodeId, maxSegments = 40 }) => {
  const graph = buildScenarioGraph(scenario);
  const safeMaxSegments = Math.max(1, Math.min(120, Number(maxSegments) || 40));
  const startVideoId = findScenarioStartVideoId(graph, startNodeId);

  if (!startVideoId) {
    throw new Error('Aucune vidéo exploitable dans le scénario');
  }

  const sequence = [];
  const visited = new Set();
  let currentId = startVideoId;

  while (currentId && sequence.length < safeMaxSegments && !visited.has(currentId)) {
    visited.add(currentId);
    const node = graph.nodeById.get(currentId);
    if (!isPlayableVideoNode(node)) {
      break;
    }

    const data = node.data || {};
    const mediaIn = Math.max(0, toFiniteNumber(data.mediaIn) || 0);
    const mediaOutCandidate = toFiniteNumber(data.mediaOut);
    const mediaOut =
      typeof mediaOutCandidate === 'number' && mediaOutCandidate > mediaIn
        ? mediaOutCandidate
        : undefined;

    sequence.push({
      nodeId: node.id,
      label: data.label || node.id,
      videoUrl: data.videoUrl,
      mediaIn,
      mediaOut,
      menuOptions: resolveScenarioMenuOptions(node.id, graph),
    });

    const nextId = resolveNextVideoNodeId(node.id, graph);
    if (!nextId) {
      break;
    }

    currentId = nextId;
  }

  if (sequence.length === 0) {
    throw new Error('Impossible de construire un chemin vidéo depuis ce scénario');
  }

  return sequence;
};

const buildScenarioExportPlan = ({ scenario, startNodeId, maxSegments = 40 }) => {
  const graph = buildScenarioGraph(scenario);
  const safeMaxSegments = Math.max(1, Math.min(120, Number(maxSegments) || 40));
  const startVideoId = findScenarioStartVideoId(graph, startNodeId);

  if (!startVideoId) {
    throw new Error('Aucune vidéo exploitable dans le scénario');
  }

  const queue = [startVideoId];
  const queued = new Set([startVideoId]);
  const visited = new Set();
  const plan = [];

  while (queue.length > 0 && plan.length < safeMaxSegments) {
    const currentId = queue.shift();
    queued.delete(currentId);
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const node = graph.nodeById.get(currentId);
    if (!isPlayableVideoNode(node)) {
      continue;
    }

    const data = node.data || {};
    const mediaIn = Math.max(0, toFiniteNumber(data.mediaIn) || 0);
    const mediaOutCandidate = toFiniteNumber(data.mediaOut);
    const mediaOut =
      typeof mediaOutCandidate === 'number' && mediaOutCandidate > mediaIn
        ? mediaOutCandidate
        : undefined;
    const nextVideoNodeIds = resolveNextVideoNodeIds(node.id, graph);

    plan.push({
      nodeId: node.id,
      label: data.label || node.id,
      videoUrl: data.videoUrl,
      mediaIn,
      mediaOut,
      menuOptions: resolveScenarioMenuOptions(node.id, graph, {
        includeSingleDirectChoice: true,
      }),
      nextVideoNodeIds,
    });

    nextVideoNodeIds.forEach((nextId) => {
      if (!visited.has(nextId) && !queued.has(nextId)) {
        queue.push(nextId);
        queued.add(nextId);
      }
    });
  }

  if (plan.length === 0) {
    throw new Error('Impossible de construire un plan d’export vidéo depuis ce scénario');
  }

  return plan;
};

const buildYoutubeMenuOverlayFilters = ({
  menuOptions,
  videoWidth,
  videoHeight,
  clipDurationSeconds,
}) => {
  if (
    !Array.isArray(menuOptions) ||
    menuOptions.length === 0 ||
    !Number.isFinite(videoWidth) ||
    !Number.isFinite(videoHeight) ||
    videoWidth < 160 ||
    videoHeight < 120
  ) {
    return null;
  }

  const safeDuration = Number.isFinite(clipDurationSeconds) ? Number(clipDurationSeconds) : 0;
  if (safeDuration <= 0.4) {
    return null;
  }

  const normalized = menuOptions.map((option, index) => {
    const label =
      typeof option?.label === 'string' && option.label.trim()
        ? option.label.trim().slice(0, 80)
        : `Choix ${index + 1}`;
    const sizeKey = ['small', 'medium', 'large'].includes(option?.size) ? option.size : 'medium';
    const preset = youtubeButtonSizePresets[sizeKey];
    const style = {
      ...youtubeButtonDefaultStyle,
      ...(option?.style || {}),
    };
    const variant = ['contained', 'outlined', 'text'].includes(option?.variant)
      ? option.variant
      : 'contained';
    const positionMode = style.positionMode === 'absolute' ? 'absolute' : 'flow';
    const horizontalAlign = ['left', 'center', 'right'].includes(style.horizontalAlign)
      ? style.horizontalAlign
      : youtubeButtonDefaultStyle.horizontalAlign;
    const verticalAlign = ['top', 'center', 'bottom'].includes(style.verticalAlign)
      ? style.verticalAlign
      : youtubeButtonDefaultStyle.verticalAlign;
    const fontSize = parsePixelNumber(style.fontSize, preset.fontSize);
    const borderWidth = youtubeClamp(Math.round(parsePixelNumber(style.borderWidth, 1)), 0, 14);
    const padding = parsePaddingShorthand(style.padding, preset.paddingY, preset.paddingX);
    const textLength = Math.max(1, Array.from(label).length);
    const estimatedTextWidth = Math.round(fontSize * textLength * 0.56 + 10);
    const width = youtubeClamp(
      Math.round(Math.max(preset.minWidth, estimatedTextWidth + padding.left + padding.right)),
      84,
      Math.max(84, videoWidth - 32)
    );
    const height = youtubeClamp(
      Math.round(Math.max(preset.minHeight, fontSize + padding.top + padding.bottom + 6)),
      26,
      Math.max(26, videoHeight - 24)
    );

    return {
      id: option?.id || `menu-${index}`,
      label,
      variant,
      style,
      width,
      height,
      fontSize,
      borderWidth,
      positionMode,
      horizontalAlign,
      verticalAlign,
      positionX: Number.isFinite(Number(style.positionX)) ? Number(style.positionX) : 24,
      positionY: Number.isFinite(Number(style.positionY)) ? Number(style.positionY) : 24,
    };
  });

  const flowButtons = normalized.filter((button) => button.positionMode !== 'absolute');
  const absoluteButtons = normalized.filter((button) => button.positionMode === 'absolute');
  if (flowButtons.length === 0 && absoluteButtons.length === 0) {
    return null;
  }

  const overlayDuration = youtubeClamp(Math.min(2.4, safeDuration), 0.8, 2.4);
  const overlayStart = Math.max(0, safeDuration - overlayDuration);
  const enableExpr = `gte(t\\,${overlayStart.toFixed(3)})`;
  const fontPath = resolveYoutubeOverlayFontPath();
  const drawtextFontPrefix = fontPath ? `fontfile='${escapeDrawtextValue(fontPath)}':` : '';
  const filters = ['[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[vmenu0]'];
  let currentLabel = 'vmenu0';
  let labelIndex = 0;

  const pushFilter = (filterBody) => {
    labelIndex += 1;
    const nextLabel = `vmenu${labelIndex}`;
    filters.push(`[${currentLabel}]${filterBody}[${nextLabel}]`);
    currentLabel = nextLabel;
  };

  const drawButton = (button, x, y) => {
    const safeX = youtubeClamp(Math.round(x), 0, Math.max(0, videoWidth - button.width));
    const safeY = youtubeClamp(Math.round(y), 0, Math.max(0, videoHeight - button.height));
    const fillColor = toFfmpegColor(
      button.style.backgroundColor,
      youtubeButtonDefaultStyle.backgroundColor,
      button.variant === 'contained' ? 1 : 0.22
    );
    const borderColor = toFfmpegColor(
      button.style.borderColor,
      youtubeButtonDefaultStyle.borderColor,
      button.variant === 'text' ? 0 : 1
    );
    const textColor = toFfmpegColor(button.style.textColor, youtubeButtonDefaultStyle.textColor, 1);

    if (button.variant !== 'text') {
      pushFilter(
        `drawbox=x=${safeX}:y=${safeY}:w=${button.width}:h=${button.height}:color=${fillColor}:t=fill:enable='${enableExpr}'`
      );
    }

    const shouldDrawBorder =
      button.variant === 'outlined' ||
      (button.variant !== 'text' &&
        button.style.borderStyle !== 'none' &&
        Number(button.borderWidth) > 0);
    if (shouldDrawBorder) {
      const borderThickness = youtubeClamp(Number(button.borderWidth) || 1, 1, 14);
      pushFilter(
        `drawbox=x=${safeX}:y=${safeY}:w=${button.width}:h=${button.height}:color=${borderColor}:t=${borderThickness}:enable='${enableExpr}'`
      );
    }

    pushFilter(
      `drawtext=${drawtextFontPrefix}text='${escapeDrawtextValue(button.label)}':fontcolor=${textColor}:fontsize=${Math.round(
        button.fontSize
      )}:x=${Math.round(safeX + button.width / 2)}-text_w/2:y=${Math.round(
        safeY + button.height / 2
      )}-text_h/2:enable='${enableExpr}'`
    );
  };

  if (flowButtons.length > 0) {
    const spacingX = 14;
    const spacingY = 12;
    const sidePadding = 24;
    const containerPaddingX = 24;
    const containerPaddingY = 18;
    const availableWidth = Math.max(120, videoWidth - sidePadding * 2);
    flowButtons.forEach((button) => {
      button.width = youtubeClamp(Math.round(button.width), 84, availableWidth);
    });

    const rows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    flowButtons.forEach((button) => {
      const buttonWidth = button.width;
      if (currentRow.length === 0) {
        currentRow.push(button);
        currentRowWidth = buttonWidth;
        return;
      }

      const nextWidth = currentRowWidth + spacingX + buttonWidth;
      if (nextWidth <= availableWidth) {
        currentRow.push(button);
        currentRowWidth = nextWidth;
        return;
      }

      rows.push(currentRow);
      currentRow = [button];
      currentRowWidth = buttonWidth;
    });
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    const computeRowsHeight = (inputRows) =>
      inputRows.reduce((acc, row, rowIndex) => {
        const rowHeight = row.reduce((max, button) => Math.max(max, button.height), 30);
        return acc + rowHeight + (rowIndex > 0 ? spacingY : 0);
      }, 0);

    const maxContainerHeight = Math.max(80, videoHeight - 16);
    const visibleRows = [...rows];
    let rowsHeight = computeRowsHeight(visibleRows);
    while (
      visibleRows.length > 1 &&
      rowsHeight + containerPaddingY * 2 > maxContainerHeight
    ) {
      visibleRows.pop();
      rowsHeight = computeRowsHeight(visibleRows);
    }

    const containerHeight = youtubeClamp(rowsHeight + containerPaddingY * 2, 60, maxContainerHeight);
    const containerY = Math.max(0, videoHeight - containerHeight);

    pushFilter(
      `drawbox=x=0:y=${containerY}:w=iw:h=${containerHeight}:color=black@0.65:t=fill:enable='${enableExpr}'`
    );

    let cursorY = containerY + containerPaddingY;
    visibleRows.forEach((row, rowIndex) => {
      const rowHeight = row.reduce((max, button) => Math.max(max, button.height), 30);
      const rowTotalWidth =
        row.reduce((acc, button) => acc + button.width, 0) +
        spacingX * Math.max(0, row.length - 1);
      const startX = youtubeClamp(
        Math.round((videoWidth - rowTotalWidth) / 2),
        sidePadding,
        Math.max(sidePadding, videoWidth - sidePadding - rowTotalWidth)
      );

      let cursorX = startX;
      row.forEach((button) => {
        const buttonY = cursorY + Math.round((rowHeight - button.height) / 2);
        drawButton(button, cursorX, buttonY);
        cursorX += button.width + spacingX;
      });

      cursorY += rowHeight;
      if (rowIndex < visibleRows.length - 1) {
        cursorY += spacingY;
      }
    });
  }

  absoluteButtons.forEach((button) => {
    let buttonX;
    let buttonY;

    if (button.horizontalAlign === 'left') {
      buttonX = button.positionX;
    } else if (button.horizontalAlign === 'right') {
      buttonX = videoWidth - button.width - button.positionX;
    } else {
      buttonX = videoWidth / 2 - button.width / 2 + button.positionX;
    }

    if (button.verticalAlign === 'top') {
      buttonY = button.positionY;
    } else if (button.verticalAlign === 'bottom') {
      buttonY = videoHeight - button.height - button.positionY;
    } else {
      buttonY = videoHeight / 2 - button.height / 2 + button.positionY;
    }

    drawButton(button, buttonX, buttonY);
  });

  filters.push(`[${currentLabel}]format=yuv420p[vout]`);
  return filters;
};

const transcodeVideoForYoutube = async ({
  inputPath,
  outputPath,
  startAt = 0,
  durationSeconds,
  menuOptions = [],
}) => {
  const streamInfo = await probeMediaStreams(inputPath);
  const mapOptions = mapOptionsFromStreams({
    hasVideo: streamInfo.hasVideo,
    hasAudio: streamInfo.hasAudio,
    requireVideo: true,
  });

  const clipDurationSeconds =
    typeof durationSeconds === 'number' && durationSeconds > 0
      ? durationSeconds
      : Number(streamInfo.durationSeconds) > 0
        ? Math.max(0.1, Number(streamInfo.durationSeconds) - Math.max(0, Number(startAt) || 0))
        : 0;

  const overlayFilters = buildYoutubeMenuOverlayFilters({
    menuOptions,
    videoWidth: Number(streamInfo.width) || 0,
    videoHeight: Number(streamInfo.height) || 0,
    clipDurationSeconds,
  });

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);

    if (startAt > 0) {
      command.setStartTime(startAt);
    }
    if (durationSeconds && durationSeconds > 0) {
      command.setDuration(durationSeconds);
    }

    if (overlayFilters) {
      const audioOptions = streamInfo.hasAudio
        ? ['-map 0:a:0?', '-c:a aac', '-b:a 160k', '-ac 2']
        : ['-an'];

      command
        .complexFilter(overlayFilters)
        .outputOptions([
          '-map [vout]',
          ...audioOptions,
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
        ])
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (error) => reject(error));
      return;
    }

    command
      .outputOptions([
        ...mapOptions,
        '-c:v libx264',
        '-preset veryfast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:a aac',
        '-b:a 160k',
        '-ac 2',
        '-movflags +faststart',
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error));
  });
};

const concatVideosForYoutube = ({ segmentPaths, outputPath }) =>
  new Promise((resolve, reject) => {
    const concatListPath = path.join(
      exportsDir,
      `concat-${Date.now()}-${Math.round(Math.random() * 1e6)}.txt`
    );
    const listContent = segmentPaths
      .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
      .join('\n');

    fs.writeFileSync(concatListPath, listContent, 'utf8');

    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-map 0:v:0?',
        '-map 0:a:0?',
        '-c:v libx264',
        '-preset veryfast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:a aac',
        '-b:a 160k',
        '-ac 2',
        '-movflags +faststart',
      ])
      .save(outputPath)
      .on('end', () => {
        cleanupTemporaryFiles([concatListPath]);
        resolve(outputPath);
      })
      .on('error', (error) => {
        cleanupTemporaryFiles([concatListPath]);
        reject(error);
      });
  });

const normalizePrivacyStatus = (rawStatus) => {
  const allowed = new Set(['private', 'public', 'unlisted']);
  return allowed.has(rawStatus) ? rawStatus : 'unlisted';
};

const youtubeUploadLimitReasons = new Set([
  'uploadlimitexceeded',
  'quotaexceeded',
  'ratelimitexceeded',
  'userratelimitexceeded',
  'dailylimitexceeded',
  'dailylimitexceededunreg',
]);

const extractYoutubeApiErrorDetails = (error) => {
  const responseError = error?.response?.data?.error;
  const errorItems = Array.isArray(responseError?.errors) ? responseError.errors : [];
  const reasons = errorItems
    .map((item) => sanitizeString(item?.reason || item?.domain))
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  const message =
    sanitizeString(responseError?.message) ||
    sanitizeString(error?.response?.data?.message) ||
    sanitizeString(error?.message) ||
    'Erreur YouTube inconnue';

  return { reasons, message };
};

const classifyYoutubeUploadError = (error) => {
  const details = extractYoutubeApiErrorDetails(error);
  const lowerMessage = details.message.toLowerCase();
  const reasonMatched = details.reasons.some((reason) => youtubeUploadLimitReasons.has(reason));
  const messageMatched =
    lowerMessage.includes('exceeded the number of videos') ||
    lowerMessage.includes('upload limit') ||
    (lowerMessage.includes('quota') && lowerMessage.includes('exceeded')) ||
    lowerMessage.includes('too many videos');

  return {
    ...details,
    isUploadLimitExceeded: reasonMatched || messageMatched,
  };
};

const toYoutubeUploadLimitMessage = (details) => {
  if (details?.message && details.message.length > 0) {
    return `Limite YouTube atteinte: ${details.message}`;
  }
  return 'Limite YouTube atteinte: le compte a dépassé le nombre de vidéos autorisées.';
};

const sanitizeCompanionUrl = (value) => {
  const rawValue = sanitizeString(value);
  if (!rawValue) {
    return '';
  }

  try {
    const parsed = new URL(rawValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

const sanitizeExportBaseName = (value) => {
  const fallback = 'scenario-export';
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || fallback;
};

const uploadVideoToYoutube = async ({
  authClient,
  filePath,
  title,
  description,
  privacyStatus,
  tags,
}) => {
  const youtube = google.youtube({
    version: 'v3',
    auth: authClient,
  });

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: '22',
        ...(Array.isArray(tags) && tags.length > 0 ? { tags } : {}),
      },
      status: {
        privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  return {
    id: response?.data?.id,
    title: response?.data?.snippet?.title || title,
    url: response?.data?.id ? `https://www.youtube.com/watch?v=${response.data.id}` : null,
    studioUrl: response?.data?.id ? `https://studio.youtube.com/video/${response.data.id}/edit` : null,
    privacyStatus: response?.data?.status?.privacyStatus || privacyStatus || null,
    channelTitle: response?.data?.snippet?.channelTitle || null,
    channelId: response?.data?.snippet?.channelId || null,
  };
};

const persistUploadFiles = async (relativePaths) => {
  const uniquePaths = Array.from(new Set((relativePaths || []).filter(Boolean)));
  for (const relativePath of uniquePaths) {
    // Keep it sequential to reduce memory pressure during video uploads.
    await uploadLocalFileToPersistentStorage(relativePath);
  }
};

const uploadProcessingConcurrency = Math.max(
  1,
  Number(process.env.UPLOAD_PROCESSING_CONCURRENCY || '1')
);
let activeUploadJobs = 0;
const pendingUploadJobs = [];

const runWithUploadSlot = async (job) =>
  new Promise((resolve, reject) => {
    const execute = () => {
      activeUploadJobs += 1;
      Promise.resolve()
        .then(job)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeUploadJobs -= 1;
          const next = pendingUploadJobs.shift();
          if (next) {
            next();
          }
        });
    };

    if (activeUploadJobs < uploadProcessingConcurrency) {
      execute();
      return;
    }

    pendingUploadJobs.push(execute);
  });

app.get('/api/auth/me', async (req, res) => {
  const authContext = await resolveAuthContextFromRequest(req);
  if (!authContext) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: sanitizeAuthUser(authContext.user),
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = sanitizeString(req.body?.password);
    const providedName = sanitizeString(req.body?.name);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const users = await readAuthUsers();
    if (users.some((user) => normalizeEmail(user.email) === email)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const nowIso = new Date().toISOString();
    const user = {
      id: `user_${crypto.randomUUID()}`,
      email,
      name: providedName || email.split('@')[0],
      passwordHash: hashPassword(password),
      role: users.length === 0 ? 'admin' : 'creator',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    users.push(user);
    await saveAuthUsers(users);

    const session = await createAuthSession(user.id, req);
    res.setHeader('Set-Cookie', buildAuthCookieHeader(session.rawToken));

    return res.status(201).json({
      authenticated: true,
      user: sanitizeAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Inscription impossible' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = sanitizeString(req.body?.password);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const users = await readAuthUsers();
    const user = users.find((item) => normalizeEmail(item.email) === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = user.lastLoginAt;
    await saveAuthUsers(users);

    const session = await createAuthSession(user.id, req);
    res.setHeader('Set-Cookie', buildAuthCookieHeader(session.rawToken));

    return res.json({
      authenticated: true,
      user: sanitizeAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Connexion impossible' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = parseCookies(req.headers.cookie || '')[authCookieName];
    if (token) {
      const tokenHash = hashSessionToken(token);
      const sessions = await readAuthSessions();
      const remainingSessions = sessions.filter((session) => session.tokenHash !== tokenHash);
      if (remainingSessions.length !== sessions.length) {
        await saveAuthSessions(remainingSessions);
      }
    }
  } catch (error) {
    console.warn('Erreur logout:', error.message);
  }

  res.setHeader('Set-Cookie', clearAuthCookieHeader());
  return res.json({ success: true });
});

app.post('/api/auth/firebase/session', async (req, res) => {
  if (!isFirebaseAuthEnabled) {
    return res.status(503).json({
      error:
        'Connexion Google non configurée: définir FIREBASE_PROJECT_ID (et optionnellement FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY)',
    });
  }

  try {
    const idToken = sanitizeString(req.body?.idToken);
    if (!idToken) {
      return res.status(400).json({ error: 'Token Firebase requis' });
    }

    const decodedToken = await verifyFirebaseIdToken(idToken);
    const email = normalizeEmail(decodedToken?.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Le compte Google doit fournir un email valide' });
    }

    const users = await readAuthUsers();
    const nowIso = new Date().toISOString();
    const firebaseUid = sanitizeString(decodedToken?.uid);
    const displayName =
      sanitizeString(decodedToken?.name) ||
      sanitizeString(decodedToken?.displayName) ||
      email.split('@')[0];

    let user = users.find((item) => normalizeEmail(item.email) === email);
    if (!user) {
      user = {
        id: `user_${crypto.randomUUID()}`,
        email,
        name: displayName,
        passwordHash: null,
        provider: 'firebase',
        providerUid: firebaseUid || undefined,
        role: users.length === 0 ? 'admin' : 'creator',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };
      users.push(user);
    } else {
      user.lastLoginAt = nowIso;
      user.updatedAt = nowIso;
      if (!sanitizeString(user.name)) {
        user.name = displayName;
      }
      if (!sanitizeString(user.provider)) {
        user.provider = 'firebase';
      }
      if (firebaseUid && !sanitizeString(user.providerUid)) {
        user.providerUid = firebaseUid;
      }
    }

    await saveAuthUsers(users);

    const session = await createAuthSession(user.id, req);
    res.setHeader('Set-Cookie', buildAuthCookieHeader(session.rawToken));

    return res.json({
      authenticated: true,
      user: sanitizeAuthUser(user),
    });
  } catch (error) {
    const firebaseCode = sanitizeString(error?.code);
    if (firebaseCode.startsWith('auth/')) {
      return res.status(401).json({ error: 'Token Firebase invalide ou expiré' });
    }

    if (sanitizeString(error?.message) === 'Configuration Firebase manquante') {
      return res.status(503).json({ error: error.message });
    }

    console.warn('Erreur session Firebase:', error?.message || error);
    return res.status(500).json({ error: 'Connexion Google impossible' });
  }
});

app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/published/:slug', async (req, res) => {
  try {
    const requestedIdentifier = sanitizeString(req.params?.slug);
    if (!requestedIdentifier) {
      return res.status(400).json({ error: 'Identifiant de publication invalide' });
    }

    const indexEntries = await readPublishedScenariosIndex();
    const publication = findPublishedEntryByIdentifier(indexEntries, requestedIdentifier);
    if (!publication) {
      return res.status(404).json({ error: 'Publication introuvable' });
    }

    const { entry: indexEntry, slug } = publication;
    const record = await readPublishedScenarioRecord(slug);
    if (!record?.scenario || !Array.isArray(record.scenario.nodes) || !Array.isArray(record.scenario.edges)) {
      return res.status(404).json({ error: 'Contenu publié indisponible' });
    }

    const watchUrl = buildPublicWatchUrl(req, slug);

    return res.json({
      slug,
      projectId: indexEntry.projectId || null,
      title: indexEntry.title || record.title || 'Scénario interactif',
      description: indexEntry.description || record.description || '',
      publishedAt: indexEntry.publishedAt || record.publishedAt || null,
      updatedAt: indexEntry.updatedAt || record.updatedAt || null,
      url: watchUrl,
      embedCode: buildPublicEmbedCode(watchUrl),
      scenario: record.scenario,
    });
  } catch (error) {
    console.warn('Erreur récupération publication:', error?.message || error);
    return res.status(500).json({ error: 'Impossible de charger la publication' });
  }
});

const unauthenticatedApiPaths = new Set([
  '/auth/me',
  '/auth/register',
  '/auth/login',
  '/auth/logout',
  '/auth/firebase/session',
  '/analytics/events',
]);

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS' || unauthenticatedApiPaths.has(req.path)) {
    return next();
  }
  return requireAuth(req, res, next);
});

app.post('/api/publish/link', async (req, res) => {
  try {
    const title = sanitizeString(req.body?.title).slice(0, 140) || 'Scénario interactif';
    const description = sanitizeString(req.body?.description).slice(0, 600);
    const projectId = sanitizeString(req.body?.projectId).slice(0, 128) || null;

    if (!Array.isArray(req.body?.nodes) || !Array.isArray(req.body?.edges)) {
      return res.status(400).json({ error: 'Le scénario doit contenir nodes et edges' });
    }

    if (req.body.nodes.length === 0) {
      return res.status(400).json({ error: 'Ajoutez au moins un node avant publication' });
    }

    if (req.body.nodes.length > 1000 || req.body.edges.length > 4000) {
      return res.status(400).json({ error: 'Scénario trop volumineux pour publication' });
    }

    // Clone JSON payload to strip non-serializable data/functions from editor nodes.
    const scenario = {
      nodes: JSON.parse(JSON.stringify(req.body.nodes)),
      edges: JSON.parse(JSON.stringify(req.body.edges)),
    };

    const authorUserId = sanitizeString(req.auth?.user?.id) || 'anonymous';
    const nowIso = new Date().toISOString();
    const indexEntries = await readPublishedScenariosIndex();

    const existingEntry =
      projectId &&
      indexEntries.find(
        (entry) =>
          sanitizeString(entry?.projectId) === projectId &&
          sanitizeString(entry?.authorUserId) === authorUserId
      );

    const slug = existingEntry?.slug || generatePublishedSlug(title, indexEntries);
    const publishedAt = existingEntry?.publishedAt || nowIso;
    const updatedAt = nowIso;

    const nextEntry = {
      slug,
      projectId,
      authorUserId,
      title,
      description: description || '',
      publishedAt,
      updatedAt,
    };

    const entryIndex = indexEntries.findIndex((entry) => normalizePublishedSlug(entry?.slug) === slug);
    if (entryIndex === -1) {
      indexEntries.push(nextEntry);
    } else {
      indexEntries[entryIndex] = nextEntry;
    }

    await savePublishedScenarioRecord(slug, {
      ...nextEntry,
      scenario,
    });
    await savePublishedScenariosIndex(indexEntries);

    const watchUrl = buildPublicWatchUrl(req, slug);
    return res.json({
      slug,
      projectId,
      title,
      description: description || '',
      publishedAt,
      updatedAt,
      url: watchUrl,
      embedCode: buildPublicEmbedCode(watchUrl),
    });
  } catch (error) {
    console.warn('Erreur publication scénario:', error?.message || error);
    return res.status(500).json({ error: 'Impossible de publier le scénario' });
  }
});

app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  let normalizedPath;
  let generatedThumbnailPath;
  try {
    if (!req.file) {
      throw new Error('Aucun fichier uploadé');
    }

    const file = req.file;
    let tags = [];

    if (req.body.tags) {
      try {
        const parsedTags = JSON.parse(req.body.tags);
        if (Array.isArray(parsedTags)) {
          tags = parsedTags.filter((tag) => typeof tag === 'string');
        }
      } catch (error) {
        console.warn('Impossible de parser les tags:', error);
      }
    }

    const mediaFile = await runWithUploadSlot(async () => {
      const isVideo = file.mimetype.startsWith('video/');
      let storedFilename = file.filename;
      let storedPath = file.path;
      let storedMimeType = file.mimetype;

      if (isVideo) {
        const baseName = path.basename(file.filename, path.extname(file.filename));
        const normalizedFilename = `${baseName}-web.mp4`;
        normalizedPath = path.join(uploadsDir, normalizedFilename);

        await normalizeVideoForWebPlayback(file.path, normalizedPath);

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        storedFilename = normalizedFilename;
        storedPath = normalizedPath;
        storedMimeType = 'video/mp4';
      }

      const thumbnailFilename = isVideo
        ? `${path.basename(storedFilename, path.extname(storedFilename))}.jpg`
        : undefined;

      if (isVideo && thumbnailFilename) {
        const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
        await generateThumbnail(storedPath, thumbnailPath);
        generatedThumbnailPath = thumbnailPath;
      }

      const normalizedName = isVideo
        ? `${path.parse(file.originalname).name}.mp4`
        : file.originalname;

      const nextMediaFile = createMediaRecord({
        filename: storedFilename,
        originalName: normalizedName,
        mimeType: storedMimeType,
        tags,
        thumbnailFilename,
      });

      await persistUploadFiles([
        storedFilename,
        thumbnailFilename ? `thumbnails/${thumbnailFilename}` : null,
      ]);

      mediaFiles.push(nextMediaFile);
      await saveMediaIndex(mediaFiles);

      return nextMediaFile;
    });

    res.json(toPublicMediaFile(mediaFile));
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (normalizedPath && fs.existsSync(normalizedPath)) {
      fs.unlinkSync(normalizedPath);
    }
    if (generatedThumbnailPath && fs.existsSync(generatedThumbnailPath)) {
      fs.unlinkSync(generatedThumbnailPath);
    }
    const message = error instanceof Error ? error.message : 'Upload impossible';
    const status =
      message.includes('429') || message.toLowerCase().includes('rate limit')
        ? 429
        : message.toLowerCase().includes('timeout')
          ? 504
          : message.toLowerCase().includes('service unavailable') ||
              message.toLowerCase().includes('unavailable')
            ? 503
            : 400;
    res.status(status).json({ error: message });
  }
});

app.get('/api/workflows/capabilities', async (req, res) => {
  try {
    const capabilities = await buildWorkflowCapabilities();
    return res.json(capabilities);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible de lire les capacités workflow';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/workflows/execute', async (req, res) => {
  try {
    const workflowPreset = sanitizeString(req.body?.workflowPreset);
    const executionModeRaw = sanitizeString(req.body?.executionMode).toLowerCase();
    const executionMode = ['auto', 'local', 'comfyui'].includes(executionModeRaw)
      ? executionModeRaw
      : 'auto';
    const sourceMediaId = sanitizeString(req.body?.sourceMediaId);
    const prompt = sanitizeString(req.body?.prompt);
    const negativePrompt = sanitizeString(req.body?.negativePrompt);
    const notes = sanitizeString(req.body?.notes);
    const expectedOutputsRaw = Number(req.body?.expectedOutputs ?? 4);
    const expectedOutputs = Number.isFinite(expectedOutputsRaw)
      ? Math.max(1, Math.min(6, expectedOutputsRaw))
      : 4;

    if (workflowPreset !== 'thumbnail_pack') {
      return res.status(400).json({
        error: 'Seul le preset Pack miniatures est exécutable dans cette V1.',
      });
    }

    if (!sourceMediaId) {
      return res.status(400).json({ error: 'sourceMediaId requis' });
    }

    ensureStorageDirectories();

    const sourceMedia = resolveMediaFileById(sourceMediaId);
    if (!sourceMedia) {
      return res.status(404).json({ error: 'Média source introuvable' });
    }

    const comfyTemplateConfigured = Boolean(resolveComfyWorkflowTemplateDefinition('thumbnail_pack'));
    const comfyEligible = Boolean(comfyBaseUrl && comfyTemplateConfigured);

    if (executionMode === 'comfyui') {
      if (!comfyBaseUrl) {
        return res.status(400).json({ error: 'ComfyUI n est pas configuré côté serveur.' });
      }
      if (!comfyTemplateConfigured) {
        return res.status(400).json({ error: 'Le template ComfyUI de ce preset n est pas configuré.' });
      }

      const comfyResult = await executeThumbnailPackWithComfy({
        sourceMedia,
        prompt,
        negativePrompt,
        notes,
        expectedOutputs,
      });

      return res.json({
        workflowPreset,
        executionMode,
        ...comfyResult,
      });
    }

    if (executionMode === 'local') {
      const localResult = await executeThumbnailPackLocally({
        sourceMedia,
        prompt,
        expectedOutputs,
      });

      return res.json({
        workflowPreset,
        executionMode,
        ...localResult,
      });
    }

    if (comfyEligible) {
      try {
        const comfyResult = await executeThumbnailPackWithComfy({
          sourceMedia,
          prompt,
          negativePrompt,
          notes,
          expectedOutputs,
        });

        return res.json({
          workflowPreset,
          executionMode,
          ...comfyResult,
        });
      } catch (error) {
        const comfyMessage =
          error instanceof Error ? error.message : 'Echec d’exécution ComfyUI';
        console.warn(`Workflow thumbnail_pack: fallback local après échec ComfyUI: ${comfyMessage}`);

        const fallbackResult = await executeThumbnailPackLocally({
          sourceMedia,
          prompt,
          expectedOutputs,
        });

        return res.json({
          workflowPreset,
          executionMode,
          ...fallbackResult,
          message: `ComfyUI indisponible, fallback local utilise: ${comfyMessage}`,
        });
      }
    }

    const localResult = await executeThumbnailPackLocally({
      sourceMedia,
      prompt,
      expectedOutputs,
    });

    return res.json({
      workflowPreset,
      executionMode,
      ...localResult,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible d’exécuter le workflow';
    return res.status(400).json({ error: message });
  }
});

app.post('/api/ai/generate-video', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const apiKey =
      typeof req.body?.apiKey === 'string' && req.body.apiKey.trim()
        ? req.body.apiKey.trim()
        : undefined;
    const animate = Boolean(req.body?.animate);
    const durationRaw = Number(req.body?.durationSeconds ?? 6);
    const durationSeconds = Number.isFinite(durationRaw)
      ? Math.max(1, Math.min(30, durationRaw))
      : 6;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt requis' });
    }

    ensureStorageDirectories();

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const imageFilename = `ai-image-${uniqueSuffix}.png`;
    const videoFilename = `ai-video-${uniqueSuffix}.mp4`;
    const imagePath = path.join(uploadsDir, imageFilename);
    const videoPath = path.join(uploadsDir, videoFilename);
    const thumbnailFilename = `ai-video-${uniqueSuffix}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

    const imageBuffer = await generateImageBufferFromPrompt(prompt, apiKey);
    fs.writeFileSync(imagePath, imageBuffer);

    try {
      await createVideoFromImage(imagePath, videoPath, durationSeconds, animate);
    } catch (error) {
      if (animate) {
        console.warn('Animation vidéo IA impossible, fallback statique:', error);
        await createVideoFromImage(imagePath, videoPath, durationSeconds, false);
      } else {
        throw error;
      }
    }

    await generateThumbnail(videoPath, thumbnailPath);

    const mediaRecord = createMediaRecord({
      filename: videoFilename,
      originalName: `AI - ${prompt.slice(0, 48) || 'generated'}.mp4`,
      mimeType: 'video/mp4',
      tags: ['ai-generated', animate ? 'animated' : 'static'],
      thumbnailFilename,
    });

    await persistUploadFiles([
      imageFilename,
      videoFilename,
      `thumbnails/${thumbnailFilename}`,
    ]);
    mediaFiles.push(mediaRecord);
    await saveMediaIndex(mediaFiles);

    return res.json({
      ...toPublicMediaFile(mediaRecord),
      sourceImageUrl: `/uploads/${imageFilename}`,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erreur IA' });
  }
});

app.post('/api/ai/generate-video-from-image', imageUpload.single('image'), async (req, res) => {
  const temporaryFiles = [];

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image requise' });
    }

    ensureStorageDirectories();

    const promptRaw = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const prompt = promptRaw || 'Animate this image with smooth cinematic motion.';
    const apiKey =
      typeof req.body?.apiKey === 'string' && req.body.apiKey.trim()
        ? req.body.apiKey.trim()
        : undefined;
    const requestedModel =
      typeof req.body?.model === 'string' ? req.body.model.trim().toLowerCase() : 'sora-2';
    const useLocalOnly = requestedModel === 'local-zoom';
    const model = allowedSoraModels.has(requestedModel) ? requestedModel : 'sora-2';
    const size = normalizeVideoSize(req.body?.size);
    const soraSeconds = pickNearestSoraDuration(req.body?.durationSeconds);
    const localDurationRaw = Number(req.body?.durationSeconds ?? 6);
    const localDurationSeconds = Number.isFinite(localDurationRaw)
      ? Math.max(1, Math.min(30, localDurationRaw))
      : 6;
    const animateRaw = req.body?.animate;
    const animate =
      animateRaw === true ||
      animateRaw === 'true' ||
      animateRaw === '1' ||
      animateRaw === 1;
    const fallbackToLocal = req.body?.fallbackToLocal !== 'false';

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sourceExt = path.extname(req.file.originalname || '').toLowerCase() || '.png';
    const sourceImageFilename = `ai-source-${uniqueSuffix}${sourceExt}`;
    const sourceImagePath = path.join(uploadsDir, sourceImageFilename);
    const preparedReferencePath = path.join(exportsDir, `ai-source-prepared-${uniqueSuffix}.png`);
    const videoFilename = `ai-video-${uniqueSuffix}.mp4`;
    const videoPath = path.join(uploadsDir, videoFilename);
    const thumbnailFilename = `ai-video-${uniqueSuffix}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

    fs.writeFileSync(sourceImagePath, req.file.buffer);
    temporaryFiles.push(preparedReferencePath);

    let usedProvider = useLocalOnly ? 'local' : 'sora';
    let usedModel = useLocalOnly ? 'ffmpeg-zoompan' : model;
    let usedDuration = useLocalOnly ? localDurationSeconds : soraSeconds;
    let soraVideoId;

    if (useLocalOnly) {
      await createVideoFromImage(sourceImagePath, videoPath, localDurationSeconds, animate);
    } else {
      try {
        await prepareImageReferenceForVideo({
          inputPath: sourceImagePath,
          outputPath: preparedReferencePath,
          size,
        });

        const soraResult = await createSoraVideoFromImage({
          prompt,
          model,
          seconds: soraSeconds,
          size,
          referenceImagePath: preparedReferencePath,
          outputPath: videoPath,
          apiKey,
        });
        soraVideoId = soraResult.videoId;
      } catch (error) {
        if (!fallbackToLocal) {
          throw error;
        }

        usedProvider = 'local';
        usedModel = 'ffmpeg-zoompan';
        usedDuration = localDurationSeconds;
        await createVideoFromImage(sourceImagePath, videoPath, localDurationSeconds, animate);
      }
    }

    await generateThumbnail(videoPath, thumbnailPath);

    const mediaRecord = createMediaRecord({
      filename: videoFilename,
      originalName: `AI image-to-video - ${path.parse(req.file.originalname || 'image').name}.mp4`,
      mimeType: 'video/mp4',
      tags: ['ai-generated', 'image-to-video', usedModel],
      thumbnailFilename,
    });

    await persistUploadFiles([
      sourceImageFilename,
      videoFilename,
      `thumbnails/${thumbnailFilename}`,
    ]);
    mediaFiles.push(mediaRecord);
    await saveMediaIndex(mediaFiles);

    return res.json({
      ...toPublicMediaFile(mediaRecord),
      sourceImageUrl: `/uploads/${sourceImageFilename}`,
      provider: usedProvider,
      model: usedModel,
      durationSeconds: usedDuration,
      size,
      soraVideoId: soraVideoId || undefined,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erreur image-to-video' });
  } finally {
    cleanupTemporaryFiles(temporaryFiles);
  }
});

app.post('/api/export/scenario-video', async (req, res) => {
  const temporaryFiles = [];

  try {
    const scenario = req.body?.scenario;
    const hasScenarioPayload =
      scenario &&
      typeof scenario === 'object' &&
      Array.isArray(scenario.nodes) &&
      Array.isArray(scenario.edges);

    if (!hasScenarioPayload) {
      return res.status(400).json({ error: 'Payload invalide: scenario requis' });
    }

    ensureStorageDirectories();

    const sequence = buildScenarioExportSequence({
      scenario,
      startNodeId: req.body?.startNodeId,
      maxSegments: req.body?.maxSegments,
    });

    const exportBaseName = sanitizeExportBaseName(
      typeof req.body?.exportName === 'string' ? req.body.exportName : undefined
    );
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFilename = `${exportBaseName}-${timestamp}.mp4`;
    const exportPath = path.join(exportsDir, exportFilename);

    if (sequence.length === 1) {
      const segment = sequence[0];
      const inputPath = await resolveUploadPathFromUrl(segment.videoUrl);
      if (!inputPath || !fs.existsSync(inputPath)) {
        throw new Error(`Vidéo locale introuvable pour le node ${segment.nodeId}`);
      }

      const durationSeconds =
        typeof segment.mediaOut === 'number'
          ? Math.max(0.1, segment.mediaOut - segment.mediaIn)
          : undefined;

      await transcodeVideoForYoutube({
        inputPath,
        outputPath: exportPath,
        startAt: segment.mediaIn,
        durationSeconds,
      });
    } else {
      const segmentPaths = [];
      for (let index = 0; index < sequence.length; index += 1) {
        const segment = sequence[index];
        const inputPath = await resolveUploadPathFromUrl(segment.videoUrl);
        if (!inputPath || !fs.existsSync(inputPath)) {
          throw new Error(`Vidéo locale introuvable pour le node ${segment.nodeId}`);
        }

        const segmentPath = path.join(
          exportsDir,
          `export-segment-${Date.now()}-${Math.round(Math.random() * 1e6)}-${index}.mp4`
        );

        const durationSeconds =
          typeof segment.mediaOut === 'number'
            ? Math.max(0.1, segment.mediaOut - segment.mediaIn)
            : undefined;

        await transcodeVideoForYoutube({
          inputPath,
          outputPath: segmentPath,
          startAt: segment.mediaIn,
          durationSeconds,
        });

        segmentPaths.push(segmentPath);
        temporaryFiles.push(segmentPath);
      }

      await concatVideosForYoutube({
        segmentPaths,
        outputPath: exportPath,
      });
    }

    await persistUploadFiles([`exports/${exportFilename}`]);

    return res.json({
      url: `/uploads/exports/${exportFilename}`,
      filename: exportFilename,
      segments: sequence.length,
      pathNodeIds: sequence.map((item) => item.nodeId),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Export scénario impossible' });
  } finally {
    cleanupTemporaryFiles(temporaryFiles);
  }
});

app.get('/api/youtube/config', async (req, res) => {
  const config = await getPublicYoutubeOauthConfig();
  return res.json(config);
});

app.post('/api/youtube/config', async (req, res) => {
  try {
    const previousConfig = await resolveYoutubeOauthConfig();
    const storedConfig = (await loadStoredYoutubeOauthConfig()) || {};

    const clientIdInput = sanitizeString(req.body?.clientId);
    const clientSecretInput = sanitizeString(req.body?.clientSecret);
    const redirectUriInput = sanitizeString(req.body?.redirectUri);

    const clientId = clientIdInput || storedConfig.clientId || sanitizeString(process.env.YOUTUBE_CLIENT_ID);
    const clientSecret =
      clientSecretInput || storedConfig.clientSecret || sanitizeString(process.env.YOUTUBE_CLIENT_SECRET);
    const redirectUri =
      redirectUriInput || storedConfig.redirectUri || sanitizeString(process.env.YOUTUBE_REDIRECT_URI);

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        error:
          'Champs requis: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET et YOUTUBE_REDIRECT_URI',
      });
    }

    let parsedRedirectUri;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch (error) {
      return res.status(400).json({ error: 'YOUTUBE_REDIRECT_URI invalide' });
    }

    if (!['http:', 'https:'].includes(parsedRedirectUri.protocol)) {
      return res.status(400).json({ error: 'YOUTUBE_REDIRECT_URI doit commencer par http:// ou https://' });
    }

    await saveStoredYoutubeOauthConfig({
      clientId,
      clientSecret,
      redirectUri,
    });

    const tokenStore = await readYoutubeTokenStore();
    if (
      !tokenStore.oauthConfig ||
      tokenStore.oauthConfig.clientId !== clientId ||
      tokenStore.oauthConfig.clientSecret !== clientSecret ||
      tokenStore.oauthConfig.redirectUri !== redirectUri
    ) {
      await saveYoutubeTokenStore({
        ...tokenStore,
        oauthConfig: {
          clientId,
          clientSecret,
          redirectUri,
        },
      });
    }

    const configurationChanged =
      clientId !== previousConfig.clientId ||
      clientSecret !== previousConfig.clientSecret ||
      redirectUri !== previousConfig.redirectUri;

    if (configurationChanged) {
      await clearYoutubeTokens();
    }

    return res.json({
      ...(await getPublicYoutubeOauthConfig()),
      tokenReset: configurationChanged,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Configuration YouTube invalide' });
  }
});

app.get('/api/youtube/auth/url', async (req, res) => {
  try {
    const userId = sanitizeString(req.auth?.user?.id);
    if (!userId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const oauthClient = await createYoutubeOauthClient();
    const state = `uid:${userId}:${crypto.randomBytes(8).toString('hex')}`;

    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: youtubeScopes,
      state,
    });

    return res.json({ url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/youtube/auth/callback', async (req, res) => {
  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  const userId = sanitizeString(req.auth?.user?.id);

  if (!userId) {
    return res.status(401).send('Session expirée. Reconnectez-vous puis relancez Connexion YouTube.');
  }

  if (!code) {
    return res.status(400).send('Code OAuth YouTube manquant');
  }

  try {
    const oauthClient = await createYoutubeOauthClient();
    const { tokens } = await oauthClient.getToken(code);
    const existingTokens = (await loadStoredYoutubeTokensForUser(userId)) || {};

    const mergedTokens = {
      ...existingTokens,
      ...tokens,
      refresh_token:
        tokens.refresh_token || existingTokens.refresh_token || process.env.YOUTUBE_REFRESH_TOKEN,
    };

    if (!mergedTokens.refresh_token && !mergedTokens.access_token) {
      throw new Error('Aucun token OAuth YouTube reçu');
    }

    await saveYoutubeTokensForUser(userId, mergedTokens);

    return res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px">
          <h2>Connexion YouTube réussie</h2>
          <p>Vous pouvez retourner dans l'application.</p>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(400).send(`Échec de la connexion YouTube: ${error.message}`);
  }
});

app.get('/api/youtube/auth/status', async (req, res) => {
  const userId = sanitizeString(req.auth?.user?.id);
  if (!userId) {
    return res.status(401).json({
      configured: false,
      connected: false,
      error: 'Authentification requise',
    });
  }

  if (!(await hasYoutubeOauthConfig())) {
    return res.json({
      configured: false,
      connected: false,
      error:
        'Configuration absente (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI)',
    });
  }

  const tokens = await loadStoredYoutubeTokensForUser(userId);
  if (!tokens || (!tokens.refresh_token && !tokens.access_token)) {
    return res.json({
      configured: true,
      connected: false,
      error: 'Aucun token YouTube enregistré',
    });
  }

  try {
    const authClient = await getAuthorizedYoutubeClient(userId);
    const youtube = google.youtube({ version: 'v3', auth: authClient });
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
      maxResults: 1,
    });

    const channelTitle = channelResponse.data?.items?.[0]?.snippet?.title;
    return res.json({
      configured: true,
      connected: true,
      channelTitle: channelTitle || null,
    });
  } catch (error) {
    return res.json({
      configured: true,
      connected: false,
      error: error.message || 'Connexion YouTube invalide',
    });
  }
});

app.post('/api/youtube/upload', async (req, res) => {
  try {
    const userId = sanitizeString(req.auth?.user?.id);
    if (!userId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const nowIso = new Date().toISOString();
    const jobId = `ytjob_${crypto.randomUUID()}`;
    const payload = JSON.parse(JSON.stringify(req.body || {}));

    setYoutubeUploadJob({
      id: jobId,
      userId,
      status: 'queued',
      createdAt: nowIso,
      updatedAt: nowIso,
      error: null,
      result: null,
    });

    void runYoutubeUploadJob({
      jobId,
      userId,
      payload,
    });

    return res.status(202).json({
      jobId,
      status: 'queued',
    });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Upload YouTube impossible' });
  }
});

app.get('/api/youtube/upload/jobs/:jobId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const userId = sanitizeString(req.auth?.user?.id);
  if (!userId) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  const jobId = sanitizeString(req.params?.jobId);
  if (!jobId) {
    return res.status(400).json({ error: 'jobId requis' });
  }

  const job = youtubeUploadJobs.get(jobId);
  if (!job || sanitizeString(job.userId) !== userId) {
    return res.status(404).json({ error: 'Job YouTube introuvable' });
  }

  return res.json(toYoutubeUploadJobResponse(job));
});

app.post('/api/analytics/events', async (req, res) => {
  try {
    const rawEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.event
        ? [req.body.event]
        : [req.body];

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return res.status(400).json({ error: 'Payload invalide: event(s) requis' });
    }

    const storedEvents = await appendAnalyticsEvents(rawEvents, req);
    if (storedEvents.length === 0) {
      return res.status(400).json({ error: 'Aucun événement valide à enregistrer' });
    }

    return res.json({ stored: storedEvents.length });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erreur analytics' });
  }
});

app.get('/api/analytics/events', async (req, res) => {
  try {
    const projectId = typeof req.query?.projectId === 'string' ? req.query.projectId : '';
    const from = typeof req.query?.from === 'string' ? req.query.from : '';
    const to = typeof req.query?.to === 'string' ? req.query.to : '';
    const limit = typeof req.query?.limit === 'string' ? req.query.limit : '';

    const events = await readAnalyticsEvents({ projectId, from, to, limit });
    return res.json({ count: events.length, events });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Lecture analytics impossible' });
  }
});

app.get('/api/analytics/stats', async (req, res) => {
  try {
    const projectId = typeof req.query?.projectId === 'string' ? req.query.projectId : '';
    const from = typeof req.query?.from === 'string' ? req.query.from : '';
    const to = typeof req.query?.to === 'string' ? req.query.to : '';

    const stats = await getAnalyticsStatsCached({ projectId, from, to });

    return res.json({
      projectId: sanitizeString(projectId) || null,
      from: sanitizeString(from) || null,
      to: sanitizeString(to) || null,
      ...stats,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Stats analytics impossibles' });
  }
});

app.get('/api/media', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const tags = typeof req.query.tags === 'string' ? req.query.tags : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  let filteredFiles = [...mediaFiles];

  if (type) {
    filteredFiles = filteredFiles.filter((file) => file.metadata.type === type);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredFiles = filteredFiles.filter(
      (file) =>
        file.metadata.name.toLowerCase().includes(searchLower) ||
        file.metadata.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  if (tags) {
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    filteredFiles = filteredFiles.filter((file) =>
      tagList.some((tag) => file.metadata.tags.includes(tag))
    );
  }

  res.json(filteredFiles.map(toPublicMediaFile));
});

app.get('/api/media/:id', (req, res) => {
  const { id } = req.params;
  const file = mediaFiles.find((item) => item.metadata.id === id);

  if (!file) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  return res.json(toPublicMediaFile(file));
});

app.delete('/api/media/:id', async (req, res) => {
  const { id } = req.params;
  const fileIndex = mediaFiles.findIndex((item) => item.metadata.id === id);

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  const file = mediaFiles[fileIndex];
  const filePath = toLocalUploadPath(file.filename);
  const thumbnailRelativePath = file.thumbnailFilename
    ? `thumbnails/${file.thumbnailFilename}`
    : null;
  const thumbnailPath = thumbnailRelativePath ? toLocalUploadPath(thumbnailRelativePath) : null;

  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }
    await deleteFromPersistentStorage(file.filename);
    if (thumbnailRelativePath) {
      await deleteFromPersistentStorage(thumbnailRelativePath);
    }

    mediaFiles = mediaFiles.filter((item) => item.metadata.id !== id);
    await saveMediaIndex(mediaFiles);
    return res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur lors de la suppression du fichier' });
  }
});

app.patch('/api/media/:id', async (req, res) => {
  const { id } = req.params;
  const fileIndex = mediaFiles.findIndex((item) => item.metadata.id === id);

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  const updates = req.body;
  const file = mediaFiles[fileIndex];

  if (Array.isArray(updates.tags)) {
    file.metadata.tags = updates.tags.filter((tag) => typeof tag === 'string');
  }
  if (typeof updates.name === 'string' && updates.name.trim()) {
    file.metadata.name = updates.name.trim();
  }

  file.metadata.updatedAt = new Date().toISOString();
  mediaFiles[fileIndex] = file;
  await saveMediaIndex(mediaFiles);

  return res.json(toPublicMediaFile(file));
});

app.use('/api', (req, res) => {
  return res.status(404).json({
    error: 'Route API introuvable',
    path: req.path,
  });
});

if (fs.existsSync(clientIndexPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(clientIndexPath);
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.message === 'Type de fichier non supporté' ? 400 : 500;
  res.status(status).json({ error: err.message });
});

const startServer = async () => {
  try {
    mediaFiles = await loadMediaIndex();
    app.listen(port, () => {
      console.log(`Serveur démarré sur http://localhost:${port}`);
      if (isPersistentStorageEnabled) {
        console.log(`Stockage persistant activé via GCS bucket "${gcsBucketName}"`);
      }
      if (authSessionSecret === 'change-me-in-production') {
        console.warn(
          'AUTH_SESSION_SECRET utilise la valeur par défaut. Définissez une valeur forte en production.'
        );
      }
      if (!isFirebaseAuthEnabled) {
        console.warn(
          'Connexion Google désactivée: définir FIREBASE_PROJECT_ID (et optionnellement FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY).'
        );
      }
    });
  } catch (error) {
    console.error('Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
};

void startServer();
