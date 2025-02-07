import { Project, ProjectMetadata } from '../types/project';

const DB_NAME = 'amen_db';
const STORE_NAME = 'projects';
const DB_VERSION = 3;

export class ProjectService {
  private db: IDBDatabase | null = null;
  private static instance: ProjectService | null = null;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.resetDatabase();
      await this.getDB();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProjectService:', error);
      throw error;
    }
  }

  private async resetDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };
      req.onerror = () => {
        console.error('Could not delete database');
        reject(req.error);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      console.log('Opening database...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('Database opened successfully');
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('Database upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('Creating object store:', STORE_NAME);
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('Object store created');
        }
      };
    });
  }

  async createProject(title: string, description: string = ''): Promise<string> {
    await this.initialize();
    
    console.log('Creating project with title:', title);
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newProject: Project = {
      projectId,
      scenario: {
        scenarioTitle: title,
        description,
        steps: []
      },
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now
    };

    console.log('New project object:', newProject);
    await this.saveProject(newProject);
    console.log('Project saved successfully');
    return projectId;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    await this.initialize();
    
    console.log('Updating project:', projectId);
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveProject(updatedProject);
    console.log('Project updated successfully');
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.initialize();
    
    try {
      console.log('Deleting project:', projectId);
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(projectId);

        request.onsuccess = () => {
          console.log('Project deleted successfully');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  async loadProject(projectId: string): Promise<Project | null> {
    await this.initialize();
    
    try {
      console.log('Loading project:', projectId);
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(projectId);

        request.onsuccess = () => {
          const project = request.result;
          console.log('Project loaded:', project);
          resolve(project || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error loading project:', error);
      throw error;
    }
  }

  async saveProject(project: Project): Promise<void> {
    await this.initialize();
    
    if (!project.projectId) {
      throw new Error('Project must have a projectId');
    }

    try {
      console.log('Saving project:', project);
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(project);

        request.onsuccess = () => {
          console.log('Project saved successfully');
          resolve();
        };
        request.onerror = () => {
          console.error('Error in request:', request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          console.log('Transaction completed');
        };

        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error);
        };
      });
    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }

  async getProjectList(): Promise<ProjectMetadata[]> {
    await this.initialize();
    
    try {
      console.log('Getting project list');
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const projects = request.result || [];
          console.log('Raw projects:', projects);
          const metadata = projects.map(project => ({
            projectId: project.projectId,
            scenarioTitle: project.scenario.scenarioTitle,
            description: project.scenario.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          }));
          console.log('Project metadata:', metadata);
          resolve(metadata);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }
}
