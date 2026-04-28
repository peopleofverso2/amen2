export interface MediaMetadata {
  id: string;
  name: string;
  type: 'video' | 'image';
  mimeType: string;
  size: number;
  duration?: number; // Pour les vidéos
  dimensions?: {
    width: number;
    height: number;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaFile {
  metadata: MediaMetadata;
  url: string; // URL locale ou distante
  thumbnailUrl?: string; // URL de la vignette pour les vidéos
}

// Interface abstraite pour le stockage
export interface MediaStorageAdapter {
  saveMedia(file: File, metadata: Partial<MediaMetadata>): Promise<MediaFile>;
  getMedia(id: string): Promise<MediaFile>;
  listMedia(filter?: MediaFilter): Promise<MediaFile[]>;
  deleteMedia(id: string): Promise<void>;
  updateMetadata(id: string, metadata: Partial<MediaMetadata>): Promise<MediaFile>;
}

export interface MediaFilter {
  type?: 'video' | 'image';
  tags?: string[];
  search?: string;
}
