import { Node, Edge } from 'reactflow';
import { ButtonAssetPlacement, ButtonAssetStyle } from './buttonAsset';

export type NodeType = 'text' | 'video' | 'interaction' | 'voucher' | 'reward';

export interface InteractionButton {
  id: string;
  label: string;
  style?: ButtonAssetStyle;
  placement?: ButtonAssetPlacement;
  position?: {
    x: number;  // pourcentage de la largeur (0-100)
    y: number;  // pourcentage de la hauteur (0-100)
  };
  alignment?: {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'center' | 'bottom';
  };
}

export interface BaseNodeData<TUpdate = unknown> {
  label: string;
  onDataChange?: (data: TUpdate) => void;
}

export interface TextNodeData extends BaseNodeData {
  content: string;
  interactionButtons: InteractionButton[];
}

export interface VideoNodeData extends BaseNodeData {
  mediaId?: string;
  videoUrl?: string | null; // Pour la rétrocompatibilité
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

export interface ButtonNodeData extends BaseNodeData<Partial<ButtonNodeData>> {
  text?: string;
  style?: ButtonAssetStyle & {
    padding?: string;
    textAlign?: 'left' | 'center' | 'right';
    transition?: string;
  };
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: {
    name: string;
    position: 'start' | 'end';
  };
  targetNodeId?: string;
  onButtonClick?: () => void;
  onDataChange?: (data: Partial<ButtonNodeData>) => void;
  onNavigate?: (targetNodeId: string) => void;
  isPlaybackMode?: boolean;
}

export type CustomNode = Node<
  TextNodeData | VideoNodeData | InteractionNodeData | VoucherNodeData | RewardNodeData | ButtonNodeData
>;

export type CustomEdge = Edge;
