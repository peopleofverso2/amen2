import { MediaStorageAdapter, MediaFile, MediaFilter, MediaMetadata } from '../../types/media';

const API_BASE_URL = '/api';

export class ServerStorageAdapter implements MediaStorageAdapter {
  async saveMedia(file: File, metadata: Partial<MediaMetadata>): Promise<MediaFile> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.tags) {
      formData.append('tags', JSON.stringify(metadata.tags));
    }

    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload media');
    }

    return response.json();
  }

  async getMedia(id: string): Promise<MediaFile> {
    const response = await fetch(`${API_BASE_URL}/media/${id}`);
    if (!response.ok) {
      throw new Error('Failed to get media');
    }
    return response.json();
  }

  async listMedia(filter?: MediaFilter): Promise<MediaFile[]> {
    const params = new URLSearchParams();
    if (filter?.type) {
      params.append('type', filter.type);
    }
    if (filter?.tags) {
      params.append('tags', filter.tags.join(','));
    }
    if (filter?.search) {
      params.append('search', filter.search);
    }

    const url = `${API_BASE_URL}/media${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to list media');
    }
    return response.json();
  }

  async deleteMedia(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/media/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete media');
    }
  }

  async updateMetadata(id: string, metadata: Partial<MediaMetadata>): Promise<MediaFile> {
    const response = await fetch(`${API_BASE_URL}/media/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      throw new Error('Failed to update media metadata');
    }
    return response.json();
  }

  async uploadMedia(file: File, metadata: Partial<MediaMetadata> = {}): Promise<MediaFile> {
    return this.saveMedia(file, metadata);
  }
}
