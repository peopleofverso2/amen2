import { Node, Edge } from 'reactflow';

export type NodeType = 'text' | 'video' | 'interaction' | 'voucher' | 'reward';

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
  onDataChange?: (data: any) => void;
}

export interface TextNodeData extends BaseNodeData {
  content: string;
  interactionButtons: InteractionButton[];
}

export interface VideoNodeData extends BaseNodeData {
  id: string;
  videoUrl: string;
  buttons?: Array<{
    id: string;
    label: string;
    buttonText: string;
    targetNodeId?: string;
  }>;
  isPlaybackMode?: boolean;
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

export type CustomNode = Node<
  TextNodeData | VideoNodeData | InteractionNodeData | VoucherNodeData | RewardNodeData | ButtonNodeData
>;

export type CustomEdge = Edge;
