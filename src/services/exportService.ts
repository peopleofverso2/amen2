import { Node } from 'reactflow';
import { Project } from '../types/project';
import { VideoNodeData } from '../types/nodes';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter';

interface ExportData {
  project: Project;
  resources: Resource[];
  version: string;
  includesVideos: boolean;
}

interface Resource {
  id: string;
  data: string;
  type: string;
  nodeId: string;
  mimeType: string;
  filename: string;
}

export class ExportService {
  private readonly VERSION = "2.0.0";
  private readonly storageAdapter = LocalStorageAdapter.getInstance();

  async exportProject(project: Project, includeVideos: boolean = false): Promise<Blob> {
    console.log('Starting project export:', project.name, '(with videos)');
    try {
      const resources = includeVideos ? await this.collectResources(project.nodes) : [];
      const exportData: ExportData = {
        project,
        resources,
        version: this.VERSION,
        includesVideos: includeVideos
      };
      console.log('Resources collected:', resources.length);
      const json = JSON.stringify(exportData);
      console.log('Export complete. Size:', json.length, 'bytes');
      return new Blob([json], { type: 'application/json' });
    } catch (error) {
      console.error('Error during export:', error);
      throw error instanceof Error ? error : new Error('Unknown error during export');
    }
  }

  private async collectResources(nodes: Node[]): Promise<Resource[]> {
    const resources: Resource[] = [];
    console.log('Starting resource collection for nodes:', nodes.length);

    try {
      // Log des nodes pour débogage
      console.log('Nodes to process:', nodes.map(node => ({
        id: node.id,
        type: node.type,
        hasVideoUrl: node.type === 'video' && !!node.data?.videoUrl,
        videoUrl: node.type === 'video' ? node.data?.videoUrl : undefined
      })));

      for (const node of nodes) {
        if (node.type === 'video' && node.data?.videoUrl) {
          const videoUrl = node.data.videoUrl;
          console.log('Processing video node:', {
            nodeId: node.id,
            videoUrl,
            data: node.data
          });

          if (videoUrl.startsWith('resource://')) {
            const resourceId = videoUrl.replace('resource://', '');
            try {
              console.log('Collecting video:', resourceId);
              const mediaFile = await this.storageAdapter.getMedia(resourceId);
              
              if (mediaFile.url) {
                // Convertir le blob URL en base64
                const response = await fetch(mediaFile.url);
                const blob = await response.blob();
                const base64 = await this.blobToBase64(blob);

                console.log('Video found:', {
                  id: resourceId,
                  type: mediaFile.metadata.mimeType,
                  dataSize: base64.length
                });

                resources.push({
                  id: resourceId,
                  data: base64,
                  type: 'video',
                  nodeId: node.id,
                  mimeType: mediaFile.metadata.mimeType,
                  filename: mediaFile.metadata.name || 'video.mp4'
                });

                console.log('Video collected successfully:', {
                  id: resourceId,
                  filename: mediaFile.metadata.name,
                  dataLength: base64.length
                });
              } else {
                console.warn('Video not found:', resourceId);
              }
            } catch (error) {
              console.error('Error collecting video:', resourceId, error);
            }
          } else {
            console.log('Video URL does not start with resource://', videoUrl);
          }
        } else {
          console.log('Skipping non-video node:', {
            id: node.id,
            type: node.type,
            hasData: !!node.data
          });
        }
      }
    } catch (error) {
      console.error('Error during resource collection:', error);
    }

    console.log('Total resources collected:', resources.length);
    return resources;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Enlever le préfixe "data:*/*;base64,"
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        resolve(new Blob(byteArrays, { type }));
      } catch (error) {
        reject(error);
      }
    });
  }

  async importProject(file: File): Promise<Project> {
    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);
      
      // Vérifier la version
      if (data.version !== this.VERSION) {
        throw new Error(`Version incompatible: ${data.version}`);
      }

      // Importer les ressources si présentes
      if (data.includesVideos && data.resources) {
        for (const resource of data.resources) {
          try {
            const blob = await this.base64ToBlob(resource.data, resource.mimeType);
            const file = new File([blob], resource.filename, { type: resource.mimeType });
            
            await this.storageAdapter.saveMedia(file, {
              id: resource.id,
              name: resource.filename,
              type: 'video',
              mimeType: resource.mimeType,
              tags: []
            });
            
            console.log('Resource imported:', resource.id);
          } catch (error) {
            console.error('Error importing resource:', resource.id, error);
          }
        }
      }

      return data.project;
    } catch (error) {
      console.error('Error during import:', error);
      throw error instanceof Error ? error : new Error('Unknown error during import');
    }
  }
}
