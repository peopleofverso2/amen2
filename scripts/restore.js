import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fonction pour restaurer un backup
async function restoreBackup(backupPath) {
  console.log('\n🔄 Début de la restauration...');
  
  const zip = new AdmZip(backupPath);
  const backupDir = path.dirname(backupPath);
  const extractDir = path.join(backupDir, 'temp-restore');
  
  // Nettoyer le dossier temporaire s'il existe
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true });
  }
  
  // Extraire l'archive
  console.log('📂 Extraction des fichiers...');
  zip.extractAllTo(extractDir, true);
  
  // Restaurer les fichiers du projet
  console.log('📄 Restauration des fichiers du projet...');
  const projectFiles = zip.getEntries().filter(entry => 
    !entry.entryName.startsWith('node_modules/') && 
    entry.entryName !== 'database-backup.json'
  );
  
  projectFiles.forEach(entry => {
    const targetPath = path.join(__dirname, '..', entry.entryName);
    const targetDir = path.dirname(targetPath);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    if (!entry.isDirectory) {
      fs.writeFileSync(targetPath, entry.getData());
    }
  });
  
  // Restaurer les dépendances
  console.log('📚 Installation des dépendances...');
  execSync('npm install', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  
  // Restaurer la base de données
  console.log('💾 Restauration de la base de données...');
  const dbBackupPath = path.join(extractDir, 'database-backup.json');
  if (fs.existsSync(dbBackupPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbBackupPath, 'utf8'));
    
    const restoreScript = `
    import { openDB } from 'idb';
    
    const dbData = ${JSON.stringify(dbData)};
    
    async function restoreDb() {
      for (const [dbName, data] of Object.entries(dbData)) {
        // Supprimer l'ancienne base si elle existe
        await openDB(dbName, 1, {
          upgrade(db) {
            db.deleteObjectStore(dbName);
          }
        });
        
        // Créer la nouvelle base
        const db = await openDB(dbName, 1, {
          upgrade(db) {
            // Créer les object stores
            for (const [storeName, items] of Object.entries(data)) {
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
              }
            }
          }
        });
        
        // Restaurer les données
        for (const [storeName, items] of Object.entries(data)) {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          
          for (const item of items) {
            store.put(item);
          }
        }
        await tx.done;
      }
      console.log('Base de données restaurée avec succès');
    }
    
    restoreDb().catch(console.error);
    `;
    
    // Créer un fichier temporaire pour le script de restauration
    const tempScriptPath = path.join(__dirname, 'temp-restore.js');
    fs.writeFileSync(tempScriptPath, restoreScript);
    
    try {
      // Exécuter le script avec Node.js
      execSync(`node ${tempScriptPath}`);
    } catch (error) {
      console.error('⚠️ Erreur lors de la restauration de la base de données:', error);
    } finally {
      // Nettoyer le fichier temporaire
      fs.unlinkSync(tempScriptPath);
    }
  }
  
  // Nettoyer le dossier temporaire
  fs.rmSync(extractDir, { recursive: true });
  
  console.log('\n✅ Restauration terminée avec succès !');
}

// Si un chemin de backup est fourni en argument
const backupPath = process.argv[2];
if (backupPath) {
  restoreBackup(backupPath);
} else {
  console.error('❌ Veuillez spécifier le chemin du fichier de backup à restaurer.');
  process.exit(1);
}
