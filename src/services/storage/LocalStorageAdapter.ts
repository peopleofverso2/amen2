import { MediaStorageAdapter, MediaFile, MediaMetadata, MediaFilter } from '../../types/media';

export class LocalStorageAdapter implements MediaStorageAdapter {
  private readonly STORAGE_KEY = 'media_library';
  private readonly FILE_STORAGE_KEY = 'media_files';
  private static instance: LocalStorageAdapter;

  private constructor() {}

  public static getInstance(): LocalStorageAdapter {
    if (!LocalStorageAdapter.instance) {
      LocalStorageAdapter.instance = new LocalStorageAdapter();
    }
    return LocalStorageAdapter.instance;
  }

  private async getStoredMetadata(): Promise<Record<string, MediaMetadata>> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  private async saveStoredMetadata(metadata: Record<string, MediaMetadata>): Promise<void> {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(metadata));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveMedia(file: File, partialMetadata: Partial<MediaMetadata>): Promise<MediaFile> {
    // Utiliser l'ID fourni ou en générer un nouveau
    const id = partialMetadata.id || this.generateId();

    // Créer les métadonnées complètes
    const metadata: MediaMetadata = {
      id,
      name: file.name,
      type: 'unknown',
      mimeType: file.type,
      size: file.size,
      tags: [],
      ...partialMetadata
    };

    // Sauvegarder le fichier dans IndexedDB
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('MediaLibrary', 1);
      
      request.onerror = () => reject(new Error(`Failed to open database: ${request.error}`));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        try {
          const db = request.result;
          const transaction = db.transaction(['files'], 'readwrite');
          const store = transaction.objectStore('files');
          
          // Stocker le blob directement
          store.put({ id, data: file });

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(new Error(`Failed to save file: ${transaction.error}`));
        } catch (error) {
          reject(new Error(`Failed to write to IndexedDB: ${error}`));
        }
      };
    });

    // Sauvegarder les métadonnées dans localStorage
    const storedMetadata = await this.getStoredMetadata();
    storedMetadata[id] = metadata;
    await this.saveStoredMetadata(storedMetadata);

    // Créer une URL pour le fichier
    const url = URL.createObjectURL(file);

    return { metadata, url };
  }

  async getMedia(id: string): Promise<MediaFile> {
    const storedMetadata = await this.getStoredMetadata();
    const metadata = storedMetadata[id];
    
    if (!metadata) {
      throw new Error(`Media not found in metadata: ${id}`);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MediaLibrary', 1);
      
      request.onerror = () => reject(new Error(`Failed to open database: ${request.error}`));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        try {
          const db = request.result;
          const transaction = db.transaction(['files'], 'readonly');
          const store = transaction.objectStore('files');
          
          const getRequest = store.get(id);
          
          getRequest.onerror = () => reject(new Error(`Failed to get file: ${getRequest.error}`));
          
          getRequest.onsuccess = () => {
            const file = getRequest.result;
            if (!file || !file.data) {
              // Si le fichier n'est pas trouvé dans IndexedDB mais qu'on a les métadonnées,
              // on retourne quand même un MediaFile avec les métadonnées
              resolve({ metadata, url: '' });
              return;
            }
            
            try {
              // file.data est déjà un Blob, pas besoin de le recréer
              const url = URL.createObjectURL(file.data);
              resolve({ metadata, url });
            } catch (error) {
              reject(new Error(`Failed to create blob: ${error}`));
            }
          };
        } catch (error) {
          reject(new Error(`Failed to read from IndexedDB: ${error}`));
        }
      };
    });
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    try {
      // Récupérer les métadonnées
      const storedMetadata = await this.getStoredMetadata();
      
      // Créer un Map pour éviter les doublons
      const mediaMap = new Map<string, MediaFile>();
      
      // Filtrer les métadonnées selon les critères
      for (const [id, metadata] of Object.entries(storedMetadata)) {
        if (this.matchesFilter(metadata, filter)) {
          try {
            const mediaFile = await this.getMedia(id);
            mediaMap.set(id, mediaFile);
          } catch (error) {
            console.warn(`Failed to load media ${id}:`, error);
          }
        }
      }
      
      // Convertir le Map en tableau
      return Array.from(mediaMap.values());
    } catch (error) {
      console.error('Error listing media:', error);
      return [];
    }
  }

  private matchesFilter(metadata: MediaMetadata, filter?: MediaFilter): boolean {
    if (!filter) return true;

    if (filter.type && metadata.type !== filter.type) return false;
    if (filter.tags?.length && !filter.tags.some(tag => metadata.tags.includes(tag))) return false;
    if (filter.search && !(metadata.name.toLowerCase().includes(filter.search.toLowerCase()) || metadata.tags.some(tag => tag.toLowerCase().includes(filter.search.toLowerCase())))) return false;

    return true;
  }

  async deleteMedia(id: string): Promise<void> {
    const storedMetadata = await this.getStoredMetadata();
    delete storedMetadata[id];
    await this.saveStoredMetadata(storedMetadata);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MediaLibrary', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        const deleteRequest = store.delete(id);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(new Error('Failed to delete file'));
      };
    });
  }

  async updateMetadata(id: string, updates: Partial<MediaMetadata>): Promise<MediaFile> {
    const storedMetadata = await this.getStoredMetadata();
    const existing = storedMetadata[id];
    
    if (!existing) {
      throw new Error(`Media not found: ${id}`);
    }

    const updated: MediaMetadata = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    storedMetadata[id] = updated;
    await this.saveStoredMetadata(storedMetadata);

    return this.getMedia(id);
  }
}
