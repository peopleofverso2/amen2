import { Node, Edge } from 'reactflow';
import { CustomNode, CustomEdge } from './nodes';

export interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  title?: string;
  description?: string;
}

export interface Choice {
  id: string;
  text: string;
  nextStepId: string;
}

export interface Step {
  id: string;
  title: string;
  description?: string;
  media?: Media[];
  choices: Choice[];
}

export interface Scenario {
  scenarioTitle: string;
  description: string;
  steps: Step[];
}

export interface NodeData {
  stepId: string;
  content: {
    title: string;
    text: string;
    media: Media[];
  };
  choices: Choice[];
  onDataChange?: (nodeId: string, data: any) => void;
  onVideoEnd?: (nodeId: string) => void;
  onChoiceSelect?: (nodeId: string, choice: Choice) => void;
  isPlaybackMode?: boolean;
  isCurrentNode?: boolean;
  isPlaying?: boolean;
}

export interface Project {
  projectId: string;
  scenario: Scenario;
  nodes: Node<NodeData>[];
  edges: Edge<CustomEdge>[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetadata {
  projectId: string;
  scenarioTitle: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLibraryState {
  projects: ProjectMetadata[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectActions {
  createProject: (scenarioTitle: string, description?: string) => Promise<string>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<Project>;
  saveProject: (project: Project) => Promise<void>;
  updateProjectName: (projectId: string, scenarioTitle: string) => Promise<void>;
}
