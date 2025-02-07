import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectMetadata } from '../types/project';
import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from '../types/nodes';

const DB_NAME = 'amen_db';
const STORE_NAME = 'projects';
const DB_VERSION = 3;

export class ProjectService {
  private static instance: ProjectService;
  private projects: Map<string, Project>;

  private constructor() {
    this.projects = new Map();
  }

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening database:', request.error);
        // Si l'erreur est due à une version incorrecte, on supprime la base et on réessaie
        if (request.error?.name === 'VersionError') {
          console.log('Version error detected, deleting database and retrying...');
          const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
          deleteRequest.onsuccess = () => {
            console.log('Database deleted successfully');
            // Réessayer d'ouvrir la base de données
            const newRequest = indexedDB.open(DB_NAME, DB_VERSION);
            newRequest.onerror = () => reject(newRequest.error);
            newRequest.onsuccess = () => resolve(newRequest.result);
            newRequest.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
              }
            };
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
          return;
        }
        reject(request.error);
      };
      
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  public async loadProject(id: string): Promise<Project | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const project = request.result || null;
          this.projects.set(id, project);
          resolve(project);
        };

        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
      });
    } catch (error) {
      console.error('Error loading project:', error);
      return null;
    }
  }

  public async getProject(id: string): Promise<Project | null> {
    let project = this.projects.get(id);
    if (!project) {
      project = await this.loadProject(id);
    }
    return project;
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

  public async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const updatedProject = { ...project, ...updates };
    await this.saveProject(updatedProject);
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

  public async updateProjectName(id: string, name: string): Promise<void> {
    try {
      const project = await this.getProject(id);
      project.name = name;
      await this.saveProject(project);
    } catch (error) {
      console.error('Error updating project name:', error);
      throw error;
    }
  }
}
