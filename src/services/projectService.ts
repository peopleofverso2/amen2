import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectMetadata } from '../types/project';
import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from '../types/nodes';

const DB_NAME = 'amen_db';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  public async listProjects(): Promise<Project[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const projects = request.result || [];
          // Trier par date de mise à jour décroissante
          projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          resolve(projects);
        };

        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }

  public async createProject(name: string, description?: string): Promise<string> {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.saveProject(newProject);
    return newProject.id;
  }

  public async loadProject(projectId: string): Promise<Project | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(projectId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      console.error('Error loading project:', error);
      return null;
    }
  }

  public async saveProject(project: Project): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Mettre à jour la date
        project.updatedAt = new Date().toISOString();
        
        const request = store.put(project);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }

  public async deleteProject(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  public async updateProjectName(id: string, name: string): Promise<void> {
    try {
      const project = await this.loadProject(id);
      project.name = name;
      await this.saveProject(project);
    } catch (error) {
      console.error('Error updating project name:', error);
      throw error;
    }
  }
}
