import { Node } from 'reactflow';
import { Project } from '../types/project';
import { VideoNodeData } from '../types/nodes';
import { DatabaseService } from './databaseService';

interface ExportData {
  project: Project;
  resources: Resource[];
  version: string;
  includesVideos: boolean;
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

  async exportProject(project: Project, includeVideos: boolean = false): Promise<Blob> {
    try {
      console.log('Starting project export:', project.name, includeVideos ? '(with videos)' : '(without videos)');

      // Vérifier que le projet a des nœuds
      if (!project.nodes) {
        project.nodes = [];
      }

      // Collecter et intégrer toutes les ressources
      const resources = includeVideos ? 
        await this.collectResources(project.nodes) : 
        await this.collectResourcesMetadata(project.nodes);
      
      console.log('Resources collected:', resources.length);

      // Créer les données d'export dans l'ancien format qui fonctionne
      const exportData = {
        version: this.VERSION,
        name: project.name || 'Projet sans nom',
        description: project.description || '',
        includesVideos: includeVideos,
        scenario: {
          nodes: project.nodes.map(node => {
            if (node.type === 'video' && node.data?.videoUrl) {
              const videoUrl = node.data.videoUrl;
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
          }),
          edges: project.edges
        },
        resources
      };

      // Créer le blob final
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      console.log('Export complete. Size:', blob.size, 'bytes');
      return blob;
    } catch (error) {
      console.error('Error during export:', error);
      throw error;
    }
  }

  async importProject(file: File): Promise<Project> {
    try {
      console.log('Starting project import');
      console.log('File name:', file.name);
      console.log('File size:', file.size, 'bytes');
      
      // Vérifier le type de fichier
      if (!file.name.endsWith('.pov') && !file.name.endsWith('.json')) {
        throw new Error('Invalid file type. Only .pov and .json files are supported');
      }

      // Lire et parser le fichier
      const text = await file.text();
      console.log('File content:', text.substring(0, 200) + '...');
      
      let importData: any;
      
      try {
        importData = JSON.parse(text);
        console.log('Parsed data:', importData);
      } catch (error) {
        console.error('JSON parse error:', error);
        throw new Error('Invalid JSON format');
      }

      // Valider la structure du fichier
      if (!importData || typeof importData !== 'object') {
        console.error('Invalid importData:', importData);
        throw new Error('Invalid project file format');
      }

      // Convertir l'ancien format vers le nouveau si nécessaire
      let project: Project;
      let resources: Resource[] = [];

      if (importData.project) {
        // Nouveau format
        project = importData.project;
        resources = importData.resources || [];
      } else if (importData.scenario && importData.scenario.nodes) {
        // Ancien format
        console.log('Converting from old format to new format');
        project = {
          id: crypto.randomUUID(),
          name: importData.name || 'Projet importé',
          description: importData.description || '',
          nodes: importData.scenario.nodes || [],
          edges: importData.scenario.edges || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        resources = importData.resources || [];
        console.log('Converted project:', project);
      } else {
        console.error('Invalid project data:', importData);
        throw new Error('Invalid project file: missing or invalid project data');
      }

      // S'assurer que le projet a les propriétés requises
      if (!project.id) project.id = crypto.randomUUID();
      if (!project.name) project.name = importData.name || 'Projet importé';
      if (!project.description) project.description = importData.description || '';
      if (!project.createdAt) project.createdAt = new Date().toISOString();
      if (!project.updatedAt) project.updatedAt = new Date().toISOString();
      project.nodes = Array.isArray(project.nodes) ? project.nodes : [];
      project.edges = Array.isArray(project.edges) ? project.edges : [];

      // Restaurer les ressources
      if (resources && Array.isArray(resources) && resources.length > 0) {
        console.log('Restoring', resources.length, 'resources');
        
        // Créer une map des ressources pour un accès plus rapide
        const resourceMap = new Map(resources.map(r => [r.id, r]));
        
        // Générer de nouveaux IDs pour les ressources
        const resourceIdMap = new Map<string, string>();
        
        for (const resource of resources) {
          const newId = `resource-${crypto.randomUUID().split('-')[0]}`;
          resourceIdMap.set(resource.id, newId);
        }
        
        // Mettre à jour les nœuds avec les nouveaux IDs de ressources
        for (const node of project.nodes) {
          if (node.type === 'video') {
            const videoUrl = node.data?.videoUrl;
            if (videoUrl?.startsWith('resource://')) {
              const oldResourceId = videoUrl.replace('resource://', '');
              const newResourceId = resourceIdMap.get(oldResourceId);
              const resource = resourceMap.get(oldResourceId);
              
              if (resource && resource.data && newResourceId) {
                try {
                  // Stocker la vidéo dans IndexedDB avec le nouvel ID
                  await this.storeVideoInDB(newResourceId, resource.data, resource.mimeType);
                  
                  // Mettre à jour l'URL dans le nœud avec le nouvel ID
                  node.data = {
                    ...node.data,
                    videoUrl: `resource://${newResourceId}`,
                    originalFilename: resource.filename
                  };
                  
                  console.log('Resource restored:', resource.filename, 'with new ID:', newResourceId);
                } catch (error) {
                  console.error('Failed to restore resource:', oldResourceId, error);
                }
              } else {
                console.warn('Resource not found:', oldResourceId);
              }
            }
          }
        }
      }

      console.log('Import complete');
      return project;
    } catch (error) {
      console.error('Error during import:', error);
      throw error instanceof Error ? error : new Error('Unknown error during import');
    }
  }

  private async collectResources(nodes: Node[]): Promise<Resource[]> {
    const resources: Resource[] = [];
    const db = await DatabaseService.getInstance().getDB();

    for (const node of nodes) {
      if (node.type === 'video' && node.data?.videoUrl) {
        const videoUrl = node.data.videoUrl;
        if (videoUrl.startsWith('resource://')) {
          const resourceId = videoUrl.replace('resource://', '');
          try {
            console.log('Collecting video:', resourceId);
            const video = await this.getVideoFromDB(db, resourceId);
            if (video && video.data) {
              console.log('Video found:', {
                id: resourceId,
                type: video.type,
                dataSize: video.data.length
              });

              // Convertir ArrayBuffer en base64
              const base64 = await this.arrayBufferToBase64(video.data);
              console.log('Video converted to base64, length:', base64?.length || 0);
              
              if (!base64) {
                console.error('Failed to convert video to base64');
                continue;
              }

              resources.push({
                id: resourceId,
                data: base64,
                type: 'video',
                nodeId: node.id,
                mimeType: video.type,
                filename: node.data.originalFilename || 'video.mp4'
              });
              console.log('Video collected successfully:', {
                id: resourceId,
                filename: node.data.originalFilename,
                dataLength: base64.length
              });
            } else {
              console.warn('Video not found or data missing in DB:', resourceId);
            }
          } catch (error) {
            console.error('Error collecting video:', error);
          }
        }
      }
    }

    console.log('Total resources collected:', resources.length);
    return resources;
  }

  private async collectResourcesMetadata(nodes: Node[]): Promise<Resource[]> {
    const resources: Resource[] = [];
    const db = await DatabaseService.getInstance().getDB();

    for (const node of nodes) {
      if (node.type === 'video' && node.data?.videoUrl) {
        const videoUrl = node.data.videoUrl;
        if (videoUrl.startsWith('resource://')) {
          const resourceId = videoUrl.replace('resource://', '');
          try {
            const video = await this.getVideoFromDB(db, resourceId);
            if (video) {
              resources.push({
                id: resourceId,
                data: '', // Pas de données vidéo
                type: 'video',
                nodeId: node.id,
                mimeType: video.type,
                filename: node.data.originalFilename || 'video.mp4'
              });
              console.log('Video metadata collected:', node.data.originalFilename);
            }
          } catch (error) {
            console.error('Error collecting video metadata:', error);
          }
        }
      }
    }

    return resources;
  }

  private async storeVideoInDB(id: string, base64Data: string, mimeType: string): Promise<void> {
    try {
      console.log('Storing video in DB:', {
        id,
        mimeType,
        dataLength: base64Data.length
      });

      // Convertir base64 en ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const db = await DatabaseService.getInstance().getDB();
      const transaction = db.transaction([DatabaseService.STORES.VIDEOS], 'readwrite');
      const store = transaction.objectStore(DatabaseService.STORES.VIDEOS);

      return new Promise((resolve, reject) => {
        const request = store.put({
          id,
          data: bytes,
          type: mimeType
        });

        request.onerror = () => {
          console.error('Error storing video:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('Video stored successfully:', id);
          resolve();
        };

        transaction.oncomplete = () => {
          console.log('Transaction completed for video:', id);
        };

        transaction.onerror = () => {
          console.error('Transaction error for video:', id, transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('Error in storeVideoInDB:', error);
      throw error;
    }
  }

  private async getVideoFromDB(db: IDBDatabase, id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log('Getting video from DB:', id);
      
      try {
        const transaction = db.transaction([DatabaseService.STORES.VIDEOS], 'readonly');
        const store = transaction.objectStore(DatabaseService.STORES.VIDEOS);
        const request = store.get(id);

        request.onerror = () => {
          console.error('Error getting video:', id, request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const video = request.result;
          console.log('Video retrieved:', {
            id,
            found: !!video,
            type: video?.type,
            dataLength: video?.data?.length,
            data: video?.data ? 'present' : 'missing'
          });

          if (!video) {
            console.warn('Video not found in DB:', id);
            resolve(null);
            return;
          }

          if (!video.data) {
            console.error('Video data is missing:', id);
            resolve(null);
            return;
          }

          resolve(video);
        };

        transaction.oncomplete = () => {
          console.log('Get video transaction completed:', id);
        };

        transaction.onerror = () => {
          console.error('Get video transaction error:', id, transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Error in getVideoFromDB:', error);
        reject(error);
      }
    });
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

  private arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!buffer) {
          console.error('No buffer provided to arrayBufferToBase64');
          resolve('');
          return;
        }

        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const reader = new FileReader();
        
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            console.log('Successfully converted ArrayBuffer to base64');
            resolve(base64);
          } catch (error) {
            console.error('Error processing FileReader result:', error);
            reject(error);
          }
        };
        
        reader.onerror = () => {
          console.error('FileReader error:', reader.error);
          reject(reader.error);
        };
        
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error in arrayBufferToBase64:', error);
        reject(error);
      }
    });
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

  private generateResourceId(): string {
    return 'resource-' + Math.random().toString(36).substr(2, 9);
  }
}
