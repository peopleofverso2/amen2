import { Project, ProjectMetadata } from '../types/project';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export class ProjectService {
  private static instance: ProjectService | null = null;

  private constructor() {}

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async createProject(title: string, description: string = ''): Promise<string> {
    const project = await this.request<Project>('/api/projects', {
      method: 'POST',
      body: {
        scenarioTitle: title,
        description,
      },
    });

    return project.projectId;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    await this.request<Project>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request<{ message: string }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async loadProject(projectId: string): Promise<Project | null> {
    try {
      return await this.request<Project>(`/api/projects/${projectId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('non trouvé')) {
        return null;
      }
      throw error;
    }
  }

  async saveProject(project: Project): Promise<void> {
    if (!project.projectId) {
      throw new Error('Project must have a projectId');
    }

    await this.request<Project>(`/api/projects/${project.projectId}`, {
      method: 'PUT',
      body: project,
    });
  }

  async getProjectList(): Promise<ProjectMetadata[]> {
    return this.request<ProjectMetadata[]>('/api/projects');
  }

  async exportAllProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/projects/export');
  }

  async importProjects(projects: Project[]): Promise<void> {
    await this.request<{ imported: number; projects: Project[] }>('/api/projects/import', {
      method: 'POST',
      body: { projects },
    });
  }

  async getProject(projectId: string): Promise<Project> {
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  async updateProjectName(projectId: string, scenarioTitle: string): Promise<void> {
    const project = await this.getProject(projectId);
    await this.updateProject(projectId, {
      scenario: {
        ...project.scenario,
        scenarioTitle,
      },
    });
  }
}
