import { Project } from '../types/project';
import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge, VideoNodeData } from '../types/nodes';

interface ExportData {
  project: Project;
  resources: { [key: string]: string }; // Base64 encoded resources
}

export class ExportService {
  private static instance: ExportService;

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
  ): Promise<ExportData> {
    try {
      console.log('Exporting project:', project);
      console.log('Nodes:', nodes);
      
      // Collect all resources from nodes
      const resources = await this.collectResources(nodes);
      console.log('Collected resources:', Object.keys(resources));

      // Create export data
      const exportData: ExportData = {
        project: {
          ...project,
          nodes: nodes || [],
          edges: edges || [],
        },
        resources,
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting project:', error);
      throw error;
    }
  }

  public async importProject(data: ArrayBuffer): Promise<ExportData> {
    try {
      // Convert ArrayBuffer to string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(data);
      const importData: ExportData = JSON.parse(jsonString);

      // Validate imported data
      if (!importData.project || !importData.resources) {
        throw new Error('Invalid project file format');
      }

      // Restore media URLs from resources
      if (importData.project.nodes) {
        for (const node of importData.project.nodes) {
          if (node.type === 'video') {
            const videoData = node.data as VideoNodeData;
            if (videoData.videoUrl && importData.resources[videoData.videoUrl]) {
              // Create blob URL for the media
              const base64Data = importData.resources[videoData.videoUrl];
              const byteCharacters = atob(base64Data.split(',')[1]);
              const byteNumbers = new Array(byteCharacters.length);
              
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: this.getMimeType(base64Data) });
              const url = URL.createObjectURL(blob);
              
              // Update node with new URL
              videoData.videoUrl = url;
            }
          }
        }
      }

      return importData;
    } catch (error) {
      console.error('Error importing project:', error);
      throw error;
    }
  }

  private async collectResources(nodes: Node<CustomNode>[]): Promise<{ [key: string]: string }> {
    const resources: { [key: string]: string } = {};

    if (!nodes) return resources;

    console.log('Collecting resources for nodes:', nodes);

    for (const node of nodes) {
      if (node.type === 'video') {
        const videoData = node.data as VideoNodeData;
        if (videoData.videoUrl) {
          console.log('Processing video URL:', videoData.videoUrl);
          
          try {
            const response = await fetch(videoData.videoUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);
            resources[videoData.videoUrl] = base64;
            
            console.log('Successfully collected video for:', videoData.videoUrl);
          } catch (error) {
            console.error(`Error collecting video for node ${node.id}:`, error);
          }
        }
      }
    }

    return resources;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getMimeType(base64Data: string): string {
    // Extract MIME type from base64 data URL
    const match = base64Data.match(/^data:([^;]+);/);
    return match ? match[1] : 'application/octet-stream';
  }
}
