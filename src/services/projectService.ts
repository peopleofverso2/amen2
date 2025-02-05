import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectMetadata } from '../types/project';

const PROJECTS_KEY = 'amen_projects';
const PROJECT_DATA_PREFIX = 'amen_project_';

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private getProjectKey(id: string): string {
    return `${PROJECT_DATA_PREFIX}${id}`;
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    try {
      const projectsJson = localStorage.getItem(PROJECTS_KEY);
      if (!projectsJson) return [];
      return JSON.parse(projectsJson);
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  }

  async createProject(name: string, description?: string): Promise<string> {
    try {
      const projects = await this.listProjects();
      const newProject: Project = {
        id: uuidv4(),
        name,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
      };

      // Save project data
      localStorage.setItem(
        this.getProjectKey(newProject.id),
        JSON.stringify(newProject)
      );

      // Save project metadata
      const projectMetadata: ProjectMetadata = {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        createdAt: newProject.createdAt,
        updatedAt: newProject.updatedAt,
      };
      projects.push(projectMetadata);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

      return newProject.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create project');
    }
  }

  async loadProject(id: string): Promise<Project> {
    try {
      const projectJson = localStorage.getItem(this.getProjectKey(id));
      if (!projectJson) throw new Error('Project not found');
      return JSON.parse(projectJson);
    } catch (error) {
      console.error('Error loading project:', error);
      throw new Error('Failed to load project');
    }
  }

  async saveProject(project: Project): Promise<void> {
    try {
      project.updatedAt = new Date().toISOString();

      // Save project data
      localStorage.setItem(
        this.getProjectKey(project.id),
        JSON.stringify(project)
      );

      // Update project metadata
      const projects = await this.listProjects();
      const index = projects.findIndex((p) => p.id === project.id);
      if (index !== -1) {
        projects[index] = {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          thumbnail: project.thumbnail,
        };
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      }
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error('Failed to save project');
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      // Remove project data
      localStorage.removeItem(this.getProjectKey(id));

      // Remove project metadata
      const projects = await this.listProjects();
      const filteredProjects = projects.filter((p) => p.id !== id);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(filteredProjects));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error('Failed to delete project');
    }
  }

  async updateProjectName(id: string, name: string): Promise<void> {
    try {
      const project = await this.loadProject(id);
      project.name = name;
      await this.saveProject(project);
    } catch (error) {
      console.error('Error updating project name:', error);
      throw new Error('Failed to update project name');
    }
  }
}
