import { Node, Edge } from 'reactflow';
import { CustomEdge } from './nodes';
import { ButtonAssetPlacement, ButtonAssetStyle } from './buttonAsset';

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
  nextStepId?: string;
  style?: ButtonAssetStyle;
  placement?: ButtonAssetPlacement;
}

export type SceneContributionType = 'insert' | 'alternative' | 'continuation';

export type SceneContributionStatus = 'experimental' | 'popular' | 'canon' | 'archived';

export type SceneVoteValue = -1 | 1;

export interface SceneVote {
  id: string;
  voterName: string;
  value: SceneVoteValue;
  createdAt: string;
  updatedAt: string;
}

export interface SceneRating {
  id: string;
  voterName: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneContribution {
  id: string;
  targetNodeId: string;
  type: SceneContributionType;
  status: SceneContributionStatus;
  title: string;
  body: string;
  authorName: string;
  votes: SceneVote[];
  ratings: SceneRating[];
  comments: SceneComment[];
  createdAt: string;
  updatedAt: string;
  promotedAt?: string;
}

export interface ProjectSocial {
  version: 1;
  mode: 'author_decides';
  contributions: SceneContribution[];
}

export interface ContributionSummary {
  upvotes: number;
  downvotes: number;
  score: number;
  averageRating: number;
  ratingCount: number;
  commentCount: number;
}

export interface ProjectSocialSummary {
  contributionCount: number;
  canonCount: number;
  popularCount: number;
  averageRating: number;
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
  onDataChange?: (nodeId: string, data: Partial<NodeData>) => void;
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
  social?: ProjectSocial;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetadata {
  projectId: string;
  scenarioTitle: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  socialSummary?: ProjectSocialSummary;
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
