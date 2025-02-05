export interface ProjectExport {
  version: string;
  name: string;
  description?: string;
  scenario: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: {
        label?: string;
        videoUrl?: string;
        videoHash?: string;
      };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
    }>;
  };
  resources: Array<{
    hash: string;
    originalName: string;
    mimeType: string;
    data: string; // Base64 encoded
  }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    author?: string;
  };
}
