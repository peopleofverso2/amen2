import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from './nodes';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nodes: CustomNode[];
  edges: CustomEdge[];
  thumbnail?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

export interface ProjectLibraryState {
  projects: ProjectMetadata[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectActions {
  createProject: (name: string, description?: string) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<Project>;
  saveProject: (project: Project) => Promise<void>;
  updateProjectName: (id: string, name: string) => Promise<void>;
}
