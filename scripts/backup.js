import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createBackup() {
  // Créer le dossier de backup s'il n'existe pas
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  // Nom du fichier de backup avec timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `amen-backup-${timestamp}.zip`);

  // Créer le stream de sortie
  const output = fs.createWriteStream(backupFile);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Compression maximale
  });

  // Gérer les événements
  output.on('close', () => {
    console.log(`\n✅ Backup créé avec succès: ${backupFile}`);
    console.log(`📦 Taille totale: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  // Pipe l'archive vers le fichier de sortie
  archive.pipe(output);

  // Ajouter les fichiers du projet
  console.log('\n📂 Ajout des fichiers du projet...');
  archive.glob('**/*', {
    cwd: path.join(__dirname, '..'),
    ignore: [
      'node_modules/**',
      'backups/**',
      'dist/**',
      '.git/**',
      '*.log',
      '.DS_Store'
    ]
  });

  // Ajouter package.json et package-lock.json
  console.log('📄 Ajout des fichiers de dépendances...');
  archive.file(path.join(__dirname, '..', 'package.json'), { name: 'package.json' });
  archive.file(path.join(__dirname, '..', 'package-lock.json'), { name: 'package-lock.json' });

  // Ajouter le dossier node_modules
  console.log('📚 Ajout des node_modules...');
  archive.directory(path.join(__dirname, '..', 'node_modules'), 'node_modules');

  // Exporter IndexedDB
  console.log('💾 Export de la base de données...');

  // Créer une page HTML temporaire pour l'export
  const exportHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Export IndexedDB</title>
  </head>
  <body>
    <script>
      const exportDb = async () => {
        const dbs = await window.indexedDB.databases();
        const exports = {};
        
        for (const db of dbs) {
          const request = indexedDB.open(db.name);
          const dbData = await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
              const db = event.target.result;
              const stores = Array.from(db.objectStoreNames);
              const data = {};
              
              let completed = 0;
              stores.forEach(storeName => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = () => {
                  data[storeName] = request.result;
                  completed++;
                  if (completed === stores.length) {
                    resolve(data);
                  }
                };
              });
            };
            request.onerror = () => reject(request.error);
          });
          exports[db.name] = dbData;
        }
        return exports;
      };

      exportDb().then(data => {
        window.exportedData = data;
      }).catch(console.error);
    </script>
  </body>
  </html>
  `;

  const tempHtmlPath = path.join(__dirname, 'temp-export.html');
  fs.writeFileSync(tempHtmlPath, exportHtml);

  try {
    // Lancer un navigateur headless
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Charger la page temporaire
    await page.goto(`file://${tempHtmlPath}`);
    
    // Attendre l'export et récupérer les données
    const dbData = await page.evaluate(() => window.exportedData);
    
    // Fermer le navigateur
    await browser.close();
    
    // Ajouter les données de la base au zip
    if (dbData) {
      archive.append(JSON.stringify(dbData), { name: 'database-backup.json' });
    }
  } catch (error) {
    console.error('⚠️ Erreur lors de l\'export de la base de données:', error);
  } finally {
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempHtmlPath);
  }

  // Finaliser l'archive
  await archive.finalize();
}

// Exécuter le backup
createBackup().catch(console.error);
