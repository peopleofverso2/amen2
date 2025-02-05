import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectMetadata } from '../types/project';
import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from '../types/nodes';

const PROJECTS_KEY = 'amen_projects';
const PROJECT_DATA_PREFIX = 'amen_project_';

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  private getProjectKey(id: string): string {
    return `${PROJECT_DATA_PREFIX}${id}`;
  }

  public async listProjects(): Promise<Project[]> {
    try {
      const projectsJson = localStorage.getItem(PROJECTS_KEY);
      console.log('Projects JSON:', projectsJson);
      
      if (!projectsJson) {
        console.log('No projects found, returning empty array');
        return [];
      }
      
      const projects = JSON.parse(projectsJson);
      console.log('Parsed projects:', projects);
      
      // Charger les détails complets de chaque projet
      const fullProjects = await Promise.all(
        projects.map(async (metadata: any) => {
          try {
            return await this.loadProject(metadata.id);
          } catch (error) {
            console.error(`Error loading project ${metadata.id}:`, error);
            return null;
          }
        })
      );
      
      // Filtrer les projets qui n'ont pas pu être chargés
      const validProjects = fullProjects.filter((p): p is Project => p !== null);
      console.log('Valid projects:', validProjects);
      
      return validProjects;
    } catch (error) {
      console.error('Error loading projects:', error);
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

    // Save project data
    localStorage.setItem(
      this.getProjectKey(newProject.id),
      JSON.stringify(newProject)
    );

    // Save project metadata
    const projects = await this.listProjects();
    projects.push({
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      createdAt: newProject.createdAt,
      updatedAt: newProject.updatedAt,
    });
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    return newProject.id;
  }

  public async loadProject(id: string): Promise<Project> {
    try {
      const projectJson = localStorage.getItem(this.getProjectKey(id));
      if (!projectJson) {
        console.error('Project not found:', id);
        throw new Error('Project not found');
      }
      const project = JSON.parse(projectJson);
      console.log('Project loaded:', project);
      return project;
    } catch (error) {
      console.error('Error loading project:', error);
      throw error;
    }
  }

  public async saveProject(project: Project): Promise<void> {
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
        // Update existing project
        projects[index] = {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      } else {
        // Add new project
        projects.push({
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        });
      }
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }

  public async deleteProject(id: string): Promise<void> {
    try {
      // Remove project data
      localStorage.removeItem(this.getProjectKey(id));

      // Remove project metadata
      const projects = await this.listProjects();
      const filteredProjects = projects.filter((p) => p.id !== id);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(filteredProjects));
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
