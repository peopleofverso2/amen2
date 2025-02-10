import { MediaStorageAdapter, MediaFile, MediaMetadata, MediaFilter } from '../types/media';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter';

export class MediaLibraryService {
  private static instance: MediaLibraryService;
  private storageAdapter: MediaStorageAdapter;
  private urlCache: Map<string, string> = new Map();

  private constructor(adapter?: MediaStorageAdapter) {
    this.storageAdapter = adapter || LocalStorageAdapter.getInstance();
  }

  public static getInstance(adapter?: MediaStorageAdapter): MediaLibraryService {
    if (!MediaLibraryService.instance) {
      MediaLibraryService.instance = new MediaLibraryService(adapter);
    }
    return MediaLibraryService.instance;
  }

  setStorageAdapter(adapter: MediaStorageAdapter) {
    this.storageAdapter = adapter;
  }

  async uploadMedia(file: File, metadata: Partial<MediaMetadata> = {}): Promise<MediaFile> {
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      throw new Error('Type de fichier non supporté');
    }

    const autoMetadata: Partial<MediaMetadata> = {
      ...metadata,
      type: file.type.startsWith('video/') ? 'video' : 'image',
    };

    if (file.type.startsWith('video/')) {
      const duration = await this.getVideoDuration(file);
      autoMetadata.duration = duration;
    }

    const dimensions = await this.getMediaDimensions(file);
    if (dimensions) {
      autoMetadata.dimensions = dimensions;
    }

    const mediaFile = await this.storageAdapter.saveMedia(file, autoMetadata);
    
    // Mettre en cache l'URL
    if (mediaFile.url) {
      this.urlCache.set(mediaFile.id, mediaFile.url);
    }

    return mediaFile;
  }

  private getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const url = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = url;
    });
  }

  private getMediaDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ width: img.width, height: img.height });
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        
        img.src = url;
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve({ width: video.videoWidth, height: video.videoHeight });
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load video metadata'));
        };
        
        video.src = url;
      } else {
        resolve(undefined);
      }
    });
  }

  async getMedia(id: string): Promise<MediaFile> {
    // Vérifier si l'URL est en cache
    const cachedUrl = this.urlCache.get(id);
    if (cachedUrl) {
      const media = await this.storageAdapter.getMedia(id);
      return { ...media, url: cachedUrl };
    }

    const media = await this.storageAdapter.getMedia(id);
    
    // Mettre en cache la nouvelle URL
    if (media.url) {
      this.urlCache.set(id, media.url);
    }
    
    return media;
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    const mediaFiles = await this.storageAdapter.listMedia(filter);
    
    // Mettre à jour le cache des URLs
    mediaFiles.forEach(media => {
      if (media.url) {
        this.urlCache.set(media.id, media.url);
      }
    });
    
    return mediaFiles;
  }

  async deleteMedia(id: string): Promise<void> {
    // Révoquer l'URL du cache
    const cachedUrl = this.urlCache.get(id);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      this.urlCache.delete(id);
    }
    
    return this.storageAdapter.deleteMedia(id);
  }

  async updateMetadata(id: string, metadata: Partial<MediaMetadata>): Promise<MediaFile> {
    return this.storageAdapter.updateMetadata(id, metadata);
  }

  async checkMediaExists(mediaId: string): Promise<boolean> {
    try {
      const media = await this.storageAdapter.getMedia(mediaId);
      return !!media;
    } catch (error) {
      console.error('Error checking media existence:', error);
      return false;
    }
  }
}
