import { MediaStorageAdapter, MediaFile, MediaFilter, MediaMetadata } from '../../types/media';

const API_BASE_URL = '/api';
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_UPLOAD_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const extractErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // Ignore JSON parsing errors and fallback to text/default.
    }
  }

  try {
    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch {
    // Ignore text parsing errors and fallback below.
  }

  return `HTTP ${response.status}`;
};

export class ServerStorageAdapter implements MediaStorageAdapter {
  async saveMedia(file: File, metadata: Partial<MediaMetadata>): Promise<MediaFile> {
    let attempt = 0;

    while (attempt <= MAX_UPLOAD_RETRIES) {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata.tags) {
        formData.append('tags', JSON.stringify(metadata.tags));
      }

      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        return response.json();
      }

      const message = await extractErrorMessage(response);
      const isRetryable =
        RETRYABLE_STATUSES.has(response.status) && attempt < MAX_UPLOAD_RETRIES;

      if (isRetryable) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await wait(delay);
        attempt += 1;
        continue;
      }

      throw new Error(`Upload impossible (${response.status}): ${message}`);
    }

    throw new Error('Upload impossible: tentatives épuisées');
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
