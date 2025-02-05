import { MediaStorageAdapter, MediaFile, MediaMetadata, MediaFilter } from '../../types/media';

export class LocalStorageAdapter implements MediaStorageAdapter {
  private readonly STORAGE_KEY = 'media_library';
  private readonly FILE_STORAGE_KEY = 'media_files';

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
    const id = this.generateId();
    const url = URL.createObjectURL(file);

    // Créer les métadonnées complètes
    const metadata: MediaMetadata = {
      id,
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      mimeType: file.type,
      size: file.size,
      tags: partialMetadata.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partialMetadata
    };

    // Stocker dans IndexedDB pour une persistance plus robuste
    const request = indexedDB.open('MediaLibrary', 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      // Stocker le fichier et les métadonnées
      const fileData = await file.arrayBuffer();
      store.put({ id, data: fileData, metadata });
    };

    // Mettre à jour les métadonnées dans localStorage
    const storedMetadata = await this.getStoredMetadata();
    storedMetadata[id] = metadata;
    await this.saveStoredMetadata(storedMetadata);

    return { metadata, url };
  }

  async getMedia(id: string): Promise<MediaFile> {
    const storedMetadata = await this.getStoredMetadata();
    const metadata = storedMetadata[id];
    
    if (!metadata) {
      throw new Error(`Media not found: ${id}`);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MediaLibrary', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const file = getRequest.result;
          if (file) {
            const blob = new Blob([file.data], { type: metadata.mimeType });
            const url = URL.createObjectURL(blob);
            resolve({ metadata, url });
          } else {
            reject(new Error(`File not found: ${id}`));
          }
        };
      };
    });
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    const storedMetadata = await this.getStoredMetadata();
    
    let filteredMetadata = Object.values(storedMetadata);

    if (filter) {
      if (filter.type) {
        filteredMetadata = filteredMetadata.filter(m => m.type === filter.type);
      }
      if (filter.tags?.length) {
        filteredMetadata = filteredMetadata.filter(m => 
          filter.tags!.some(tag => m.tags.includes(tag))
        );
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        filteredMetadata = filteredMetadata.filter(m =>
          m.name.toLowerCase().includes(search) ||
          m.tags.some(tag => tag.toLowerCase().includes(search))
        );
      }
    }

    // Charger les fichiers pour chaque métadonnée
    return Promise.all(
      filteredMetadata.map(metadata => this.getMedia(metadata.id))
    );
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
