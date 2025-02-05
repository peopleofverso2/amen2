import { ProjectExport } from '../types/export';
import { Project } from '../types/project';
import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from '../types/nodes';

export class ExportService {
  private static instance: ExportService;
  private readonly version = '1.0.0';

  private constructor() {}

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  public async exportProject(
    project: Project,
    nodes: Node<CustomNode>[],
    edges: Edge<CustomEdge>[]
  ): Promise<ProjectExport> {
    const resources = await this.collectResources(nodes);
    
    const exportData: ProjectExport = {
      version: this.version,
      name: project.name,
      description: project.description,
      scenario: {
        nodes: await Promise.all(nodes.map(async node => ({
          id: node.id,
          type: node.type || 'default',
          position: node.position,
          data: {
            ...node.data,
            videoHash: node.data?.videoUrl ? await this.hashUrl(node.data.videoUrl) : undefined,
          },
        }))),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        })),
      },
      resources,
      metadata: {
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    };

    return exportData;
  }

  public async importProject(data: ArrayBuffer): Promise<{
    project: Project;
    nodes: Node<CustomNode>[];
    edges: Edge<CustomEdge>[];
  }> {
    const textDecoder = new TextDecoder('utf-8');
    const jsonString = textDecoder.decode(data);
    const exportData: ProjectExport = JSON.parse(jsonString);

    // Vérifier la version
    if (!this.isVersionCompatible(exportData.version)) {
      throw new Error(`Version ${exportData.version} non compatible. Version attendue: ${this.version}`);
    }

    // Restaurer les ressources
    const resourceMap = new Map<string, string>();
    for (const resource of exportData.resources) {
      const url = await this.createBlobUrl(resource.data, resource.mimeType);
      resourceMap.set(resource.hash, url);
    }

    // Restaurer les nœuds
    const nodes = exportData.scenario.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        videoUrl: node.data.videoHash ? resourceMap.get(node.data.videoHash) : node.data.videoUrl,
      },
    }));

    // Restaurer les edges
    const edges = exportData.scenario.edges;

    // Créer le projet
    const project: Project = {
      id: crypto.randomUUID(),
      name: exportData.name,
      description: exportData.description,
      nodes,
      edges,
      createdAt: new Date(exportData.metadata.createdAt),
      updatedAt: new Date(exportData.metadata.updatedAt),
    };

    return { project, nodes, edges };
  }

  private async collectResources(nodes: Node<CustomNode>[]): Promise<ProjectExport['resources']> {
    const resources: ProjectExport['resources'] = [];
    
    for (const node of nodes) {
      if (node.data?.videoUrl) {
        try {
          const response = await fetch(node.data.videoUrl);
          const blob = await response.blob();
          const base64 = await this.blobToBase64(blob);
          const hash = await this.hashUrl(node.data.videoUrl);
          
          resources.push({
            hash,
            originalName: this.getFilenameFromUrl(node.data.videoUrl),
            mimeType: blob.type,
            data: base64,
          });
        } catch (error) {
          console.error(`Erreur lors de la collecte de la ressource ${node.data.videoUrl}`, error);
        }
      }
    }

    return resources;
  }

  private async hashUrl(url: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async createBlobUrl(base64Data: string, mimeType: string): Promise<string> {
    const response = await fetch(base64Data);
    const blob = await response.blob();
    return URL.createObjectURL(new Blob([blob], { type: mimeType }));
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.substring(pathname.lastIndexOf('/') + 1);
    } catch {
      return 'unknown';
    }
  }

  private isVersionCompatible(version: string): boolean {
    const [major1] = this.version.split('.');
    const [major2] = version.split('.');
    return major1 === major2;
  }
}
