import { MediaStorageAdapter, MediaFile, MediaMetadata, MediaFilter } from '../types/media';
import { ServerStorageAdapter } from './storage/ServerStorageAdapter';

export class MediaLibraryService {
  private storageAdapter: MediaStorageAdapter;

  constructor(adapter?: MediaStorageAdapter) {
    // Par défaut, utilise l'adaptateur serveur
    this.storageAdapter = adapter || new ServerStorageAdapter();
  }

  // Change l'adaptateur de stockage (utile pour la migration vers le serveur)
  setStorageAdapter(adapter: MediaStorageAdapter) {
    this.storageAdapter = adapter;
  }

  async uploadMedia(file: File, metadata: Partial<MediaMetadata> = {}): Promise<MediaFile> {
    // Validation du fichier
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      throw new Error('Type de fichier non supporté');
    }

    // Extraction automatique des métadonnées
    const autoMetadata: Partial<MediaMetadata> = {
      ...metadata,
      type: file.type.startsWith('video/') ? 'video' : 'image',
    };

    // Pour les vidéos, extraire la durée
    if (file.type.startsWith('video/')) {
      const duration = await this.getVideoDuration(file);
      autoMetadata.duration = duration;
    }

    // Pour les images et les vidéos, extraire les dimensions
    const dimensions = await this.getMediaDimensions(file);
    if (dimensions) {
      autoMetadata.dimensions = dimensions;
    }

    return this.storageAdapter.saveMedia(file, autoMetadata);
  }

  private getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  }

  private getMediaDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          resolve({ width: img.width, height: img.height });
        };
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve({ width: video.videoWidth, height: video.videoHeight });
        };
        video.src = URL.createObjectURL(file);
      } else {
        resolve(undefined);
      }
    });
  }

  // Méthodes de l'interface MediaStorageAdapter déléguées à l'adaptateur
  async getMedia(id: string): Promise<MediaFile> {
    return this.storageAdapter.getMedia(id);
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    return this.storageAdapter.listMedia(filter);
  }

  async deleteMedia(id: string): Promise<void> {
    return this.storageAdapter.deleteMedia(id);
  }

  async updateMetadata(id: string, metadata: Partial<MediaMetadata>): Promise<MediaFile> {
    return this.storageAdapter.updateMetadata(id, metadata);
  }
}
