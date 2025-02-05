import { Node } from 'reactflow';
import { Project } from '../types/project';
import { VideoNodeData } from '../types/nodes';

interface ExportData {
  project: Project;
  resources: Resource[];
  version: string;
}

interface Resource {
  id: string;
  data: string; // Base64 du fichier complet
  type: string;
  nodeId: string;
  mimeType: string;
  filename: string;
}

export class ExportService {
  private readonly VERSION = "2.0.0";

  async exportProject(project: Project): Promise<Blob> {
    try {
      console.log('Starting project export:', project.name);

      // Vérifier que le projet a des nœuds
      if (!project.nodes) {
        project.nodes = [];
      }

      // Collecter et intégrer toutes les ressources
      const resources = await this.collectResources(project.nodes);
      console.log('Resources collected:', resources.length);

      // Créer les données d'export avec les ressources intégrées
      const exportData: ExportData = {
        project: {
          ...project,
          nodes: project.nodes.map(node => {
            if (node.type === 'video' || node.data?.videoUrl) {
              // Remplacer les URLs par des références aux ressources
              const videoUrl = node.data?.videoUrl;
              const resource = resources.find(r => r.nodeId === node.id);
              if (resource) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    videoUrl: `resource://${resource.id}`,
                    originalFilename: resource.filename
                  }
                };
              }
            }
            return node;
          })
        },
        resources,
        version: this.VERSION
      };

      // Créer le blob final
      const json = JSON.stringify(exportData);
      const blob = new Blob([json], { type: 'application/json' });
      
      console.log('Export complete. Size:', blob.size);
      return blob;
    } catch (error) {
      console.error('Error during export:', error);
      throw error;
    }
  }

  async importProject(file: File): Promise<Project> {
    try {
      console.log('Starting project import');
      const text = await file.text();
      const importData: ExportData = JSON.parse(text);

      if (!importData.version) {
        throw new Error('Invalid project file: missing version');
      }

      if (!importData.project) {
        throw new Error('Invalid project file: missing project data');
      }

      // S'assurer que le projet a les propriétés requises
      if (!importData.project.nodes) {
        importData.project.nodes = [];
      }
      if (!importData.project.edges) {
        importData.project.edges = [];
      }

      // Restaurer les ressources
      if (importData.resources && importData.resources.length > 0) {
        console.log('Restoring', importData.resources.length, 'resources');
        
        for (const node of importData.project.nodes) {
          if (node.type === 'video' || node.data?.videoUrl) {
            const videoUrl = node.data?.videoUrl;
            if (videoUrl?.startsWith('resource://')) {
              const resourceId = videoUrl.replace('resource://', '');
              const resource = importData.resources.find(r => r.id === resourceId);
              
              if (resource && resource.data) {
                try {
                  // Créer un blob à partir des données
                  const blob = await this.base64ToBlob(resource.data, resource.mimeType);
                  const blobUrl = URL.createObjectURL(blob);
                  
                  // Mettre à jour l'URL dans le nœud
                  node.data = {
                    ...node.data,
                    videoUrl: blobUrl,
                    originalFilename: resource.filename
                  };
                  
                  console.log('Resource restored:', resource.filename);
                } catch (error) {
                  console.error('Failed to restore resource:', resource.id, error);
                }
              } else {
                console.warn('Resource not found:', resourceId);
              }
            }
          }
        }
      }

      console.log('Import complete');
      return importData.project;
    } catch (error) {
      console.error('Error during import:', error);
      throw new Error('Failed to import project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async collectResources(nodes: Node[]): Promise<Resource[]> {
    const resources: Resource[] = [];
    const processedNodes = new Set<string>();

    if (!Array.isArray(nodes)) {
      console.warn('No nodes to process or invalid nodes array');
      return resources;
    }

    for (const node of nodes) {
      try {
        // Éviter les doublons
        if (processedNodes.has(node.id)) continue;
        processedNodes.add(node.id);

        let videoUrl = '';
        if (node.type === 'video') {
          videoUrl = (node.data as VideoNodeData)?.videoUrl;
        } else if (node.data?.videoUrl) {
          videoUrl = node.data.videoUrl;
        }

        if (!videoUrl) continue;

        try {
          // Récupérer le fichier vidéo complet
          const response = await fetch(videoUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.statusText}`);
          }

          // Obtenir le fichier comme blob
          const blob = await response.blob();
          
          // Convertir en base64
          const base64 = await this.blobToBase64(blob);
          
          // Extraire le nom du fichier de l'URL
          const filename = this.extractFilename(videoUrl);

          // Créer la ressource
          resources.push({
            id: this.generateResourceId(),
            data: base64,
            type: 'video',
            nodeId: node.id,
            mimeType: blob.type || 'video/mp4',
            filename
          });

          console.log('Video collected:', filename);
        } catch (error) {
          console.error('Error collecting video for node:', node.id, error);
        }
      } catch (error) {
        console.error('Error processing node:', node.id, error);
      }
    }

    return resources;
  }

  private generateResourceId(): string {
    return 'resource-' + Math.random().toString(36).substr(2, 9);
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async base64ToBlob(base64: string, type: string): Promise<Blob> {
    try {
      // Gérer les données base64 avec ou sans en-tête
      const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      
      // Convertir base64 en tableau binaire
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: type || 'video/mp4' });
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      throw new Error('Failed to convert video data');
    }
  }

  private extractFilename(url: string): string {
    try {
      // Essayer d'extraire le nom du fichier de l'URL
      const urlParts = url.split('/');
      let filename = urlParts[urlParts.length - 1];
      
      // Nettoyer les paramètres d'URL si présents
      if (filename.includes('?')) {
        filename = filename.split('?')[0];
      }
      
      // Si c'est une URL blob ou data, générer un nom
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        filename = 'video-' + new Date().getTime() + '.mp4';
      }
      
      return filename || 'unknown.mp4';
    } catch {
      return 'unknown.mp4';
    }
  }
}
