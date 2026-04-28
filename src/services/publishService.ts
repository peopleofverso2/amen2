import { CustomEdge, CustomNode } from '../types/nodes';

interface PublishLinkRequest {
  projectId?: string;
  title: string;
  description?: string;
  nodes: CustomNode[];
  edges: CustomEdge[];
}

export interface PublishedScenarioPayload {
  slug: string;
  projectId: string | null;
  title: string;
  description: string;
  publishedAt: string | null;
  updatedAt: string | null;
  url: string;
  embedCode: string;
  scenario: {
    nodes: CustomNode[];
    edges: CustomEdge[];
  };
}

interface PublishLinkResponse {
  slug: string;
  projectId: string | null;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
  embedCode: string;
}

const parseApiError = async (response: Response, fallbackMessage: string) => {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

export const publishService = {
  async publishScenarioLink(input: PublishLinkRequest): Promise<PublishLinkResponse> {
    const response = await fetch('/api/publish/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const message = await parseApiError(response, 'Publication impossible');
      throw new Error(message);
    }

    return (await response.json()) as PublishLinkResponse;
  },

  async getPublishedScenario(slug: string): Promise<PublishedScenarioPayload> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new Error('Slug manquant');
    }

    const response = await fetch(`/api/published/${encodeURIComponent(normalizedSlug)}`);
    if (!response.ok) {
      const message = await parseApiError(response, 'Publication introuvable');
      throw new Error(message);
    }

    return (await response.json()) as PublishedScenarioPayload;
  },
};

export default publishService;
