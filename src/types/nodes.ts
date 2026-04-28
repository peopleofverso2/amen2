import { Node, Edge } from 'reactflow';
import type { MediaFile } from './media';

export type NodeType =
  | 'text'
  | 'base'
  | 'video'
  | 'interaction'
  | 'voucher'
  | 'reward'
  | 'button'
  | 'group'
  | 'workflow';

export interface InteractionButton {
  id: string;
  label: string;
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    fontSize?: string;
  };
  position?: {
    x: number;  // pourcentage de la largeur (0-100)
    y: number;  // pourcentage de la hauteur (0-100)
  };
  alignment?: {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'center' | 'bottom';
  };
}

export interface BaseNodeData {
  label: string;
  choices?: Array<{
    text: string;
  }>;
  onDataChange?: (data: Record<string, unknown>) => void;
}

export interface TextNodeData extends BaseNodeData {
  content: string;
  interactionButtons: InteractionButton[];
}

export interface VideoNodeData extends BaseNodeData {
  id: string;
  videoUrl: string;
  mediaIn?: number;
  mediaOut?: number;
  onNavigate?: (targetNodeId: string) => void;
  buttons?: Array<{
    id: string;
    label: string;
    buttonText: string;
    targetNodeId?: string;
  }>;
  isPlaybackMode?: boolean;
}

export interface ScenarioGroupNodeData extends BaseNodeData {
  id: string;
  description?: string;
  isExpanded?: boolean;
  childCount?: number;
  onDataChange?: (data: Partial<ScenarioGroupNodeData>) => void;
  onToggleExpanded?: () => void;
  onAssignSelectedNodes?: () => void;
  onDetachChildren?: () => void;
}

export interface InteractionNodeData extends BaseNodeData {
  parentNodeId: string;  // ID du nœud vidéo parent
  buttons: InteractionButton[];
  timing: {
    showAtEnd: boolean;  // Si true, affiche à la fin de la vidéo
    showAtTime?: number; // Sinon, affiche à ce timestamp spécifique
    duration?: number;   // Durée d'affichage en secondes (optionnel)
  };
}

export interface VoucherNodeData extends BaseNodeData {
  qrCodeData: string;
  expirationDate?: Date;
}

export interface RewardNodeData extends BaseNodeData {
  rewardType: string;
  value: number;
}

export interface ButtonNodeData extends BaseNodeData {
  text?: string;
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    fontSize?: string;
    borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
    borderColor?: string;
    borderWidth?: string;
    boxShadow?: string;
    padding?: string;
    textAlign?: 'left' | 'center' | 'right';
    transition?: string;
    hoverBackgroundColor?: string;
    hoverTextColor?: string;
    hoverScale?: string;
    positionMode?: 'flow' | 'absolute';
    positionX?: number;
    positionY?: number;
    horizontalAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'center' | 'bottom';
    mobilePositionMode?: 'flow' | 'absolute';
    mobilePositionX?: number;
    mobilePositionY?: number;
    mobileHorizontalAlign?: 'left' | 'center' | 'right';
    mobileVerticalAlign?: 'top' | 'center' | 'bottom';
  };
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: {
    name: string;
    position: 'start' | 'end';
  };
  targetNodeId?: string;
  onDataChange?: (data: Partial<ButtonNodeData>) => void;
  onNavigate?: (targetNodeId: string) => void;
  isPlaybackMode?: boolean;
}

export interface WorkflowNodeData extends BaseNodeData {
  id: string;
  provider?: 'workflow' | 'comfyui';
  workflowPreset?:
    | 'thumbnail_pack'
    | 'style_transfer'
    | 'inpaint'
    | 'image_to_video'
    | 'video_upscale'
    | 'batch_variations';
  executionMode?: 'auto' | 'local' | 'comfyui';
  inputMode?: 'manual_upload' | 'media_library' | 'previous_node';
  outputType?: 'image' | 'video' | 'image_batch' | 'video_batch';
  prompt?: string;
  negativePrompt?: string;
  notes?: string;
  status?: 'draft' | 'ready' | 'queued' | 'running' | 'done';
  expectedOutputs?: number;
  sourceMediaId?: string;
  sourceMediaName?: string;
  sourceThumbnailUrl?: string;
  outputs?: MediaFile[];
  lastRunAt?: string;
  lastError?: string;
  lastExecutionProvider?: string;
  lastExecutionEngine?: string;
  onDataChange?: (data: Partial<WorkflowNodeData>) => void;
}

export type CustomNode = Node<
  | TextNodeData
  | VideoNodeData
  | ScenarioGroupNodeData
  | InteractionNodeData
  | VoucherNodeData
  | RewardNodeData
  | ButtonNodeData
  | WorkflowNodeData
>;

export type CustomEdge = Edge;
