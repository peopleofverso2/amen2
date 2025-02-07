import { MediaStorageAdapter, MediaFile, MediaMetadata, MediaFilter } from '../../types/media';
import { openDB, IDBPDatabase, deleteDB } from 'idb';

export class LocalStorageAdapter implements MediaStorageAdapter {
  private readonly STORAGE_KEY = 'media_library';
  private static instance: LocalStorageAdapter;
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private static readonly DB_NAME = 'AmenMediaLibrary';
  private static readonly DB_VERSION = 4; 
  private static readonly MEDIA_STORE = 'media';
  private static readonly METADATA_STORE = 'metadata';
  private static readonly THUMBNAIL_STORE = 'thumbnails';

  private urlCache: Map<string, string> = new Map();
  private thumbnailUrlCache: Map<string, string> = new Map();

  private constructor() {
    if (LocalStorageAdapter.instance) {
      return LocalStorageAdapter.instance;
    }
    LocalStorageAdapter.instance = this;
  }

  private async resetDatabase() {
    try {
      this.clearUrlCaches();

      if (this.dbPromise) {
        const db = await this.dbPromise;
        db.close();
        this.dbPromise = null;
      }

      await deleteDB(LocalStorageAdapter.DB_NAME);
      
      return this.getDb();
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  private clearUrlCaches() {
    this.urlCache.forEach((url) => URL.revokeObjectURL(url));
    this.thumbnailUrlCache.forEach((url) => URL.revokeObjectURL(url));
    
    this.urlCache.clear();
    this.thumbnailUrlCache.clear();
  }

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      console.log('Opening database...');
      this.dbPromise = openDB(LocalStorageAdapter.DB_NAME, LocalStorageAdapter.DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
          
          if (oldVersion < newVersion) {
            const storeNames = [...db.objectStoreNames];
            storeNames.forEach(storeName => {
              db.deleteObjectStore(storeName);
            });
          }

          if (!db.objectStoreNames.contains(LocalStorageAdapter.MEDIA_STORE)) {
            console.log('Creating media store');
            db.createObjectStore(LocalStorageAdapter.MEDIA_STORE);
          }
          if (!db.objectStoreNames.contains(LocalStorageAdapter.METADATA_STORE)) {
            console.log('Creating metadata store');
            db.createObjectStore(LocalStorageAdapter.METADATA_STORE);
          }
          if (!db.objectStoreNames.contains(LocalStorageAdapter.THUMBNAIL_STORE)) {
            console.log('Creating thumbnail store');
            db.createObjectStore(LocalStorageAdapter.THUMBNAIL_STORE);
          }
        },
        blocked() {
          console.warn('Database upgrade blocked. Please close other tabs using the app.');
        },
        blocking() {
          console.warn('Database blocking other connections. Closing...');
        },
        terminated() {
          console.error('Database connection terminated unexpectedly.');
        }
      });
    }
    return this.dbPromise;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateThumbnail(file: File): Promise<Blob | null> {
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          canvas.width = 320;
          canvas.height = (video.videoHeight / video.videoWidth) * canvas.width;
          video.currentTime = 1;
        };
        
        video.onseeked = () => {
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(video.src);
              resolve(blob);
            }, 'image/jpeg', 0.7);
          } else {
            URL.revokeObjectURL(video.src);
            resolve(null);
          }
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve(null);
        };
        
        video.src = URL.createObjectURL(file);
      });
    }
    return null;
  }

  async saveMedia(file: File, partialMetadata: Partial<MediaMetadata>): Promise<MediaFile> {
    try {
      const id = partialMetadata.id || this.generateId();
      
      if (this.urlCache.has(id)) {
        URL.revokeObjectURL(this.urlCache.get(id)!);
        this.urlCache.delete(id);
      }
      if (this.thumbnailUrlCache.has(id)) {
        URL.revokeObjectURL(this.thumbnailUrlCache.get(id)!);
        this.thumbnailUrlCache.delete(id);
      }

      const metadata: MediaMetadata = {
        id,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        mimeType: file.type,
        name: file.name,
        size: file.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        ...partialMetadata,
      };

      const db = await this.getDb();
      await db.put(LocalStorageAdapter.MEDIA_STORE, file, id);
      await db.put(LocalStorageAdapter.METADATA_STORE, metadata, id);

      if (file.type.startsWith('video/')) {
        const thumbnail = await this.generateThumbnail(file);
        if (thumbnail) {
          await db.put(LocalStorageAdapter.THUMBNAIL_STORE, thumbnail, id);
        }
      }

      const mediaUrl = URL.createObjectURL(file);
      this.urlCache.set(id, mediaUrl);
      
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('video/')) {
        const thumbnail = await db.get(LocalStorageAdapter.THUMBNAIL_STORE, id);
        if (thumbnail) {
          thumbnailUrl = URL.createObjectURL(thumbnail);
          this.thumbnailUrlCache.set(id, thumbnailUrl);
        }
      }

      return {
        id,
        url: mediaUrl,
        thumbnailUrl,
        metadata,
      };
    } catch (error) {
      console.error('Error in saveMedia:', error);
      if (error instanceof Error && error.name === 'NotFoundError') {
        await this.resetDatabase();
        return this.saveMedia(file, partialMetadata);
      }
      throw error;
    }
  }

  async getMedia(id: string): Promise<MediaFile> {
    try {
      console.log('Getting media with ID:', id);
      const db = await this.getDb();
      const file = await db.get(LocalStorageAdapter.MEDIA_STORE, id);
      const metadata = await db.get(LocalStorageAdapter.METADATA_STORE, id);

      if (!file) {
        throw new Error(`Media not found: ${id}`);
      }

      const finalMetadata = metadata || {
        id,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        mimeType: file.type || 'video/mp4',
        name: 'Unknown',
        size: file.size || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      };

      let mediaUrl = this.urlCache.get(id);
      if (!mediaUrl) {
        mediaUrl = URL.createObjectURL(file);
        this.urlCache.set(id, mediaUrl);
      }

      let thumbnailUrl = this.thumbnailUrlCache.get(id);
      if (!thumbnailUrl && finalMetadata.type === 'video') {
        const thumbnail = await db.get(LocalStorageAdapter.THUMBNAIL_STORE, id);
        if (thumbnail) {
          thumbnailUrl = URL.createObjectURL(thumbnail);
          this.thumbnailUrlCache.set(id, thumbnailUrl);
        }
      }

      return {
        id,
        url: mediaUrl,
        thumbnailUrl,
        metadata: finalMetadata,
      };
    } catch (error) {
      console.error('Error in getMedia:', error);
      if (error instanceof Error && error.name === 'NotFoundError') {
        await this.resetDatabase();
        return this.getMedia(id);
      }
      throw error;
    }
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    try {
      const db = await this.getDb();
      const mediaKeys = await db.getAllKeys(LocalStorageAdapter.MEDIA_STORE);
      const mediaFiles = await Promise.all(
        mediaKeys.map(async (id) => {
          try {
            return await this.getMedia(id as string);
          } catch (error) {
            console.error(`Error loading media ${id}:`, error);
            return null;
          }
        })
      );

      const validMediaFiles = mediaFiles.filter((file): file is MediaFile => file !== null);
      return filter ? validMediaFiles.filter(file => this.matchesFilter(file.metadata, filter)) : validMediaFiles;
    } catch (error) {
      console.error('Error in listMedia:', error);
      if (error instanceof Error && error.name === 'NotFoundError') {
        await this.resetDatabase();
        return this.listMedia(filter);
      }
      throw error;
    }
  }

  private matchesFilter(metadata: MediaMetadata, filter: MediaFilter): boolean {
    if (filter.type && metadata.type !== filter.type) return false;
    if (filter.tags && filter.tags.length > 0) {
      if (!metadata.tags.some(tag => filter.tags!.includes(tag))) return false;
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const nameMatch = metadata.name.toLowerCase().includes(searchLower);
      const tagMatch = metadata.tags.some(tag => tag.toLowerCase().includes(searchLower));
      if (!nameMatch && !tagMatch) return false;
    }
    return true;
  }

  async deleteMedia(id: string): Promise<void> {
    try {
      if (this.urlCache.has(id)) {
        URL.revokeObjectURL(this.urlCache.get(id)!);
        this.urlCache.delete(id);
      }
      if (this.thumbnailUrlCache.has(id)) {
        URL.revokeObjectURL(this.thumbnailUrlCache.get(id)!);
        this.thumbnailUrlCache.delete(id);
      }

      const db = await this.getDb();
      await db.delete(LocalStorageAdapter.MEDIA_STORE, id);
      await db.delete(LocalStorageAdapter.METADATA_STORE, id);
      await db.delete(LocalStorageAdapter.THUMBNAIL_STORE, id);
    } catch (error) {
      console.error('Error in deleteMedia:', error);
      throw error;
    }
  }

  async updateMetadata(id: string, updates: Partial<MediaMetadata>): Promise<MediaFile> {
    try {
      const db = await this.getDb();
      const currentMetadata = await db.get(LocalStorageAdapter.METADATA_STORE, id);
      
      if (!currentMetadata) {
        throw new Error(`Metadata not found for media: ${id}`);
      }

      const updatedMetadata = {
        ...currentMetadata,
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
      };

      await db.put(LocalStorageAdapter.METADATA_STORE, updatedMetadata, id);

      return this.getMedia(id);
    } catch (error) {
      console.error('Error in updateMetadata:', error);
      if (error instanceof Error && error.name === 'NotFoundError') {
        await this.resetDatabase();
        return this.updateMetadata(id, updates);
      }
      throw error;
    }
  }

  public static getInstance(): LocalStorageAdapter {
    if (!LocalStorageAdapter.instance) {
      LocalStorageAdapter.instance = new LocalStorageAdapter();
    }
    return LocalStorageAdapter.instance;
  }
}
