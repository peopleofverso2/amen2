import { useState, useCallback, DragEvent, useEffect, useRef, useMemo, SyntheticEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  ReactFlowProvider,
  ReactFlowInstance,
  NodeProps,
  XYPosition,
  SelectionMode,
} from 'reactflow';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Select,
  Switch,
  MenuItem,
  CircularProgress,
  Snackbar,
  Link,
  useMediaQuery,
  Alert as MuiAlert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  DeleteOutline as DeleteOutlineIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import ReactPlayer from 'react-player';
import 'reactflow/dist/style.css';

import {
  CustomNode,
  CustomEdge,
  VideoNodeData,
  ButtonNodeData,
  ScenarioGroupNodeData,
  WorkflowNodeData,
} from '../../types/nodes';
import { Project } from '../../types/project';
import { ProjectService } from '../../services/projectService';
import analyticsService from '../../services/analyticsService';
import publishService from '../../services/publishService';
import { getId } from '../../utils/id';
import Sidebar from './controls/Sidebar';
import BaseNode from './nodes/BaseNode';
import VideoNode from './nodes/VideoNode';
import ButtonNode from './nodes/button/ButtonNode';
import ScenarioGroupNode from './nodes/group/ScenarioGroupNode';
import WorkflowNode from './nodes/WorkflowNode';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

interface PlaybackMenuOption {
  id: string;
  label: string;
  targetVideoNodeId: string;
  style?: ButtonNodeData['style'];
  variant?: ButtonNodeData['variant'];
  size?: ButtonNodeData['size'];
}

interface YoutubeAuthStatusResponse {
  configured: boolean;
  connected: boolean;
  channelTitle?: string | null;
  error?: string;
}

interface YoutubeUploadedVideo {
  id?: string;
  title?: string;
  url?: string | null;
  studioUrl?: string | null;
  kind?: 'main' | 'companion_cta' | string;
  nodeId?: string | null;
}

interface YoutubeEndScreenTarget {
  targetNodeId: string;
  targetLabel?: string;
  targetVideoId?: string | null;
  targetUrl?: string | null;
  targetStudioUrl?: string | null;
}

interface YoutubeEndScreenPlanItem {
  sourceNodeId: string;
  sourceLabel?: string;
  sourceVideoId?: string | null;
  sourceUrl?: string | null;
  sourceStudioUrl?: string | null;
  recommendedStartFromEndSeconds?: number;
  totalTargets?: number;
  targets: YoutubeEndScreenTarget[];
}

interface YoutubeUploadResponse {
  id?: string;
  title?: string;
  url?: string | null;
  studioUrl?: string | null;
  privacyStatus?: 'private' | 'public' | 'unlisted' | string | null;
  channelTitle?: string | null;
  channelId?: string | null;
  companionUrl?: string | null;
  companionCtaText?: string | null;
  companionCtaApplied?: boolean;
  companionCtaMode?: 'full' | 'qr_only' | 'failed' | string | null;
  companionCtaError?: string | null;
  companionVideoUploadError?: string | null;
  companionVideo?: YoutubeUploadedVideo | null;
  videos?: YoutubeUploadedVideo[];
  endScreenPlan?: YoutubeEndScreenPlanItem[];
  partialUpload?: boolean;
  uploadLimitExceeded?: boolean;
  requestedUploads?: number;
  completedUploads?: number;
  uploadWarnings?: string[];
  segments?: number;
  mode?: 'media' | 'scenario';
  pathNodeIds?: string[];
}

interface LastYoutubeExportLink {
  url: string | null;
  studioUrl: string | null;
  title: string;
  channelTitle: string;
  visibilityLabel: string;
  uploadedAt: string;
  videos: YoutubeUploadedVideo[];
  endScreenPlan: YoutubeEndScreenPlanItem[];
}

interface YoutubeUploadJobResponse {
  jobId?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string | null;
  result?: YoutubeUploadResponse | null;
}

interface YoutubePlaywrightPlanTarget {
  targetNodeId: string;
  targetLabel: string;
  targetVideoId: string | null;
  targetThumbnailUrl: string | null;
  targetStudioUrl: string | null;
  targetUrl: string | null;
}

interface YoutubePlaywrightPlanStep {
  sourceNodeId: string;
  sourceLabel: string;
  sourceVideoId: string | null;
  sourceStudioUrl: string | null;
  sourceUrl: string | null;
  targets: YoutubePlaywrightPlanTarget[];
}

interface YoutubePlaywrightPlanDocument {
  version: number;
  generatedAt: string;
  scenarioTitle: string;
  channelTitle: string;
  steps: YoutubePlaywrightPlanStep[];
}

interface YoutubeEndScreenPreset {
  id: string;
  name: string;
  createdAt: string;
  plan: YoutubePlaywrightPlanDocument;
}

interface YoutubeExportCacheEntry {
  signature: string;
  lastExportLink: LastYoutubeExportLink;
  updatedAt: string;
}

type YoutubeExportCacheStore = Record<string, YoutubeExportCacheEntry>;

interface YoutubeConfigResponse {
  configured: boolean;
  source?: 'env' | 'file' | 'mixed' | 'none';
  clientId?: string;
  redirectUri?: string;
  clientSecretSet?: boolean;
  tokenReset?: boolean;
  error?: string;
}

type ToastState = {
  severity: 'success' | 'error' | 'info';
  message: string;
};

const staticNodeTypes = {
  base: BaseNode,
  text: BaseNode,
  button: ButtonNode,
  group: ScenarioGroupNode,
  workflow: WorkflowNode,
};

const defaultButtonStyle: NonNullable<ButtonNodeData['style']> = {
  backgroundColor: '#2196f3',
  textColor: '#ffffff',
  borderRadius: '4px',
  fontSize: '14px',
  borderStyle: 'none',
  borderColor: '#000000',
  borderWidth: '1px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  padding: '8px 16px',
  textAlign: 'center',
  transition: 'all 0.3s ease',
  hoverBackgroundColor: '#1976d2',
  hoverTextColor: '#ffffff',
  hoverScale: '1.05',
  positionMode: 'flow',
  positionX: 24,
  positionY: 24,
  horizontalAlign: 'center',
  verticalAlign: 'bottom',
  mobilePositionMode: 'flow',
  mobilePositionX: 16,
  mobilePositionY: 16,
  mobileHorizontalAlign: 'center',
  mobileVerticalAlign: 'bottom',
};

const buttonSizePresets: Record<NonNullable<ButtonNodeData['size']>, { fontSize: string; padding: string; minWidth: string }> = {
  small: {
    fontSize: '13px',
    padding: '4px 10px',
    minWidth: '96px',
  },
  medium: {
    fontSize: '14px',
    padding: '8px 16px',
    minWidth: '120px',
  },
  large: {
    fontSize: '16px',
    padding: '12px 24px',
    minWidth: '148px',
  },
};

const googleCloudCredentialsUrl = 'https://console.cloud.google.com/apis/credentials';
const googleCloudConsentScreenUrl = 'https://console.cloud.google.com/apis/credentials/consent';
const googleCloudYoutubeApiUrl = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com';
const AUTOSAVE_DEBOUNCE_MS = 1200;
const GROUP_COLLAPSED_WIDTH = 288;
const GROUP_COLLAPSED_HEIGHT = 120;
const GROUP_EXPANDED_WIDTH = 920;
const GROUP_EXPANDED_HEIGHT = 560;
const GROUP_CHILD_MIN_X = 20;
const GROUP_CHILD_MIN_Y = 90;
const GROUP_CHILD_MARGIN_RIGHT = 24;
const GROUP_CHILD_MARGIN_BOTTOM = 24;
const HISTORY_LIMIT = 80;
const PLAYBACK_SEEK_TOLERANCE_SECONDS = 0.4;
const PLAYBACK_SEEK_RETRY_DELAY_MS = 220;
const PLAYBACK_SEEK_STUCK_TIMEOUT_MS = 1800;
const PLAYBACK_MAX_SEEK_ATTEMPTS = 2;
const YOUTUBE_THUMBNAIL_PLACEHOLDER_MAX_WIDTH = 140;
const YOUTUBE_THUMBNAIL_PLACEHOLDER_MAX_HEIGHT = 120;
const YOUTUBE_ENDSCREEN_PRESETS_STORAGE_KEY = 'amen.youtube.endscreen.presets.v1';
const YOUTUBE_ENDSCREEN_PRESETS_LIMIT = 30;
const YOUTUBE_EXPORT_CACHE_STORAGE_KEY = 'amen.youtube.export.cache.v1';
const YOUTUBE_EXPORT_CACHE_DEFAULT_PROJECT_KEY = '__default__';
const YOUTUBE_EXPORT_SIGNATURE_MOD = 2147483647;
const YOUTUBE_PLAYWRIGHT_ASSISTANT_SCRIPT_FILE_NAME = 'youtube-endscreen-assistant.mjs';
const YOUTUBE_PLAYWRIGHT_ASSISTANT_SCRIPT_PATH = '/tools/youtube-endscreen-assistant.mjs';

const sanitizeYoutubeVideoId = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^[a-zA-Z0-9_-]{6,20}$/);
  return match ? match[0] : null;
};

const extractYoutubeVideoId = (value: string | null | undefined): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }

  const directVideoId = sanitizeYoutubeVideoId(raw);
  if (directVideoId) {
    return directVideoId;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const segment = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return sanitizeYoutubeVideoId(segment);
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const fromQuery = sanitizeYoutubeVideoId(parsed.searchParams.get('v') || '');
      if (fromQuery) {
        return fromQuery;
      }

      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(pathSegments[0])) {
        return sanitizeYoutubeVideoId(pathSegments[1]);
      }
    }
  } catch {
    // Ignore URL parse failures and fallback to regex extraction below.
  }

  const fallbackMatch = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/))([a-zA-Z0-9_-]{6,20})/
  );
  return fallbackMatch ? sanitizeYoutubeVideoId(fallbackMatch[1]) : null;
};

const buildYoutubeThumbnailUrl = (videoId: string | null | undefined): string | null => {
  const sanitizedVideoId = sanitizeYoutubeVideoId(videoId || '');
  if (!sanitizedVideoId) {
    return null;
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(sanitizedVideoId)}/hqdefault.jpg`;
};

const hashStringForSignature = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % YOUTUBE_EXPORT_SIGNATURE_MOD;
  }
  return hash.toString(16).padStart(8, '0');
};

const createYoutubeExportSignature = (input: unknown): string => {
  try {
    return hashStringForSignature(JSON.stringify(input));
  } catch {
    return hashStringForSignature(String(input));
  }
};

const getYoutubeExportCacheProjectKey = (projectId?: string): string => {
  const normalized = typeof projectId === 'string' ? projectId.trim() : '';
  return normalized || YOUTUBE_EXPORT_CACHE_DEFAULT_PROJECT_KEY;
};

const buildYoutubeThumbnailCandidates = (
  videoId: string | null | undefined,
  fallbackUrl: string | null | undefined
): string[] => {
  const candidates: string[] = [];
  const sanitizedVideoId = sanitizeYoutubeVideoId(videoId || '');
  if (sanitizedVideoId) {
    const encodedId = encodeURIComponent(sanitizedVideoId);
    candidates.push(`https://i.ytimg.com/vi/${encodedId}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodedId}/sddefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodedId}/hqdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodedId}/mqdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodedId}/default.jpg`);
  }
  if (fallbackUrl && fallbackUrl.trim()) {
    candidates.push(fallbackUrl.trim());
  }
  return candidates.filter((value, index) => value && candidates.indexOf(value) === index);
};

const YoutubeThumbnailCardImage: React.FC<{
  videoId: string | null;
  fallbackUrl: string | null;
  alt: string;
}> = ({ videoId, fallbackUrl, alt }) => {
  const candidates = useMemo(
    () => buildYoutubeThumbnailCandidates(videoId, fallbackUrl),
    [videoId, fallbackUrl]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(candidates.length === 0);

  useEffect(() => {
    setCandidateIndex(0);
    setFallbackMode(candidates.length === 0);
  }, [candidates]);

  if (fallbackMode || candidates.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.24) 0%, rgba(25,118,210,0.48) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Miniature indisponible
        </Typography>
      </Box>
    );
  }

  const activeCandidate = candidates[Math.min(candidateIndex, candidates.length - 1)];
  const canTryNextCandidate = candidateIndex < candidates.length - 1;

  return (
    <Box
      component="img"
      src={activeCandidate}
      alt={alt}
      onError={() => {
        if (canTryNextCandidate) {
          setCandidateIndex((value) => value + 1);
          return;
        }
        setFallbackMode(true);
      }}
      onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        const isLikelyPlaceholder =
          image.naturalWidth <= YOUTUBE_THUMBNAIL_PLACEHOLDER_MAX_WIDTH &&
          image.naturalHeight <= YOUTUBE_THUMBNAIL_PLACEHOLDER_MAX_HEIGHT;
        if (isLikelyPlaceholder) {
          if (canTryNextCandidate) {
            setCandidateIndex((value) => value + 1);
            return;
          }
          setFallbackMode(true);
        }
      }}
      sx={{
        display: 'block',
        width: '100%',
        aspectRatio: '16 / 9',
        objectFit: 'cover',
      }}
    />
  );
};

interface EditorSnapshot {
  nodes: CustomNode[];
  edges: CustomEdge[];
}

const getParentId = (node: CustomNode): string | undefined => node.parentId || node.parentNode;

const getAbsoluteNodePosition = (
  node: CustomNode,
  nodeById: Map<string, CustomNode>
): XYPosition => {
  let nextX = node.position.x;
  let nextY = node.position.y;
  let parentId = getParentId(node);
  let safety = 0;

  while (parentId && safety < 20) {
    const parent = nodeById.get(parentId);
    if (!parent) {
      break;
    }
    nextX += parent.position.x;
    nextY += parent.position.y;
    parentId = getParentId(parent);
    safety += 1;
  }

  return { x: nextX, y: nextY };
};

interface ScenarioEditorProps {
  projectId?: string;
  onBackToLibrary: () => void;
}

const Flow: React.FC<ScenarioEditorProps> = ({ projectId, onBackToLibrary }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode['data']>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [activeVideoNodeId, setActiveVideoNodeId] = useState<string | null>(null);
  const [playbackMenuOptions, setPlaybackMenuOptions] = useState<PlaybackMenuOption[]>([]);
  const [playbackPlayerKey, setPlaybackPlayerKey] = useState(0);
  const [playbackIsPlaying, setPlaybackIsPlaying] = useState(false);
  const [playbackSessionId, setPlaybackSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('Export interactif');
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const [youtubeAuthStatus, setYoutubeAuthStatus] = useState<YoutubeAuthStatusResponse | null>(null);
  const [isYoutubeStatusLoading, setIsYoutubeStatusLoading] = useState(false);
  const [isYoutubeExporting, setIsYoutubeExporting] = useState(false);
  const [isYoutubeScenarioSyncing, setIsYoutubeScenarioSyncing] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState('Export interactif');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubePrivacyStatus, setYoutubePrivacyStatus] = useState<'private' | 'public' | 'unlisted'>(
    'unlisted'
  );
  const [youtubeIncludeCompanionCta, setYoutubeIncludeCompanionCta] = useState(true);
  const [youtubeCompanionCtaText, setYoutubeCompanionCtaText] = useState('Version interactive');
  const [youtubeTagsInput, setYoutubeTagsInput] = useState('interactif,scenario');
  const [youtubeClientIdInput, setYoutubeClientIdInput] = useState('');
  const [youtubeClientSecretInput, setYoutubeClientSecretInput] = useState('');
  const [youtubeRedirectUriInput, setYoutubeRedirectUriInput] = useState(
    'http://localhost:3000/api/youtube/auth/callback'
  );
  const [youtubeConfigSource, setYoutubeConfigSource] = useState<'env' | 'file' | 'mixed' | 'none'>(
    'none'
  );
  const [youtubeClientSecretSet, setYoutubeClientSecretSet] = useState(false);
  const [isYoutubeConfigLoading, setIsYoutubeConfigLoading] = useState(false);
  const [isYoutubeConfigSaving, setIsYoutubeConfigSaving] = useState(false);
  const [isForceYoutubeReexport, setIsForceYoutubeReexport] = useState(false);
  const [lastYoutubeExportLink, setLastYoutubeExportLink] = useState<LastYoutubeExportLink | null>(
    null
  );
  const [lastYoutubeExportSignature, setLastYoutubeExportSignature] = useState<string | null>(null);
  const [youtubeEndScreenWizardIndex, setYoutubeEndScreenWizardIndex] = useState(0);
  const [youtubeEndScreenWizardCompletedSourceIds, setYoutubeEndScreenWizardCompletedSourceIds] =
    useState<string[]>([]);
  const [youtubeEndScreenPresets, setYoutubeEndScreenPresets] = useState<YoutubeEndScreenPreset[]>([]);
  const [selectedYoutubeEndScreenPresetId, setSelectedYoutubeEndScreenPresetId] = useState('');
  const [youtubeEndScreenPresetNameInput, setYoutubeEndScreenPresetNameInput] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const isMobileViewport = useMediaQuery('(max-width:768px)');
  const projectService = ProjectService.getInstance();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const playbackContainerRef = useRef<HTMLDivElement>(null);
  const playbackPlayerRef = useRef<ReactPlayer | null>(null);
  const playbackPendingSeekRef = useRef<number | null>(null);
  const playbackPendingSeekAppliedAtRef = useRef<number | null>(null);
  const playbackPendingSeekAttemptsRef = useRef(0);
  const playbackOutReachedRef = useRef(false);
  const playbackTransitionHandledRef = useRef(false);
  const playbackSessionStartedAtRef = useRef<number | null>(null);
  const playbackProgressMilestonesRef = useRef<Record<string, Set<number>>>({});
  const playbackSessionIdRef = useRef<string | null>(null);
  const activeVideoNodeIdRef = useRef<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingProjectRef = useRef(true);
  const hasAutosaveBaselineRef = useRef(false);
  const isPersistingRef = useRef(false);
  const queuedSaveRef = useRef<{ nodes: CustomNode[]; edges: CustomEdge[] } | null>(null);
  const latestNodesRef = useRef<CustomNode[]>([]);
  const latestEdgesRef = useRef<CustomEdge[]>([]);
  const historyPastRef = useRef<EditorSnapshot[]>([]);
  const historyFutureRef = useRef<EditorSnapshot[]>([]);
  const historyPresentRef = useRef<EditorSnapshot | null>(null);
  const historyPresentKeyRef = useRef<string>('');
  const isApplyingHistoryRef = useRef(false);
  const suggestedYoutubeJavascriptOrigin = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'https://votre-domaine.com';
    }
    return window.location.origin;
  }, []);
  const suggestedYoutubeRedirectUri = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'https://votre-domaine/api/youtube/auth/callback';
    }
    return `${window.location.origin}/api/youtube/auth/callback`;
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
  }, []);

  const refreshHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }, []);

  const sanitizeNodeForSnapshot = useCallback((node: CustomNode): CustomNode => {
    const nextData = { ...(node.data as unknown as Record<string, unknown>) };
    const nextNode: CustomNode = {
      ...node,
      data: nextData as unknown as CustomNode['data'],
      position: { ...node.position },
      style: node.style ? { ...node.style } : node.style,
      selected: false,
      dragging: false,
      resizing: false,
    };

    delete nextData.onDataChange;
    delete nextData.onToggleExpanded;
    delete nextData.onAssignSelectedNodes;
    delete nextData.onDetachChildren;
    delete nextData.onNavigate;
    delete nextData.isPlaybackMode;

    return nextNode;
  }, []);

  const makeSnapshotKey = useCallback((snapshot: EditorSnapshot): string => {
    return JSON.stringify({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    });
  }, []);

  const createSnapshot = useCallback(
    (nodesToStore: CustomNode[], edgesToStore: CustomEdge[]): EditorSnapshot => ({
      nodes: nodesToStore.map((node) => sanitizeNodeForSnapshot(node)),
      edges: edgesToStore.map((edge) => ({ ...edge, selected: false })),
    }),
    [sanitizeNodeForSnapshot]
  );

  const resetHistory = useCallback(() => {
    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyPresentRef.current = null;
    historyPresentKeyRef.current = '';
    refreshHistoryState();
  }, [refreshHistoryState]);

  const trackPlaybackEvent = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      if (!projectId || !playbackSessionId) {
        return;
      }

      void analyticsService.track({
        eventType,
        projectId,
        sessionId: playbackSessionId,
        source: 'editor_fullscreen',
        ...payload,
      });
    },
    [projectId, playbackSessionId]
  );

  const startPlaybackSession = useCallback(() => {
    if (!projectId) {
      return null;
    }

    const newSessionId = analyticsService.createSessionId('playback');
    setPlaybackSessionId(newSessionId);
    playbackSessionIdRef.current = newSessionId;
    playbackSessionStartedAtRef.current = Date.now();
    playbackProgressMilestonesRef.current = {};

    void analyticsService.track({
      eventType: 'session_start',
      projectId,
      sessionId: newSessionId,
      source: 'editor_fullscreen',
      meta: {
        mode: 'fullscreen_playback',
      },
    });

    return newSessionId;
  }, [projectId]);

  const endPlaybackSession = useCallback(
    (reason: string, clearState = true) => {
      if (!projectId || !playbackSessionIdRef.current) {
        return;
      }

      const startedAt = playbackSessionStartedAtRef.current;
      const durationMs = startedAt ? Math.max(0, Date.now() - startedAt) : undefined;
      const currentSessionId = playbackSessionIdRef.current;
      const finalNodeId = activeVideoNodeIdRef.current || undefined;

      void analyticsService.track({
        eventType: 'session_end',
        projectId,
        sessionId: currentSessionId,
        nodeId: finalNodeId,
        durationMs,
        source: 'editor_fullscreen',
        meta: {
          reason,
        },
      });

      playbackSessionStartedAtRef.current = null;
      playbackProgressMilestonesRef.current = {};
      playbackSessionIdRef.current = null;
      if (clearState) {
        setPlaybackSessionId(null);
      }
    },
    [projectId]
  );

  const graph = useMemo(() => {
    const nodeById = new Map<string, CustomNode>();
    const outgoing = new Map<string, CustomEdge[]>();
    const incoming = new Map<string, CustomEdge[]>();

    nodes.forEach((node) => {
      nodeById.set(node.id, node as CustomNode);
    });

    edges.forEach((edge) => {
      const out = outgoing.get(edge.source) ?? [];
      out.push(edge);
      outgoing.set(edge.source, out);

      const inc = incoming.get(edge.target) ?? [];
      inc.push(edge);
      incoming.set(edge.target, inc);
    });

    return { nodeById, outgoing, incoming };
  }, [nodes, edges]);

  const requestFullscreen = useCallback(async (element: FullscreenElement) => {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return;
    }
    if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
      return;
    }
    if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen();
      return;
    }
    if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return;
    }
    if (doc.msFullscreenElement && doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  }, []);

  const handleNodeDataChange = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const clampPositionInsideGroup = useCallback((position: XYPosition): XYPosition => {
    const clampedX = Math.max(
      GROUP_CHILD_MIN_X,
      Math.min(position.x, GROUP_EXPANDED_WIDTH - GROUP_CHILD_MARGIN_RIGHT)
    );
    const clampedY = Math.max(
      GROUP_CHILD_MIN_Y,
      Math.min(position.y, GROUP_EXPANDED_HEIGHT - GROUP_CHILD_MARGIN_BOTTOM)
    );
    return {
      x: Number(clampedX.toFixed(2)),
      y: Number(clampedY.toFixed(2)),
    };
  }, []);

  const updateGroupChildCounts = useCallback((currentNodes: CustomNode[]): CustomNode[] => {
    const counts = new Map<string, number>();
    currentNodes.forEach((node) => {
      const parentId = getParentId(node);
      if (parentId) {
        counts.set(parentId, (counts.get(parentId) || 0) + 1);
      }
    });

    let didChange = false;
    const nextNodes = currentNodes.map((node) => {
      if (node.type !== 'group') {
        return node;
      }

      const data = node.data as ScenarioGroupNodeData;
      const nextCount = counts.get(node.id) || 0;
      if ((data.childCount || 0) === nextCount) {
        return node;
      }

      didChange = true;
      return {
        ...node,
        data: {
          ...data,
          childCount: nextCount,
        },
      };
    });

    return didChange ? nextNodes : currentNodes;
  }, []);

  const toggleGroupExpanded = useCallback(
    (groupId: string, forceExpanded?: boolean) => {
      setNodes((currentNodes) => {
        const groupNode = currentNodes.find(
          (candidate) => candidate.id === groupId && candidate.type === 'group'
        ) as CustomNode | undefined;
        if (!groupNode) {
          return currentNodes;
        }

        const groupData = groupNode.data as ScenarioGroupNodeData;
        const nextExpanded =
          typeof forceExpanded === 'boolean' ? forceExpanded : !groupData.isExpanded;

        const nextNodes = currentNodes.map((node) => {
          if (node.id === groupId && node.type === 'group') {
            return {
              ...node,
              selectable: !nextExpanded,
              dragHandle: nextExpanded ? '.group-node__drag-handle' : undefined,
              selected: nextExpanded ? false : node.selected,
              style: {
                ...(node.style || {}),
                width: nextExpanded ? GROUP_EXPANDED_WIDTH : GROUP_COLLAPSED_WIDTH,
                height: nextExpanded ? GROUP_EXPANDED_HEIGHT : GROUP_COLLAPSED_HEIGHT,
              },
              data: {
                ...groupData,
                isExpanded: nextExpanded,
              },
            };
          }

          if (getParentId(node) === groupId) {
            return {
              ...node,
              parentId: groupId,
              parentNode: groupId,
              extent: 'parent' as const,
              hidden: !nextExpanded,
              selected: nextExpanded ? node.selected : false,
            };
          }

          return node;
        });

        return updateGroupChildCounts(nextNodes);
      });
    },
    [setNodes, updateGroupChildCounts]
  );

  const assignSelectedNodesToGroup = useCallback(
    (groupId: string) => {
      setNodes((currentNodes) => {
        const groupNode = currentNodes.find(
          (candidate) => candidate.id === groupId && candidate.type === 'group'
        ) as CustomNode | undefined;
        if (!groupNode) {
          return currentNodes;
        }

        const selectedNodes = currentNodes.filter(
          (candidate) =>
            candidate.selected &&
            candidate.id !== groupId &&
            candidate.type !== 'group'
        );

        if (selectedNodes.length === 0) {
          return currentNodes;
        }

        const nodeById = new Map(currentNodes.map((candidate) => [candidate.id, candidate]));
        const groupAbsolute = getAbsoluteNodePosition(groupNode, nodeById);

        const nextNodes = currentNodes.map((node) => {
          if (node.id === groupId && node.type === 'group') {
            const groupData = node.data as ScenarioGroupNodeData;
            return {
              ...node,
              selectable: false,
              dragHandle: '.group-node__drag-handle',
              selected: false,
              style: {
                ...(node.style || {}),
                width: GROUP_EXPANDED_WIDTH,
                height: GROUP_EXPANDED_HEIGHT,
              },
              data: {
                ...groupData,
                isExpanded: true,
              },
            };
          }

          const target = selectedNodes.find((candidate) => candidate.id === node.id);
          if (!target) {
            if (getParentId(node) === groupId) {
              return {
                ...node,
                hidden: false,
              };
            }
            return node;
          }

          const absolute = getAbsoluteNodePosition(node, nodeById);
          const relative = clampPositionInsideGroup({
            x: absolute.x - groupAbsolute.x,
            y: absolute.y - groupAbsolute.y,
          });

          return {
            ...node,
            position: relative,
            parentId: groupId,
            parentNode: groupId,
            extent: 'parent' as const,
            hidden: false,
            selected: false,
          };
        });

        return updateGroupChildCounts(nextNodes);
      });

      setToast({
        severity: 'info',
        message: 'Nodes sélectionnés ajoutés dans le groupe.',
      });
    },
    [clampPositionInsideGroup, setNodes, updateGroupChildCounts]
  );

  const detachGroupChildren = useCallback(
    (groupId: string) => {
      setNodes((currentNodes) => {
        const groupNode = currentNodes.find(
          (candidate) => candidate.id === groupId && candidate.type === 'group'
        ) as CustomNode | undefined;
        if (!groupNode) {
          return currentNodes;
        }

        const nodeById = new Map(currentNodes.map((candidate) => [candidate.id, candidate]));
        const groupAbsolute = getAbsoluteNodePosition(groupNode, nodeById);

        const nextNodes = currentNodes.map((node) => {
          if (getParentId(node) !== groupId) {
            return node;
          }

          return {
            ...node,
            position: {
              x: Number((groupAbsolute.x + node.position.x).toFixed(2)),
              y: Number((groupAbsolute.y + node.position.y).toFixed(2)),
            },
            parentId: undefined,
            parentNode: undefined,
            extent: undefined,
            hidden: false,
          };
        });

        return updateGroupChildCounts(nextNodes);
      });

      setToast({
        severity: 'info',
        message: 'Tous les nodes du groupe ont été détachés.',
      });
    },
    [setNodes, updateGroupChildCounts]
  );

  const hydrateNode = useCallback(
    (node: CustomNode): CustomNode => {
      if (node.type === 'video') {
        const data = node.data as VideoNodeData;
        return {
          ...node,
          data: {
            ...data,
            id: node.id,
            isPlaybackMode: false,
            onDataChange: (updatedData: Partial<VideoNodeData>) =>
              handleNodeDataChange(node.id, updatedData as Record<string, unknown>),
          },
        };
      }

      if (node.type === 'button') {
        const data = node.data as ButtonNodeData;
        return {
          ...node,
          data: {
            ...data,
            id: node.id,
            label: data.label || 'Nouveau bouton',
            text: data.text || 'Cliquez-moi',
            style: { ...defaultButtonStyle, ...(data.style || {}) },
            variant: data.variant || 'contained',
            size: data.size || 'medium',
            isPlaybackMode: false,
            onDataChange: (updatedData: Partial<ButtonNodeData>) =>
              handleNodeDataChange(node.id, updatedData as Record<string, unknown>),
          },
        };
      }

      if (node.type === 'workflow') {
        const data = node.data as WorkflowNodeData;
        return {
          ...node,
          data: {
            ...data,
            id: node.id,
            label: data.label || 'Workflow IA',
            provider: data.provider || 'workflow',
            workflowPreset: data.workflowPreset || 'thumbnail_pack',
            executionMode: data.executionMode || 'local',
            inputMode: data.inputMode || 'media_library',
            outputType: data.outputType || 'image_batch',
            prompt: data.prompt || '',
            negativePrompt: data.negativePrompt || '',
            notes: data.notes || '',
            status: data.status || 'draft',
            expectedOutputs: data.expectedOutputs || 4,
            sourceMediaId: data.sourceMediaId || '',
            sourceMediaName: data.sourceMediaName || '',
            sourceThumbnailUrl: data.sourceThumbnailUrl || '',
            outputs: Array.isArray(data.outputs) ? data.outputs : [],
            lastRunAt: data.lastRunAt || '',
            lastError: data.lastError || '',
            lastExecutionProvider: data.lastExecutionProvider || '',
            lastExecutionEngine: data.lastExecutionEngine || '',
            onDataChange: (updatedData: Partial<WorkflowNodeData>) =>
              handleNodeDataChange(node.id, updatedData as Record<string, unknown>),
          },
        };
      }

      if (node.type === 'group') {
        const data = node.data as ScenarioGroupNodeData;
        const isExpanded = Boolean(data.isExpanded);
        const childCount = latestNodesRef.current.filter(
          (candidate) => getParentId(candidate) === node.id
        ).length;
        return {
          ...node,
          selectable: !isExpanded,
          dragHandle: isExpanded ? '.group-node__drag-handle' : undefined,
          style: {
            ...(node.style || {}),
            width: isExpanded ? GROUP_EXPANDED_WIDTH : GROUP_COLLAPSED_WIDTH,
            height: isExpanded ? GROUP_EXPANDED_HEIGHT : GROUP_COLLAPSED_HEIGHT,
          },
          data: {
            ...data,
            id: node.id,
            label: data.label || 'Nouveau groupe',
            description: data.description || '',
            isExpanded,
            childCount,
            onDataChange: (updatedData: Partial<ScenarioGroupNodeData>) =>
              handleNodeDataChange(node.id, updatedData as Record<string, unknown>),
            onToggleExpanded: () => toggleGroupExpanded(node.id),
            onAssignSelectedNodes: () => assignSelectedNodesToGroup(node.id),
            onDetachChildren: () => detachGroupChildren(node.id),
          },
        };
      }

      return node;
    },
    [handleNodeDataChange, toggleGroupExpanded, assignSelectedNodesToGroup, detachGroupChildren]
  );

  const applyGroupContainerState = useCallback(
    (currentNodes: CustomNode[]): CustomNode[] => {
      const groupStateById = new Map<string, boolean>();
      currentNodes.forEach((node) => {
        if (node.type !== 'group') {
          return;
        }
        const data = node.data as ScenarioGroupNodeData;
        groupStateById.set(node.id, Boolean(data.isExpanded));
      });

      const nextNodes = currentNodes.map((node) => {
        const parentId = getParentId(node);
        if (!parentId || !groupStateById.has(parentId)) {
          return node;
        }

        const isParentExpanded = Boolean(groupStateById.get(parentId));
        return {
          ...node,
          parentId,
          parentNode: parentId,
          extent: 'parent' as const,
          hidden: !isParentExpanded,
        };
      });

      return updateGroupChildCounts(nextNodes);
    },
    [updateGroupChildCounts]
  );

  const applySnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      isApplyingHistoryRef.current = true;
      const hydratedNodes = applyGroupContainerState(snapshot.nodes.map((node) => hydrateNode(node)));
      const hydratedEdges = snapshot.edges.map((edge) => ({ ...edge, selected: false }));
      setNodes(hydratedNodes);
      setEdges(hydratedEdges);
      queueMicrotask(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [applyGroupContainerState, hydrateNode, setNodes, setEdges]
  );

  const handleUndo = useCallback(() => {
    if (historyPastRef.current.length === 0) {
      return;
    }

    const previousSnapshot = historyPastRef.current.pop() as EditorSnapshot;
    const currentSnapshot = historyPresentRef.current;
    if (currentSnapshot) {
      historyFutureRef.current.push(currentSnapshot);
    }

    historyPresentRef.current = previousSnapshot;
    historyPresentKeyRef.current = makeSnapshotKey(previousSnapshot);
    applySnapshot(previousSnapshot);
    refreshHistoryState();
  }, [applySnapshot, makeSnapshotKey, refreshHistoryState]);

  const handleRedo = useCallback(() => {
    if (historyFutureRef.current.length === 0) {
      return;
    }

    const nextSnapshot = historyFutureRef.current.pop() as EditorSnapshot;
    const currentSnapshot = historyPresentRef.current;
    if (currentSnapshot) {
      historyPastRef.current.push(currentSnapshot);
    }

    historyPresentRef.current = nextSnapshot;
    historyPresentKeyRef.current = makeSnapshotKey(nextSnapshot);
    applySnapshot(nextSnapshot);
    refreshHistoryState();
  }, [applySnapshot, makeSnapshotKey, refreshHistoryState]);

  const handleDeleteSelection = useCallback(() => {
    const selectedNodeIds = new Set(
      latestNodesRef.current.filter((node) => node.selected).map((node) => node.id)
    );
    if (selectedNodeIds.size > 0) {
      let changed = true;
      while (changed) {
        changed = false;
        latestNodesRef.current.forEach((node) => {
          const parentId = getParentId(node);
          if (parentId && selectedNodeIds.has(parentId) && !selectedNodeIds.has(node.id)) {
            selectedNodeIds.add(node.id);
            changed = true;
          }
        });
      }
    }

    setNodes((currentNodes) => {
      if (selectedNodeIds.size === 0) {
        return currentNodes;
      }

      return updateGroupChildCounts(
        currentNodes.filter((node) => !selectedNodeIds.has(node.id))
      );
    });

    setEdges((currentEdges) => {
      if (selectedNodeIds.size === 0) {
        return currentEdges.filter((edge) => !edge.selected);
      }

      return currentEdges.filter(
        (edge) =>
          !edge.selected &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      );
    });
  }, [setNodes, setEdges, updateGroupChildCounts]);

  const handleCreateInteractionFromVideoNode = useCallback(
    (sourceNodeId: string) => {
      let newButtonNodeId: string | null = null;
      let sourceNodeLabel = 'vidéo';

      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find(
          (node) => node.id === sourceNodeId
        ) as CustomNode | undefined;
        if (!sourceNode) {
          return currentNodes;
        }

        const sourceX = sourceNode.position?.x ?? 0;
        const sourceY = sourceNode.position?.y ?? 0;
        const sourceWidth = typeof sourceNode.width === 'number' ? sourceNode.width : 350;
        const outgoingCount = latestEdgesRef.current.filter(
          (edge) => edge.source === sourceNodeId
        ).length;
        const nextChoiceIndex = outgoingCount + 1;
        const buttonLabel = `Choix ${nextChoiceIndex}`;

        newButtonNodeId = getId();
        sourceNodeLabel =
          (sourceNode.data as { label?: string })?.label?.trim() || 'vidéo';

        const newButtonNode = hydrateNode({
          id: newButtonNodeId,
          type: 'button',
          position: {
            x: sourceX + sourceWidth + 96,
            y: sourceY + outgoingCount * 92,
          },
          data: {
            id: newButtonNodeId,
            label: buttonLabel,
            text: buttonLabel,
            style: { ...defaultButtonStyle },
            variant: 'contained',
            size: 'medium',
          } as ButtonNodeData,
        } as CustomNode);

        return currentNodes.concat(newButtonNode);
      });

      if (!newButtonNodeId) {
        return;
      }

      const createdButtonId = newButtonNodeId;

      setEdges((currentEdges) => {
        const nextEdge: CustomEdge = {
          id: `edge_${sourceNodeId}_${createdButtonId}_${Date.now()}`,
          source: sourceNodeId,
          target: createdButtonId,
          type: 'smoothstep',
          animated: true,
        };
        return [...currentEdges, nextEdge];
      });

      setToast({
        severity: 'info',
        message: `Bouton ajouté pour ${sourceNodeLabel}. Relie-le à la vidéo suivante.`,
      });
    },
    [setNodes, setEdges, hydrateNode]
  );

  const nodeTypes = useMemo(
    () => ({
      ...staticNodeTypes,
      video: (props: NodeProps<VideoNodeData>) => (
        <VideoNode
          {...props}
          onCreateInteraction={handleCreateInteractionFromVideoNode}
        />
      ),
    }),
    [handleCreateInteractionFromVideoNode]
  );

  const persistProject = useCallback(
    async (nodesToSave: CustomNode[], edgesToSave: CustomEdge[]) => {
      if (!projectId) {
        return;
      }

      if (isPersistingRef.current) {
        queuedSaveRef.current = { nodes: nodesToSave, edges: edgesToSave };
        return;
      }

      isPersistingRef.current = true;
      setIsSaving(true);

      try {
        const project = await projectService.loadProject(projectId);
        const updatedProject: Project = {
          ...project,
          nodes: nodesToSave,
          edges: edgesToSave,
          updatedAt: new Date().toISOString(),
        };
        await projectService.saveProject(updatedProject);
      } catch (error) {
        console.error('Error saving project:', error);
      } finally {
        isPersistingRef.current = false;
        setIsSaving(false);

        if (queuedSaveRef.current) {
          const queuedSave = queuedSaveRef.current;
          queuedSaveRef.current = null;
          void persistProject(queuedSave.nodes, queuedSave.edges);
        }
      }
    },
    [projectId, projectService]
  );

  useEffect(() => {
    latestNodesRef.current = nodes as unknown as CustomNode[];
    latestEdgesRef.current = [...edges];
  }, [nodes, edges]);

  useEffect(() => {
    if (isHydratingProjectRef.current) {
      return;
    }

    const nodesSnapshot = nodes as unknown as CustomNode[];
    if (nodesSnapshot.some((node) => node.dragging)) {
      return;
    }

    const snapshot = createSnapshot(nodesSnapshot, edges);
    const snapshotKey = makeSnapshotKey(snapshot);

    if (!historyPresentRef.current) {
      historyPresentRef.current = snapshot;
      historyPresentKeyRef.current = snapshotKey;
      refreshHistoryState();
      return;
    }

    if (snapshotKey === historyPresentKeyRef.current) {
      return;
    }

    if (!isApplyingHistoryRef.current) {
      historyPastRef.current.push(historyPresentRef.current);
      if (historyPastRef.current.length > HISTORY_LIMIT) {
        historyPastRef.current.shift();
      }
      historyFutureRef.current = [];
    }

    historyPresentRef.current = snapshot;
    historyPresentKeyRef.current = snapshotKey;
    refreshHistoryState();
  }, [nodes, edges, createSnapshot, makeSnapshotKey, refreshHistoryState]);

  const groupMembershipSignature = useMemo(
    () =>
      nodes
        .map((node) => `${node.id}:${getParentId(node) || ''}`)
        .sort()
        .join('|'),
    [nodes]
  );

  useEffect(() => {
    setNodes((currentNodes) => updateGroupChildCounts(currentNodes));
  }, [groupMembershipSignature, setNodes, updateGroupChildCounts]);

  const flushAutosave = useCallback(async () => {
    if (!projectId || isHydratingProjectRef.current) {
      return;
    }

    clearAutosaveTimer();
    await persistProject([...latestNodesRef.current], [...latestEdgesRef.current]);
  }, [projectId, clearAutosaveTimer, persistProject]);

  useEffect(() => {
    const loadProject = async () => {
      isHydratingProjectRef.current = true;
      hasAutosaveBaselineRef.current = false;
      clearAutosaveTimer();
      resetHistory();

      if (!projectId) {
        isHydratingProjectRef.current = false;
        return;
      }

      try {
        const project = await projectService.loadProject(projectId);
        const hydratedNodes = project.nodes.map((node) => hydrateNode(node));
        setNodes(applyGroupContainerState(hydratedNodes));
        setEdges(project.edges);
        setProjectName(project.name || 'Export interactif');
        setYoutubeTitle(project.name || 'Export interactif');
        setYoutubeDescription(project.description || '');
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        isHydratingProjectRef.current = false;
      }
    };

    void loadProject();
  }, [
    projectId,
    projectService,
    setNodes,
    setEdges,
    hydrateNode,
    applyGroupContainerState,
    clearAutosaveTimer,
    resetHistory,
  ]);

  useEffect(() => {
    if (!projectId || isHydratingProjectRef.current) {
      return;
    }

    if (!hasAutosaveBaselineRef.current) {
      hasAutosaveBaselineRef.current = true;
      return;
    }

    clearAutosaveTimer();
    const nodesSnapshot = [...nodes] as unknown as CustomNode[];
    const edgesSnapshot = [...edges];

    autosaveTimeoutRef.current = setTimeout(() => {
      void persistProject(nodesSnapshot, edgesSnapshot);
    }, AUTOSAVE_DEBOUNCE_MS);

    return clearAutosaveTimer;
  }, [nodes, edges, projectId, persistProject, clearAutosaveTimer]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const persistSnapshot = () => {
      if (isHydratingProjectRef.current) {
        return;
      }

      clearAutosaveTimer();
      void persistProject([...latestNodesRef.current], [...latestEdgesRef.current]);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistSnapshot();
      }
    };

    window.addEventListener('pagehide', persistSnapshot);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', persistSnapshot);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [projectId, clearAutosaveTimer, persistProject]);

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer]);

  const handleBackToLibrary = useCallback(async () => {
    await flushAutosave();

    if (isPlaybackMode) {
      endPlaybackSession('back_to_library');
      setIsPlaybackMode(false);
      setActiveVideoNodeId(null);
      setPlaybackMenuOptions([]);
      setPlaybackIsPlaying(false);
    }

    onBackToLibrary();
  }, [flushAutosave, isPlaybackMode, endPlaybackSession, onBackToLibrary]);

  useEffect(() => {
    playbackSessionIdRef.current = playbackSessionId;
  }, [playbackSessionId]);

  useEffect(() => {
    activeVideoNodeIdRef.current = activeVideoNodeId;
  }, [activeVideoNodeId]);

  useEffect(() => {
    return () => {
      endPlaybackSession('unmount', false);
    };
  }, [endPlaybackSession]);

  useEffect(() => {
    if (!isPlaybackMode) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        endPlaybackSession('escape');
        setIsPlaybackMode(false);
        setActiveVideoNodeId(null);
        setPlaybackMenuOptions([]);
        setPlaybackIsPlaying(false);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [isPlaybackMode, endPlaybackSession]);

  useEffect(() => {
    if (isPlaybackMode) {
      return;
    }

    const onUndoRedo = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        Boolean(target?.isContentEditable) || tag === 'input' || tag === 'textarea' || tag === 'select';
      if (isEditable) {
        return;
      }

      const withCommand = event.metaKey || event.ctrlKey;
      if (!withCommand) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey);

      if (wantsUndo) {
        event.preventDefault();
        handleUndo();
      } else if (wantsRedo) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onUndoRedo);
    return () => {
      window.removeEventListener('keydown', onUndoRedo);
    };
  }, [isPlaybackMode, handleUndo, handleRedo]);

  useEffect(() => {
    if (!isPlaybackMode) {
      void exitFullscreen();
    }
  }, [isPlaybackMode, exitFullscreen]);

  useEffect(() => {
    playbackOutReachedRef.current = false;
    playbackTransitionHandledRef.current = false;
    playbackPendingSeekRef.current = null;
    playbackPendingSeekAppliedAtRef.current = null;
    playbackPendingSeekAttemptsRef.current = 0;
  }, [activeVideoNodeId, playbackPlayerKey]);

  const resolveNodeToVideoTargets = useCallback(
    (startNodeId: string): string[] => {
      const visited = new Set<string>();
      const queued = new Set<string>([startNodeId]);
      const queue = [startNodeId];
      const resolved: string[] = [];
      const seenResolved = new Set<string>();
      const maxVisits = 256;

      while (queue.length > 0 && visited.size < maxVisits) {
        const nodeId = queue.shift() as string;
        queued.delete(nodeId);
        if (visited.has(nodeId)) {
          continue;
        }
        visited.add(nodeId);

        const node = graph.nodeById.get(nodeId);
        if (!node) {
          continue;
        }

        if (node.type === 'video') {
          const videoData = node.data as VideoNodeData;
          if (videoData.videoUrl && videoData.videoUrl.trim() && !seenResolved.has(node.id)) {
            seenResolved.add(node.id);
            resolved.push(node.id);
          }
          continue;
        }

        if (node.type === 'workflow') {
          continue;
        }

        if (node.type === 'button') {
          const buttonData = node.data as ButtonNodeData;
          if (
            buttonData.targetNodeId &&
            !visited.has(buttonData.targetNodeId) &&
            !queued.has(buttonData.targetNodeId)
          ) {
            queue.push(buttonData.targetNodeId);
            queued.add(buttonData.targetNodeId);
          }
        }

        const outgoing = graph.outgoing.get(nodeId) ?? [];
        outgoing.forEach((edge) => {
          if (!visited.has(edge.target) && !queued.has(edge.target)) {
            queue.push(edge.target);
            queued.add(edge.target);
          }
        });
      }

      return resolved;
    },
    [graph]
  );

  const resolveButtonTargetVideoId = useCallback(
    (buttonNodeId: string): string | undefined => {
      const buttonNode = graph.nodeById.get(buttonNodeId);
      if (!buttonNode || buttonNode.type !== 'button') {
        return undefined;
      }

      return resolveNodeToVideoTargets(buttonNodeId)[0];
    },
    [graph, resolveNodeToVideoTargets]
  );

  const buildPlaybackTransitions = useCallback(
    (videoNodeId: string): { menuOptions: PlaybackMenuOption[]; autoNextVideoId?: string } => {
      const outgoing = graph.outgoing.get(videoNodeId) ?? [];
      const options: PlaybackMenuOption[] = [];
      const directVideoTargets: Array<{ videoNodeId: string; labelHint?: string }> = [];
      const seenKeys = new Set<string>();

      outgoing.forEach((edge) => {
        const targetNode = graph.nodeById.get(edge.target);
        if (!targetNode) {
          return;
        }

        if (targetNode.type === 'button') {
          const buttonData = targetNode.data as ButtonNodeData;
          const targetVideoNodeId = resolveButtonTargetVideoId(targetNode.id);
          if (!targetVideoNodeId) {
            return;
          }

          const key = `button:${targetNode.id}:${targetVideoNodeId}`;
          if (seenKeys.has(key)) {
            return;
          }
          seenKeys.add(key);

          options.push({
            id: targetNode.id,
            label: buttonData.text || buttonData.label || 'Continuer',
            targetVideoNodeId,
            style: buttonData.style,
            variant: buttonData.variant,
            size: buttonData.size,
          });
          return;
        }

        const reachableVideoTargets = resolveNodeToVideoTargets(targetNode.id);
        if (reachableVideoTargets.length === 0) {
          return;
        }

        const labelHint =
          targetNode.type === 'group'
            ? (targetNode.data as ScenarioGroupNodeData).label?.trim() || undefined
            : undefined;

        reachableVideoTargets.forEach((resolvedVideoNodeId) => {
          const key = `direct:${targetNode.id}:${resolvedVideoNodeId}`;
          if (seenKeys.has(key)) {
            return;
          }
          seenKeys.add(key);
          directVideoTargets.push({
            videoNodeId: resolvedVideoNodeId,
            ...(reachableVideoTargets.length === 1 && labelHint
              ? { labelHint }
              : {}),
          });
        });
      });

      const currentNode = graph.nodeById.get(videoNodeId);
      if (currentNode?.type === 'video') {
        const videoData = currentNode.data as VideoNodeData;
        (videoData.buttons ?? []).forEach((button) => {
          if (!button.targetNodeId) {
            return;
          }

          const targetVideoNodeId = resolveNodeToVideoTargets(button.targetNodeId)[0];
          if (!targetVideoNodeId) {
            return;
          }

          const key = `legacy:${button.id}:${targetVideoNodeId}`;
          if (seenKeys.has(key)) {
            return;
          }
          seenKeys.add(key);

          options.push({
            id: button.id,
            label: button.buttonText || button.label || 'Continuer',
            targetVideoNodeId,
          });
        });
      }

      if (options.length > 0) {
        return { menuOptions: options };
      }

      if (directVideoTargets.length === 1) {
        return { menuOptions: [], autoNextVideoId: directVideoTargets[0].videoNodeId };
      }

      if (directVideoTargets.length > 1) {
        const labelHintCounts = directVideoTargets.reduce<Record<string, number>>((acc, target) => {
          if (target.labelHint) {
            acc[target.labelHint] = (acc[target.labelHint] || 0) + 1;
          }
          return acc;
        }, {});

        const menuOptions = directVideoTargets.map((target, index) => {
          const targetNode = graph.nodeById.get(target.videoNodeId);
          const targetData =
            targetNode?.type === 'video' ? (targetNode.data as VideoNodeData) : undefined;
          const canUseLabelHint =
            Boolean(target.labelHint) &&
            Boolean(target.labelHint && labelHintCounts[target.labelHint] === 1);

          return {
            id: `direct-${videoNodeId}-${target.videoNodeId}`,
            label:
              (canUseLabelHint ? target.labelHint : undefined) ||
              targetData?.label ||
              `Choix ${index + 1}`,
            targetVideoNodeId: target.videoNodeId,
          };
        });
        return { menuOptions };
      }

      return { menuOptions: [] };
    },
    [graph, resolveButtonTargetVideoId, resolveNodeToVideoTargets]
  );

  const findStartVideoNodeId = useCallback((): string | null => {
    const playableVideos = (nodes as unknown as CustomNode[]).filter((node) => {
      if (node.type !== 'video') {
        return false;
      }
      const data = node.data as VideoNodeData;
      return Boolean(data.videoUrl && data.videoUrl.trim());
    });

    if (playableVideos.length === 0) {
      return null;
    }

    const rootVideo = playableVideos.find((videoNode) => {
      const incoming = graph.incoming.get(videoNode.id) ?? [];
      return incoming.every((edge) => {
        const sourceNode = graph.nodeById.get(edge.source);
        return (
          !sourceNode ||
          (sourceNode.type !== 'video' &&
            sourceNode.type !== 'button' &&
            sourceNode.type !== 'group')
        );
      });
    });

    return rootVideo?.id || playableVideos[0].id;
  }, [nodes, graph]);

  const activeVideoNode = useMemo(() => {
    if (!activeVideoNodeId) {
      return null;
    }
    const node = graph.nodeById.get(activeVideoNodeId);
    if (!node || node.type !== 'video') {
      return null;
    }
    return node as CustomNode;
  }, [activeVideoNodeId, graph]);

  const activeVideoData =
    activeVideoNode?.type === 'video' ? (activeVideoNode.data as VideoNodeData) : undefined;

  const activeMediaIn = useMemo(() => {
    const parsed = Number(activeVideoData?.mediaIn ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }, [activeVideoData?.mediaIn]);

  const activeMediaOut = useMemo(() => {
    const rawValue = activeVideoData?.mediaOut;
    if (rawValue === undefined || rawValue === null) {
      return undefined;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= activeMediaIn) {
      return undefined;
    }
    return parsed;
  }, [activeVideoData?.mediaOut, activeMediaIn]);

  useEffect(() => {
    if (!isPlaybackMode || !activeVideoNodeId || !playbackSessionId) {
      return;
    }

    const node = graph.nodeById.get(activeVideoNodeId);
    if (!node || node.type !== 'video') {
      return;
    }

    const data = node.data as VideoNodeData;
    playbackProgressMilestonesRef.current[activeVideoNodeId] = new Set<number>();
    trackPlaybackEvent('node_enter', {
      nodeId: activeVideoNodeId,
      playbackTimeSec: activeMediaIn,
      meta: {
        mediaIn: activeMediaIn,
        mediaOut: activeMediaOut ?? null,
        hasVideo: Boolean(data.videoUrl && data.videoUrl.trim()),
      },
    });
  }, [
    isPlaybackMode,
    activeVideoNodeId,
    playbackSessionId,
    graph,
    activeMediaIn,
    activeMediaOut,
    trackPlaybackEvent,
  ]);

  const clearPlaybackPendingSeek = useCallback(() => {
    playbackPendingSeekRef.current = null;
    playbackPendingSeekAppliedAtRef.current = null;
    playbackPendingSeekAttemptsRef.current = 0;
  }, []);

  const applyPlaybackSeek = useCallback((targetSeconds: number) => {
    if (!playbackPlayerRef.current) {
      return;
    }
    try {
      playbackPlayerRef.current.seekTo(targetSeconds, 'seconds');
      playbackPendingSeekAttemptsRef.current += 1;
      playbackPendingSeekAppliedAtRef.current = Date.now();
    } catch (error) {
      console.error('Error applying playback seek:', error);
    }
  }, []);

  const handlePlaybackNavigate = useCallback((targetVideoNodeId: string) => {
    setActiveVideoNodeId(targetVideoNodeId);
    setPlaybackMenuOptions([]);
    setPlaybackIsPlaying(true);
    playbackPendingSeekRef.current = null;
    playbackPendingSeekAppliedAtRef.current = null;
    playbackPendingSeekAttemptsRef.current = 0;
    playbackOutReachedRef.current = false;
    playbackTransitionHandledRef.current = false;
    setPlaybackPlayerKey((previous) => previous + 1);
  }, []);

  const handlePlaybackMenuChoice = useCallback(
    (option: PlaybackMenuOption) => {
      trackPlaybackEvent('choice_click', {
        nodeId: activeVideoNodeId,
        buttonId: option.id,
        targetNodeId: option.targetVideoNodeId,
        meta: {
          label: option.label,
        },
      });
      handlePlaybackNavigate(option.targetVideoNodeId);
    },
    [activeVideoNodeId, handlePlaybackNavigate, trackPlaybackEvent]
  );

  const handlePlaybackEnded = useCallback(() => {
    if (!activeVideoNodeId || playbackTransitionHandledRef.current) {
      return;
    }
    playbackTransitionHandledRef.current = true;
    clearPlaybackPendingSeek();

    setPlaybackIsPlaying(false);
    trackPlaybackEvent('video_complete', {
      nodeId: activeVideoNodeId,
      playbackTimeSec: activeMediaOut ?? undefined,
    });

    const { menuOptions, autoNextVideoId } = buildPlaybackTransitions(activeVideoNodeId);
    if (menuOptions.length > 0) {
      setPlaybackMenuOptions(menuOptions);
      trackPlaybackEvent('menu_shown', {
        nodeId: activeVideoNodeId,
        meta: {
          optionsCount: menuOptions.length,
        },
      });
      return;
    }

    if (autoNextVideoId) {
      trackPlaybackEvent('auto_advance', {
        nodeId: activeVideoNodeId,
        targetNodeId: autoNextVideoId,
      });
      handlePlaybackNavigate(autoNextVideoId);
      return;
    }

    setPlaybackMenuOptions([]);
    trackPlaybackEvent('scenario_complete', {
      nodeId: activeVideoNodeId,
    });
  }, [
    activeVideoNodeId,
    activeMediaOut,
    buildPlaybackTransitions,
    handlePlaybackNavigate,
    clearPlaybackPendingSeek,
    trackPlaybackEvent,
  ]);

  const handlePlaybackError = useCallback(() => {
    if (!activeVideoNodeId || playbackTransitionHandledRef.current) {
      return;
    }
    playbackTransitionHandledRef.current = true;

    setPlaybackIsPlaying(false);
    clearPlaybackPendingSeek();
    trackPlaybackEvent('video_error', {
      nodeId: activeVideoNodeId,
    });
    const { autoNextVideoId } = buildPlaybackTransitions(activeVideoNodeId);
    if (autoNextVideoId) {
      handlePlaybackNavigate(autoNextVideoId);
    }
  }, [
    activeVideoNodeId,
    buildPlaybackTransitions,
    handlePlaybackNavigate,
    clearPlaybackPendingSeek,
    trackPlaybackEvent,
  ]);

  const forcePlaybackPlayerPlay = useCallback(() => {
    if (!playbackPlayerRef.current) {
      return;
    }
    try {
      const internalPlayer = playbackPlayerRef.current.getInternalPlayer?.() as
        | HTMLMediaElement
        | null;
      const playAttempt = internalPlayer?.play?.();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        void playAttempt.catch(() => undefined);
      }
    } catch (error) {
      console.error('Error forcing playback play:', error);
    }
  }, []);

  const handlePlaybackReady = useCallback(() => {
    playbackOutReachedRef.current = false;
    playbackTransitionHandledRef.current = false;

    if (activeVideoNodeId) {
      playbackProgressMilestonesRef.current[activeVideoNodeId] = new Set<number>();
      trackPlaybackEvent('video_start', {
        nodeId: activeVideoNodeId,
        playbackTimeSec: activeMediaIn,
      });
    }

    if (activeMediaIn > 0 && playbackPlayerRef.current) {
      playbackPendingSeekRef.current = activeMediaIn;
      playbackPendingSeekAttemptsRef.current = 0;
      playbackPendingSeekAppliedAtRef.current = null;
      applyPlaybackSeek(activeMediaIn);
    } else {
      clearPlaybackPendingSeek();
    }

    setPlaybackIsPlaying(true);
    forcePlaybackPlayerPlay();
  }, [
    activeMediaIn,
    activeVideoNodeId,
    trackPlaybackEvent,
    forcePlaybackPlayerPlay,
    applyPlaybackSeek,
    clearPlaybackPendingSeek,
  ]);

  const handlePlaybackSeek = useCallback(
    (seconds: number) => {
      const pendingTarget = playbackPendingSeekRef.current;
      if (pendingTarget === null) {
        return;
      }
      if (seconds >= pendingTarget - PLAYBACK_SEEK_TOLERANCE_SECONDS) {
        clearPlaybackPendingSeek();
        forcePlaybackPlayerPlay();
      }
    },
    [forcePlaybackPlayerPlay, clearPlaybackPendingSeek]
  );

  const handlePlaybackProgress = useCallback(
    (progressState: { playedSeconds: number; played?: number }) => {
      if (!playbackIsPlaying) {
        return;
      }

      const pendingTarget = playbackPendingSeekRef.current;
      if (pendingTarget !== null) {
        if (progressState.playedSeconds >= pendingTarget - PLAYBACK_SEEK_TOLERANCE_SECONDS) {
          clearPlaybackPendingSeek();
          forcePlaybackPlayerPlay();
        } else {
          const now = Date.now();
          const lastAttemptAt = playbackPendingSeekAppliedAtRef.current;
          const elapsedSinceAttempt =
            typeof lastAttemptAt === 'number' ? now - lastAttemptAt : Number.POSITIVE_INFINITY;

          if (
            playbackPendingSeekAttemptsRef.current < PLAYBACK_MAX_SEEK_ATTEMPTS &&
            elapsedSinceAttempt >= PLAYBACK_SEEK_RETRY_DELAY_MS
          ) {
            applyPlaybackSeek(pendingTarget);
          } else if (elapsedSinceAttempt >= PLAYBACK_SEEK_STUCK_TIMEOUT_MS) {
            // If seek events are dropped, avoid freezing forever on the entry frame.
            clearPlaybackPendingSeek();
            forcePlaybackPlayerPlay();
          }
          return;
        }
      }

      if (progressState.playedSeconds < activeMediaIn - PLAYBACK_SEEK_TOLERANCE_SECONDS) {
        return;
      }

      if (activeMediaOut && !playbackOutReachedRef.current && progressState.playedSeconds >= activeMediaOut) {
        playbackOutReachedRef.current = true;
        handlePlaybackEnded();
      }

      if (!activeVideoNodeId || !playbackSessionId) {
        return;
      }

      const milestones = [25, 50, 75];
      const milestonesForNode =
        playbackProgressMilestonesRef.current[activeVideoNodeId] || new Set<number>();
      playbackProgressMilestonesRef.current[activeVideoNodeId] = milestonesForNode;

      let progressPct = 0;
      const effectiveDuration =
        typeof activeMediaOut === 'number' ? Math.max(0.01, activeMediaOut - activeMediaIn) : null;
      if (effectiveDuration) {
        progressPct = ((progressState.playedSeconds - activeMediaIn) / effectiveDuration) * 100;
      } else if (typeof progressState.played === 'number') {
        progressPct = progressState.played * 100;
      }

      if (!Number.isFinite(progressPct)) {
        return;
      }

      const boundedProgress = Math.max(0, Math.min(100, progressPct));
      milestones.forEach((milestone) => {
        if (boundedProgress >= milestone && !milestonesForNode.has(milestone)) {
          milestonesForNode.add(milestone);
          trackPlaybackEvent(`video_progress_${milestone}`, {
            nodeId: activeVideoNodeId,
            progressPct: milestone,
            playbackTimeSec: progressState.playedSeconds,
          });
        }
      });
    },
    [
      playbackIsPlaying,
      activeMediaOut,
      activeMediaIn,
      activeVideoNodeId,
      playbackSessionId,
      handlePlaybackEnded,
      trackPlaybackEvent,
      forcePlaybackPlayerPlay,
      clearPlaybackPendingSeek,
      applyPlaybackSeek,
    ]
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const rawType =
        event.dataTransfer.getData('application/reactflow') ||
        event.dataTransfer.getData('text/plain');
      const type = rawType.trim();
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const projector = reactFlowInstance as unknown as {
        screenToFlowPosition?: (position: XYPosition) => XYPosition;
        project?: (position: XYPosition) => XYPosition;
      };
      const toFlowPosition = projector.screenToFlowPosition || projector.project;
      if (!toFlowPosition) {
        return;
      }
      const position: XYPosition = toFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNodeId = getId();
      let newNode: CustomNode;

      if (type === 'video') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            id: newNodeId,
            label: 'Nouvelle vidéo',
            videoUrl: '',
            buttons: [],
          } as VideoNodeData,
        };
      } else if (type === 'button') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            id: newNodeId,
            label: 'Nouveau bouton',
            text: 'Cliquez-moi',
            style: defaultButtonStyle,
            variant: 'contained',
            size: 'medium',
          } as ButtonNodeData,
        };
      } else if (type === 'group') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            id: newNodeId,
            label: 'Nouveau groupe',
            description: '',
            isExpanded: false,
          } as ScenarioGroupNodeData,
        };
      } else if (type === 'workflow') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            id: newNodeId,
            label: 'Workflow IA',
            provider: 'workflow',
            workflowPreset: 'thumbnail_pack',
            executionMode: 'local',
            inputMode: 'media_library',
            outputType: 'image_batch',
            prompt: '',
            negativePrompt: '',
            notes: '',
            status: 'draft',
            expectedOutputs: 4,
            sourceMediaId: '',
            sourceMediaName: '',
            sourceThumbnailUrl: '',
            outputs: [],
            lastRunAt: '',
            lastError: '',
            lastExecutionProvider: '',
            lastExecutionEngine: '',
          } as WorkflowNodeData,
        };
      } else {
        newNode = {
          id: newNodeId,
          type: 'base',
          position,
          data: {
            label: `Nouveau ${type}`,
            choices: [],
          },
        } as CustomNode;
      }

      setNodes((currentNodes) => {
        const hydrated = hydrateNode(newNode);

        if (newNode.type !== 'group') {
          const nodeById = new Map(currentNodes.map((candidate) => [candidate.id, candidate]));
          const expandedTargetGroup = [...currentNodes]
            .reverse()
            .find((candidate) => {
              if (candidate.type !== 'group') {
                return false;
              }
              const groupData = candidate.data as ScenarioGroupNodeData;
              if (!groupData.isExpanded) {
                return false;
              }

              const groupAbsolute = getAbsoluteNodePosition(candidate, nodeById);
              const groupWidth =
                typeof candidate.style?.width === 'number'
                  ? candidate.style.width
                  : GROUP_EXPANDED_WIDTH;
              const groupHeight =
                typeof candidate.style?.height === 'number'
                  ? candidate.style.height
                  : GROUP_EXPANDED_HEIGHT;

              return (
                position.x >= groupAbsolute.x &&
                position.x <= groupAbsolute.x + groupWidth &&
                position.y >= groupAbsolute.y &&
                position.y <= groupAbsolute.y + groupHeight
              );
            });

          if (expandedTargetGroup) {
            const groupAbsolute = getAbsoluteNodePosition(expandedTargetGroup, nodeById);
            const relativePosition = clampPositionInsideGroup({
              x: position.x - groupAbsolute.x,
              y: position.y - groupAbsolute.y,
            });

            return updateGroupChildCounts(
              currentNodes.concat({
                ...hydrated,
                position: relativePosition,
                parentId: expandedTargetGroup.id,
                parentNode: expandedTargetGroup.id,
                extent: 'parent' as const,
                hidden: false,
              } as CustomNode)
            );
          }
        }

        return updateGroupChildCounts(currentNodes.concat(hydrated));
      });
    },
    [reactFlowInstance, clampPositionInsideGroup, hydrateNode, setNodes, updateGroupChildCounts]
  );

  const handleSave = useCallback(async () => {
    clearAutosaveTimer();
    await persistProject(nodes as unknown as CustomNode[], edges);
  }, [clearAutosaveTimer, persistProject, nodes, edges]);

  const refreshYoutubeAuthStatus = useCallback(async () => {
    setIsYoutubeStatusLoading(true);
    try {
      const response = await fetch('/api/youtube/auth/status');
      const payload = (await response.json()) as YoutubeAuthStatusResponse;
      setYoutubeAuthStatus(payload);
      return payload;
    } catch {
      const fallbackStatus: YoutubeAuthStatusResponse = {
        configured: false,
        connected: false,
        error: 'Impossible de vérifier la connexion YouTube',
      };
      setYoutubeAuthStatus(fallbackStatus);
      return fallbackStatus;
    } finally {
      setIsYoutubeStatusLoading(false);
    }
  }, []);

  const refreshYoutubeConfig = useCallback(async () => {
    setIsYoutubeConfigLoading(true);
    try {
      const response = await fetch('/api/youtube/config');
      const payload = (await response.json()) as YoutubeConfigResponse;

      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de récupérer la configuration YouTube');
      }

      setYoutubeConfigSource(payload.source || 'none');
      setYoutubeClientIdInput(payload.clientId || '');
      setYoutubeRedirectUriInput(
        payload.redirectUri || 'http://localhost:3000/api/youtube/auth/callback'
      );
      setYoutubeClientSecretInput('');
      setYoutubeClientSecretSet(Boolean(payload.clientSecretSet));
      return payload;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de récupérer la configuration YouTube';
      setToast({ severity: 'error', message });
      return null;
    } finally {
      setIsYoutubeConfigLoading(false);
    }
  }, []);

  const handleOpenYoutubeExport = useCallback(() => {
    setIsYoutubeDialogOpen(true);
    void refreshYoutubeAuthStatus();
    void refreshYoutubeConfig();
  }, [refreshYoutubeAuthStatus, refreshYoutubeConfig]);

  const handleSaveYoutubeConfig = useCallback(async () => {
    if (isYoutubeConfigSaving || isYoutubeExporting || isYoutubeScenarioSyncing) {
      return;
    }

    setIsYoutubeConfigSaving(true);
    try {
      const response = await fetch('/api/youtube/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: youtubeClientIdInput.trim(),
          clientSecret: youtubeClientSecretInput.trim(),
          redirectUri: youtubeRedirectUriInput.trim(),
        }),
      });
      const payload = (await response.json()) as YoutubeConfigResponse;

      if (!response.ok) {
        throw new Error(payload?.error || 'Configuration YouTube invalide');
      }

      setYoutubeConfigSource(payload.source || 'none');
      setYoutubeClientIdInput(payload.clientId || '');
      setYoutubeRedirectUriInput(
        payload.redirectUri || 'http://localhost:3000/api/youtube/auth/callback'
      );
      setYoutubeClientSecretInput('');
      setYoutubeClientSecretSet(Boolean(payload.clientSecretSet));

      setToast({
        severity: 'success',
        message: payload.tokenReset
          ? 'Configuration YouTube enregistrée. Reconnecte le compte YouTube.'
          : 'Configuration YouTube enregistrée.',
      });

      await refreshYoutubeAuthStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration YouTube invalide';
      setToast({ severity: 'error', message });
    } finally {
      setIsYoutubeConfigSaving(false);
    }
  }, [
    isYoutubeConfigSaving,
    isYoutubeExporting,
    isYoutubeScenarioSyncing,
    youtubeClientIdInput,
    youtubeClientSecretInput,
    youtubeRedirectUriInput,
    refreshYoutubeAuthStatus,
  ]);

  const handleConnectYoutube = useCallback(async () => {
    try {
      const response = await fetch('/api/youtube/auth/url');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible d’ouvrir la connexion YouTube');
      }

      if (typeof payload?.url !== 'string' || !payload.url) {
        throw new Error('URL de connexion YouTube invalide');
      }

      window.open(payload.url, '_blank', 'noopener,noreferrer');
      setToast({
        severity: 'info',
        message: 'Connexion YouTube ouverte dans un nouvel onglet. Revenez puis cliquez sur Rafraîchir.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connexion YouTube impossible';
      setToast({ severity: 'error', message });
    }
  }, []);

  const handleCopyLastYoutubeLink = useCallback(async () => {
    const primaryVideo =
      lastYoutubeExportLink?.videos.find((video) => video.kind === 'main') ||
      lastYoutubeExportLink?.videos[0] ||
      null;
    const linkToCopy =
      primaryVideo?.url ||
      primaryVideo?.studioUrl ||
      lastYoutubeExportLink?.url ||
      lastYoutubeExportLink?.studioUrl;
    if (!linkToCopy) {
      setToast({
        severity: 'info',
        message: 'Aucun lien YouTube disponible à copier pour le moment.',
      });
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkToCopy);
      } else {
        throw new Error('Clipboard API indisponible');
      }
      setToast({
        severity: 'success',
        message: 'Lien YouTube copié dans le presse-papiers.',
      });
    } catch {
      setToast({
        severity: 'info',
        message: `Copie automatique impossible. Lien: ${linkToCopy}`,
      });
    }
  }, [lastYoutubeExportLink]);

  const createYoutubePlaywrightPlan = useCallback((): YoutubePlaywrightPlanDocument | null => {
    if (!lastYoutubeExportLink || !Array.isArray(lastYoutubeExportLink.endScreenPlan)) {
      return null;
    }

    const steps = lastYoutubeExportLink.endScreenPlan
      .map((plan): YoutubePlaywrightPlanStep => {
        const targets = (Array.isArray(plan.targets) ? plan.targets : [])
          .map((target): YoutubePlaywrightPlanTarget => {
            const targetVideoId =
              extractYoutubeVideoId(target.targetVideoId || null) ||
              extractYoutubeVideoId(target.targetUrl || null) ||
              extractYoutubeVideoId(target.targetStudioUrl || null);
            return {
              targetNodeId: String(target.targetNodeId || '').trim(),
              targetLabel: String(target.targetLabel || target.targetNodeId || 'Cible').trim(),
              targetVideoId,
              targetThumbnailUrl: buildYoutubeThumbnailUrl(targetVideoId),
              targetStudioUrl: target.targetStudioUrl || null,
              targetUrl: target.targetUrl || null,
            };
          })
          .filter((target) => Boolean(target.targetNodeId && (target.targetStudioUrl || target.targetUrl)));

        return {
          sourceNodeId: String(plan.sourceNodeId || '').trim(),
          sourceLabel: String(plan.sourceLabel || plan.sourceNodeId || 'Source').trim(),
          sourceVideoId: plan.sourceVideoId || null,
          sourceStudioUrl: plan.sourceStudioUrl || null,
          sourceUrl: plan.sourceUrl || null,
          targets,
        };
      })
      .filter((step) => Boolean(step.sourceNodeId && step.sourceStudioUrl && step.targets.length > 0));

    if (steps.length === 0) {
      return null;
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      scenarioTitle: lastYoutubeExportLink.title || 'Export interactif',
      channelTitle: lastYoutubeExportLink.channelTitle || 'Chaîne YouTube',
      steps,
    };
  }, [lastYoutubeExportLink]);

  const handleCopyYoutubePlaywrightPlan = useCallback(async () => {
    const bundle = (() => {
      const plan = createYoutubePlaywrightPlan();
      if (!plan) {
        return null;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = (plan.scenarioTitle || 'export-interactif')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const fileName = `youtube-endscreen-plan-${safeTitle || 'export'}-${timestamp}.json`;
      return {
        plan,
        payload: JSON.stringify(plan, null, 2),
        fileName,
      };
    })();

    if (!bundle) {
      setToast({
        severity: 'info',
        message: 'Aucun plan YouTube exploitable pour Playwright.',
      });
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bundle.payload);
        setToast({
          severity: 'success',
          message: 'Plan Playwright copié dans le presse-papiers.',
        });
      } else {
        throw new Error('Clipboard API indisponible');
      }
    } catch {
      setToast({
        severity: 'info',
        message: 'Copie automatique impossible. Utilise le bouton de téléchargement JSON.',
      });
    }
  }, [createYoutubePlaywrightPlan]);

  const downloadBrowserFile = useCallback((href: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadTextFile = useCallback(
    (content: string, fileName: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      downloadBrowserFile(objectUrl, fileName);
      URL.revokeObjectURL(objectUrl);
    },
    [downloadBrowserFile]
  );

  const handleDownloadYoutubePlaywrightPlan = useCallback(() => {
    const bundle = (() => {
      const plan = createYoutubePlaywrightPlan();
      if (!plan) {
        return null;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = (plan.scenarioTitle || 'export-interactif')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const fileName = `youtube-endscreen-plan-${safeTitle || 'export'}-${timestamp}.json`;
      return {
        plan,
        payload: JSON.stringify(plan, null, 2),
        fileName,
      };
    })();

    if (!bundle) {
      setToast({
        severity: 'info',
        message: 'Aucun plan YouTube exploitable pour Playwright.',
      });
      return;
    }

    downloadTextFile(bundle.payload, bundle.fileName, 'application/json');

    setToast({
      severity: 'success',
      message: `Plan Playwright téléchargé (${bundle.fileName}).`,
    });
  }, [createYoutubePlaywrightPlan, downloadTextFile]);

  const handlePrepareYoutubePlaywrightLaunch = useCallback(
    async (planOverride?: YoutubePlaywrightPlanDocument | null) => {
      const bundle = (() => {
        const plan = planOverride || createYoutubePlaywrightPlan();
        if (!plan) {
          return null;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeTitle = (plan.scenarioTitle || 'export-interactif')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();
        const fileName = `youtube-endscreen-plan-${safeTitle || 'export'}-${timestamp}.json`;
        return {
          payload: JSON.stringify(plan, null, 2),
          fileName,
        };
      })();

      if (!bundle) {
        setToast({
          severity: 'info',
          message: 'Aucun plan YouTube exploitable pour Playwright.',
        });
        return;
      }

      downloadTextFile(bundle.payload, bundle.fileName, 'application/json');
      downloadBrowserFile(
        YOUTUBE_PLAYWRIGHT_ASSISTANT_SCRIPT_PATH,
        YOUTUBE_PLAYWRIGHT_ASSISTANT_SCRIPT_FILE_NAME
      );

      const command = `node "$HOME/Downloads/${YOUTUBE_PLAYWRIGHT_ASSISTANT_SCRIPT_FILE_NAME}" --plan "$HOME/Downloads/${bundle.fileName}"`;
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(command);
          setToast({
            severity: 'success',
            message: `Plan + assistant Playwright téléchargés. Commande copiée.`,
          });
        } else {
          throw new Error('Clipboard API indisponible');
        }
      } catch {
        setToast({
          severity: 'info',
          message: `Plan téléchargé (${bundle.fileName}). Lance ensuite: ${command}`,
        });
      }
    },
    [createYoutubePlaywrightPlan, downloadBrowserFile, downloadTextFile]
  );

  const persistYoutubeEndScreenPresets = useCallback((nextPresets: YoutubeEndScreenPreset[]) => {
    const normalizedPresets = nextPresets.slice(0, YOUTUBE_ENDSCREEN_PRESETS_LIMIT);
    setYoutubeEndScreenPresets(normalizedPresets);
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(
        YOUTUBE_ENDSCREEN_PRESETS_STORAGE_KEY,
        JSON.stringify(normalizedPresets)
      );
    } catch (error) {
      console.warn('Impossible de persister les presets End Screens:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(YOUTUBE_ENDSCREEN_PRESETS_STORAGE_KEY);
      if (!raw) {
        setYoutubeEndScreenPresets([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setYoutubeEndScreenPresets([]);
        return;
      }
      const presets = parsed
        .filter((entry): entry is YoutubeEndScreenPreset => {
          if (!entry || typeof entry !== 'object') {
            return false;
          }
          const candidate = entry as Partial<YoutubeEndScreenPreset>;
          return Boolean(
            typeof candidate.id === 'string' &&
              typeof candidate.name === 'string' &&
              candidate.plan &&
              typeof candidate.plan === 'object' &&
              Array.isArray((candidate.plan as YoutubePlaywrightPlanDocument).steps)
          );
        })
        .slice(0, YOUTUBE_ENDSCREEN_PRESETS_LIMIT);
      setYoutubeEndScreenPresets(presets);
    } catch (error) {
      console.warn('Impossible de charger les presets End Screens:', error);
      setYoutubeEndScreenPresets([]);
    }
  }, []);

  const readYoutubeExportCacheEntry = useCallback((): YoutubeExportCacheEntry | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(YOUTUBE_EXPORT_CACHE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const cacheStore = parsed as YoutubeExportCacheStore;
      const entry = cacheStore[getYoutubeExportCacheProjectKey(projectId)];
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      if (
        typeof entry.signature !== 'string' ||
        !entry.signature.trim() ||
        !entry.lastExportLink ||
        typeof entry.lastExportLink !== 'object'
      ) {
        return null;
      }

      return entry;
    } catch (error) {
      console.warn('Impossible de lire le cache export YouTube:', error);
      return null;
    }
  }, [projectId]);

  const writeYoutubeExportCacheEntry = useCallback(
    (entry: YoutubeExportCacheEntry | null) => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        const raw = window.localStorage.getItem(YOUTUBE_EXPORT_CACHE_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : {};
        const cacheStore: YoutubeExportCacheStore =
          parsed && typeof parsed === 'object' ? (parsed as YoutubeExportCacheStore) : {};
        const projectKey = getYoutubeExportCacheProjectKey(projectId);

        if (entry) {
          cacheStore[projectKey] = entry;
        } else {
          delete cacheStore[projectKey];
        }

        window.localStorage.setItem(YOUTUBE_EXPORT_CACHE_STORAGE_KEY, JSON.stringify(cacheStore));
      } catch (error) {
        console.warn('Impossible d’écrire le cache export YouTube:', error);
      }
    },
    [projectId]
  );

  useEffect(() => {
    const cachedEntry = readYoutubeExportCacheEntry();
    if (!cachedEntry) {
      setLastYoutubeExportSignature(null);
      setLastYoutubeExportLink(null);
      return;
    }

    setLastYoutubeExportSignature(cachedEntry.signature);
    setLastYoutubeExportLink(cachedEntry.lastExportLink);
  }, [readYoutubeExportCacheEntry]);

  const latestYoutubePlaywrightPlan = useMemo(
    () => createYoutubePlaywrightPlan(),
    [createYoutubePlaywrightPlan]
  );

  const selectedYoutubeEndScreenPreset = useMemo(
    () =>
      youtubeEndScreenPresets.find((preset) => preset.id === selectedYoutubeEndScreenPresetId) || null,
    [youtubeEndScreenPresets, selectedYoutubeEndScreenPresetId]
  );

  const youtubeEndScreenWizardPlan = useMemo(
    () => selectedYoutubeEndScreenPreset?.plan || latestYoutubePlaywrightPlan,
    [latestYoutubePlaywrightPlan, selectedYoutubeEndScreenPreset]
  );

  const youtubeEndScreenWizardSteps = useMemo(
    () => youtubeEndScreenWizardPlan?.steps || [],
    [youtubeEndScreenWizardPlan]
  );

  const youtubeEndScreenWizardStepCount = youtubeEndScreenWizardSteps.length;

  useEffect(() => {
    if (selectedYoutubeEndScreenPresetId) {
      return;
    }
    if (latestYoutubePlaywrightPlan) {
      return;
    }
    if (youtubeEndScreenPresets.length === 0) {
      return;
    }
    setSelectedYoutubeEndScreenPresetId(youtubeEndScreenPresets[0].id);
  }, [latestYoutubePlaywrightPlan, selectedYoutubeEndScreenPresetId, youtubeEndScreenPresets]);

  const handleSaveYoutubeEndScreenPreset = useCallback(() => {
    const planToSave = latestYoutubePlaywrightPlan || youtubeEndScreenWizardPlan;
    if (!planToSave) {
      setToast({
        severity: 'info',
        message: 'Aucun plan End Screens à mémoriser.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const autoName = `${planToSave.scenarioTitle || 'Preset End Screens'} • ${new Date().toLocaleString('fr-FR')}`;
    const nextPreset: YoutubeEndScreenPreset = {
      id: `preset-${getId()}`,
      name: youtubeEndScreenPresetNameInput.trim() || autoName,
      createdAt: nowIso,
      plan: JSON.parse(JSON.stringify(planToSave)) as YoutubePlaywrightPlanDocument,
    };

    const nextPresets = [nextPreset, ...youtubeEndScreenPresets];
    persistYoutubeEndScreenPresets(nextPresets);
    setSelectedYoutubeEndScreenPresetId(nextPreset.id);
    setYoutubeEndScreenPresetNameInput('');
    setToast({
      severity: 'success',
      message: `Preset mémorisé: ${nextPreset.name}`,
    });
  }, [
    latestYoutubePlaywrightPlan,
    persistYoutubeEndScreenPresets,
    youtubeEndScreenPresetNameInput,
    youtubeEndScreenPresets,
    youtubeEndScreenWizardPlan,
  ]);

  const handleDeleteSelectedYoutubeEndScreenPreset = useCallback(() => {
    if (!selectedYoutubeEndScreenPreset) {
      return;
    }
    const nextPresets = youtubeEndScreenPresets.filter(
      (preset) => preset.id !== selectedYoutubeEndScreenPreset.id
    );
    persistYoutubeEndScreenPresets(nextPresets);
    setSelectedYoutubeEndScreenPresetId('');
    setToast({
      severity: 'success',
      message: `Preset supprimé: ${selectedYoutubeEndScreenPreset.name}`,
    });
  }, [persistYoutubeEndScreenPresets, selectedYoutubeEndScreenPreset, youtubeEndScreenPresets]);

  const handleSelectYoutubeEndScreenPreset = useCallback((value: string) => {
    setSelectedYoutubeEndScreenPresetId(value === '__latest__' ? '' : value);
    setYoutubeEndScreenWizardIndex(0);
    setYoutubeEndScreenWizardCompletedSourceIds([]);
  }, []);

  const youtubeEndScreenWizardCurrentStep =
    youtubeEndScreenWizardStepCount > 0
      ? youtubeEndScreenWizardSteps[
          Math.min(youtubeEndScreenWizardIndex, Math.max(0, youtubeEndScreenWizardStepCount - 1))
        ]
      : null;

  const youtubeEndScreenWizardCompletedCount = useMemo(() => {
    if (youtubeEndScreenWizardStepCount === 0) {
      return 0;
    }
    const validSourceIds = new Set(youtubeEndScreenWizardSteps.map((step) => step.sourceNodeId));
    return youtubeEndScreenWizardCompletedSourceIds.filter((sourceId) => validSourceIds.has(sourceId))
      .length;
  }, [youtubeEndScreenWizardCompletedSourceIds, youtubeEndScreenWizardStepCount, youtubeEndScreenWizardSteps]);

  const youtubeEndScreenWizardCurrentStepCompleted = Boolean(
    youtubeEndScreenWizardCurrentStep &&
      youtubeEndScreenWizardCompletedSourceIds.includes(youtubeEndScreenWizardCurrentStep.sourceNodeId)
  );
  const youtubeEndScreenWizardIsLastStep =
    youtubeEndScreenWizardStepCount > 0 && youtubeEndScreenWizardIndex >= youtubeEndScreenWizardStepCount - 1;

  useEffect(() => {
    if (youtubeEndScreenWizardStepCount === 0) {
      setYoutubeEndScreenWizardIndex(0);
      setYoutubeEndScreenWizardCompletedSourceIds([]);
      return;
    }

    setYoutubeEndScreenWizardIndex((previousIndex) =>
      Math.min(previousIndex, youtubeEndScreenWizardStepCount - 1)
    );

    const validSourceIds = new Set(youtubeEndScreenWizardSteps.map((step) => step.sourceNodeId));
    setYoutubeEndScreenWizardCompletedSourceIds((previousIds) =>
      previousIds.filter((sourceId) => validSourceIds.has(sourceId))
    );
  }, [youtubeEndScreenWizardStepCount, youtubeEndScreenWizardSteps]);

  const handleOpenYoutubeEndScreenWizardSource = useCallback(() => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    const sourceUrl = currentStep?.sourceStudioUrl || currentStep?.sourceUrl;
    if (!sourceUrl) {
      setToast({
        severity: 'info',
        message: 'Lien source YouTube Studio indisponible pour cette étape.',
      });
      return;
    }
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  }, [youtubeEndScreenWizardCurrentStep]);

  const handleOpenYoutubeEndScreenWizardTarget = useCallback((target: YoutubePlaywrightPlanTarget) => {
    const targetUrl = target.targetStudioUrl || target.targetUrl;
    if (!targetUrl) {
      setToast({
        severity: 'info',
        message: `Lien indisponible pour ${target.targetLabel || 'la cible'}.`,
      });
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleOpenYoutubeEndScreenWizardAllTargets = useCallback(() => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    if (!currentStep || currentStep.targets.length === 0) {
      setToast({
        severity: 'info',
        message: 'Aucune cible disponible pour cette étape.',
      });
      return;
    }

    const openedUrls = new Set<string>();
    currentStep.targets.forEach((target) => {
      const targetUrl = target.targetStudioUrl || target.targetUrl;
      if (!targetUrl || openedUrls.has(targetUrl)) {
        return;
      }
      openedUrls.add(targetUrl);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    });

    if (openedUrls.size === 0) {
      setToast({
        severity: 'info',
        message: 'Aucun lien cible exploitable pour cette étape.',
      });
      return;
    }

    setToast({
      severity: 'success',
      message: `${openedUrls.size} lien(s) cible(s) ouvert(s).`,
    });
  }, [youtubeEndScreenWizardCurrentStep]);

  const handleCopyYoutubeEndScreenWizardAllTargetVideoIds = useCallback(async () => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    const ids = currentStep?.targets
      .map((target) => (target.targetVideoId || '').trim())
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

    if (!ids || ids.length === 0) {
      setToast({
        severity: 'info',
        message: 'Aucun ID vidéo cible à copier sur cette étape.',
      });
      return;
    }

    const payload = ids.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error('Clipboard API indisponible');
      }
      setToast({
        severity: 'success',
        message: `${ids.length} ID(s) vidéo copié(s).`,
      });
    } catch {
      setToast({
        severity: 'info',
        message: `Copie automatique impossible. IDs: ${payload}`,
      });
    }
  }, [youtubeEndScreenWizardCurrentStep]);

  const handleCopyYoutubeEndScreenWizardAllTargetLinks = useCallback(async () => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    const links = currentStep?.targets
      .map((target) => target.targetStudioUrl || target.targetUrl || '')
      .map((value) => value.trim())
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

    if (!links || links.length === 0) {
      setToast({
        severity: 'info',
        message: 'Aucun lien cible à copier sur cette étape.',
      });
      return;
    }

    const payload = links.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error('Clipboard API indisponible');
      }
      setToast({
        severity: 'success',
        message: `${links.length} lien(s) cible(s) copié(s).`,
      });
    } catch {
      setToast({
        severity: 'info',
        message: `Copie automatique impossible. Liens: ${payload}`,
      });
    }
  }, [youtubeEndScreenWizardCurrentStep]);

  const handleCopyYoutubeEndScreenWizardTargetVideoId = useCallback(
    async (target: YoutubePlaywrightPlanTarget) => {
      const videoId = target.targetVideoId ? target.targetVideoId.trim() : '';
      if (!videoId) {
        setToast({
          severity: 'info',
          message: `ID vidéo indisponible pour ${target.targetLabel || 'la cible'}.`,
        });
        return;
      }

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(videoId);
        } else {
          throw new Error('Clipboard API indisponible');
        }
        setToast({
          severity: 'success',
          message: `ID vidéo copié: ${videoId}`,
        });
      } catch {
        setToast({
          severity: 'info',
          message: `Copie automatique impossible. ID: ${videoId}`,
        });
      }
    },
    []
  );

  const handleYoutubeEndScreenWizardPreviousStep = useCallback(() => {
    setYoutubeEndScreenWizardIndex((previousIndex) => Math.max(0, previousIndex - 1));
  }, []);

  const handleYoutubeEndScreenWizardNextStep = useCallback(() => {
    setYoutubeEndScreenWizardIndex((previousIndex) =>
      Math.min(previousIndex + 1, Math.max(0, youtubeEndScreenWizardStepCount - 1))
    );
  }, [youtubeEndScreenWizardStepCount]);

  const handleYoutubeEndScreenWizardToggleCurrentStepCompleted = useCallback(() => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    if (!currentStep) {
      return;
    }
    const sourceNodeId = currentStep.sourceNodeId;
    setYoutubeEndScreenWizardCompletedSourceIds((previousIds) =>
      previousIds.includes(sourceNodeId)
        ? previousIds.filter((existingId) => existingId !== sourceNodeId)
        : [...previousIds, sourceNodeId]
    );
  }, [youtubeEndScreenWizardCurrentStep]);

  const handleYoutubeEndScreenWizardCompleteAndNext = useCallback(() => {
    const currentStep = youtubeEndScreenWizardCurrentStep;
    if (!currentStep) {
      return;
    }
    const isLastStep = youtubeEndScreenWizardIndex >= youtubeEndScreenWizardStepCount - 1;
    const sourceNodeId = currentStep.sourceNodeId;
    setYoutubeEndScreenWizardCompletedSourceIds((previousIds) =>
      previousIds.includes(sourceNodeId) ? previousIds : [...previousIds, sourceNodeId]
    );
    if (isLastStep) {
      setToast({
        severity: 'success',
        message: 'Assistant End Screens: toutes les sources sont validées.',
      });
      return;
    }
    setYoutubeEndScreenWizardIndex((previousIndex) => Math.min(previousIndex + 1, youtubeEndScreenWizardStepCount - 1));
  }, [youtubeEndScreenWizardCurrentStep, youtubeEndScreenWizardIndex, youtubeEndScreenWizardStepCount]);

  const waitForYoutubeUploadJob = useCallback(async (jobId: string) => {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      throw new Error('Job YouTube invalide');
    }

    const maxAttempts = 240;
    const pollDelayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`/api/youtube/upload/jobs/${encodeURIComponent(normalizedJobId)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as YoutubeUploadJobResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Suivi du job YouTube impossible');
      }

      if (payload.status === 'completed') {
        return payload.result || {};
      }

      if (payload.status === 'failed') {
        throw new Error(payload.error || 'Upload YouTube impossible');
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, pollDelayMs);
      });
    }

    throw new Error('Timeout: le job YouTube a dépassé le délai');
  }, []);

  const buildYoutubeExportSignature = useCallback(
    (scenarioPayload: { nodes: CustomNode[]; edges: CustomEdge[] }, tags: string[]): string =>
      createYoutubeExportSignature({
        projectId: projectId || null,
        title: youtubeTitle.trim() || projectName || 'Export interactif',
        description: youtubeDescription.trim(),
        privacyStatus: youtubePrivacyStatus,
        tags,
        includeCompanionCta: youtubeIncludeCompanionCta,
        companionCtaText: youtubeCompanionCtaText.trim(),
        scenario: scenarioPayload,
      }),
    [
      projectId,
      youtubeTitle,
      projectName,
      youtubeDescription,
      youtubePrivacyStatus,
      youtubeIncludeCompanionCta,
      youtubeCompanionCtaText,
    ]
  );

  const publishTrackedInteractiveCompanionLink = useCallback(
    async (scenarioPayload: { nodes: CustomNode[]; edges: CustomEdge[] }) => {
      const scenarioTitle = youtubeTitle.trim() || projectName || 'Expérience interactive';
      const scenarioDescription = youtubeDescription.trim();

      try {
        const published = await publishService.publishScenarioLink({
          projectId,
          title: scenarioTitle,
          description: scenarioDescription,
          nodes: scenarioPayload.nodes,
          edges: scenarioPayload.edges,
        });
        const trackedCompanionUrl = (() => {
          try {
            const url = new URL(published.url);
            url.searchParams.set('src', 'youtube');
            url.searchParams.set('utm_source', 'youtube');
            url.searchParams.set('utm_medium', 'video');
            url.searchParams.set('utm_campaign', 'interactive_export');
            if (projectId) {
              url.searchParams.set('projectId', projectId);
            }
            return url.toString();
          } catch {
            return published.url;
          }
        })();

        const companionLine = `Version interactive: ${trackedCompanionUrl}`;
        const descriptionWithCompanion = scenarioDescription
          ? `${companionLine}\n\n${scenarioDescription}`
          : companionLine;

        return {
          interactiveCompanionUrl: trackedCompanionUrl,
          youtubeDescriptionWithCompanion: descriptionWithCompanion,
        };
      } catch (error) {
        console.warn('Publication du lien interactif impossible:', error);
        return {
          interactiveCompanionUrl: null,
          youtubeDescriptionWithCompanion: scenarioDescription,
        };
      }
    },
    [projectId, projectName, youtubeDescription, youtubeTitle]
  );

  const buildYoutubeEndScreenPlanFromExistingVideos = useCallback(
    (uploadedVideos: YoutubeUploadedVideo[]): YoutubeEndScreenPlanItem[] => {
      const startVideoNodeId = findStartVideoNodeId();
      if (!startVideoNodeId || !Array.isArray(uploadedVideos) || uploadedVideos.length === 0) {
        return [];
      }

      const videosByNodeId = new Map<string, YoutubeUploadedVideo>();
      uploadedVideos.forEach((video) => {
        const nodeId = typeof video.nodeId === 'string' ? video.nodeId.trim() : '';
        const kind = typeof video.kind === 'string' ? video.kind : 'main';
        if (!nodeId || kind !== 'main') {
          return;
        }
        const hasAnyLink = Boolean(
          (typeof video.id === 'string' && video.id.trim()) ||
            (typeof video.url === 'string' && video.url.trim()) ||
            (typeof video.studioUrl === 'string' && video.studioUrl.trim())
        );
        if (hasAnyLink) {
          videosByNodeId.set(nodeId, video);
        }
      });

      if (videosByNodeId.size === 0) {
        return [];
      }

      const resolveVideoId = (video: YoutubeUploadedVideo): string | null =>
        sanitizeYoutubeVideoId(video.id || '') ||
        extractYoutubeVideoId(video.url || null) ||
        extractYoutubeVideoId(video.studioUrl || null) ||
        null;

      const queue = [startVideoNodeId];
      const queued = new Set<string>([startVideoNodeId]);
      const visited = new Set<string>();
      const maxVisits = 512;
      const plan: YoutubeEndScreenPlanItem[] = [];

      while (queue.length > 0 && visited.size < maxVisits) {
        const sourceNodeId = queue.shift() as string;
        queued.delete(sourceNodeId);
        if (visited.has(sourceNodeId)) {
          continue;
        }
        visited.add(sourceNodeId);

        const transitions = buildPlaybackTransitions(sourceNodeId);
        const rawTargets: Array<{ targetNodeId: string; label?: string }> = [];

        transitions.menuOptions.forEach((option) => {
          const targetNodeId = option.targetVideoNodeId?.trim();
          if (!targetNodeId) {
            return;
          }
          rawTargets.push({
            targetNodeId,
            label: option.label,
          });
          if (!visited.has(targetNodeId) && !queued.has(targetNodeId)) {
            queue.push(targetNodeId);
            queued.add(targetNodeId);
          }
        });

        const autoNextVideoId = transitions.autoNextVideoId?.trim();
        if (autoNextVideoId) {
          rawTargets.push({ targetNodeId: autoNextVideoId });
          if (!visited.has(autoNextVideoId) && !queued.has(autoNextVideoId)) {
            queue.push(autoNextVideoId);
            queued.add(autoNextVideoId);
          }
        }

        const sourceVideo = videosByNodeId.get(sourceNodeId);
        if (!sourceVideo) {
          continue;
        }

        const uniqueTargetIds = new Set<string>();
        const targets: YoutubeEndScreenTarget[] = [];
        rawTargets.forEach((target) => {
          const targetNodeId = target.targetNodeId.trim();
          if (!targetNodeId || targetNodeId === sourceNodeId || uniqueTargetIds.has(targetNodeId)) {
            return;
          }
          uniqueTargetIds.add(targetNodeId);

          const targetVideo = videosByNodeId.get(targetNodeId);
          if (!targetVideo) {
            return;
          }

          const targetNode = graph.nodeById.get(targetNodeId);
          const targetVideoData =
            targetNode?.type === 'video' ? (targetNode.data as VideoNodeData) : undefined;
          const targetLabel =
            target.label?.trim() ||
            targetVideoData?.label ||
            targetVideo.title ||
            targetNodeId;

          targets.push({
            targetNodeId,
            targetLabel,
            targetVideoId: resolveVideoId(targetVideo),
            targetUrl: targetVideo.url || null,
            targetStudioUrl: targetVideo.studioUrl || null,
          });
        });

        if (targets.length === 0) {
          continue;
        }

        const sourceNode = graph.nodeById.get(sourceNodeId);
        const sourceVideoData = sourceNode?.type === 'video' ? (sourceNode.data as VideoNodeData) : undefined;
        const sourceLabel = sourceVideoData?.label || sourceVideo.title || sourceNodeId;

        plan.push({
          sourceNodeId,
          sourceLabel,
          sourceVideoId: resolveVideoId(sourceVideo),
          sourceUrl: sourceVideo.url || null,
          sourceStudioUrl: sourceVideo.studioUrl || null,
          recommendedStartFromEndSeconds: 20,
          totalTargets: targets.length,
          targets: targets.slice(0, 4),
        });
      }

      return plan;
    },
    [findStartVideoNodeId, buildPlaybackTransitions, graph]
  );

  const handleYoutubeScenarioOnlyUpdate = useCallback(async () => {
    if (isYoutubeExporting || isYoutubeScenarioSyncing) {
      return;
    }

    if (!lastYoutubeExportLink || !Array.isArray(lastYoutubeExportLink.videos) || lastYoutubeExportLink.videos.length === 0) {
      setToast({
        severity: 'error',
        message: 'Aucun export YouTube existant: lance un premier upload média avant la mise à jour scénario.',
      });
      return;
    }

    const hasPlayableVideo = (nodes as unknown as CustomNode[]).some((node) => {
      if (node.type !== 'video') {
        return false;
      }
      const data = node.data as VideoNodeData;
      return Boolean(data.videoUrl && data.videoUrl.trim());
    });
    if (!hasPlayableVideo) {
      setToast({ severity: 'error', message: 'Ajoutez au moins une vidéo avant mise à jour du scénario.' });
      return;
    }

    const tags = youtubeTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const scenarioPayload = JSON.parse(JSON.stringify({ nodes, edges })) as {
      nodes: CustomNode[];
      edges: CustomEdge[];
    };
    const exportSignature = buildYoutubeExportSignature(scenarioPayload, tags);
    const nextEndScreenPlan = buildYoutubeEndScreenPlanFromExistingVideos(lastYoutubeExportLink.videos);

    if (nextEndScreenPlan.length === 0) {
      setToast({
        severity: 'error',
        message:
          'Impossible de générer le plan End Screens avec les médias déjà exportés (vérifie les liens nodeId).',
      });
      return;
    }

    setIsYoutubeScenarioSyncing(true);
    try {
      const { interactiveCompanionUrl } = await publishTrackedInteractiveCompanionLink(scenarioPayload);
      const scenarioTitle = youtubeTitle.trim() || projectName || lastYoutubeExportLink.title || 'Export interactif';
      const nextLastYoutubeExportLink: LastYoutubeExportLink = {
        ...lastYoutubeExportLink,
        title: scenarioTitle,
        uploadedAt: new Date().toISOString(),
        endScreenPlan: nextEndScreenPlan,
      };

      setLastYoutubeExportLink(nextLastYoutubeExportLink);
      setLastYoutubeExportSignature(exportSignature);
      writeYoutubeExportCacheEntry({
        signature: exportSignature,
        lastExportLink: nextLastYoutubeExportLink,
        updatedAt: new Date().toISOString(),
      });
      setIsForceYoutubeReexport(false);

      setToast({
        severity: 'success',
        message: `Scénario YouTube mis à jour sans réupload média • ${nextEndScreenPlan.length} source(s) End Screens prête(s)${
          interactiveCompanionUrl ? ' • lien interactif republié' : ''
        }.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Mise à jour du scénario YouTube impossible';
      setToast({ severity: 'error', message });
    } finally {
      setIsYoutubeScenarioSyncing(false);
    }
  }, [
    isYoutubeExporting,
    isYoutubeScenarioSyncing,
    lastYoutubeExportLink,
    nodes,
    edges,
    youtubeTagsInput,
    buildYoutubeExportSignature,
    buildYoutubeEndScreenPlanFromExistingVideos,
    publishTrackedInteractiveCompanionLink,
    youtubeTitle,
    projectName,
    writeYoutubeExportCacheEntry,
  ]);

  const handleYoutubeExport = useCallback(async () => {
    if (isYoutubeExporting || isYoutubeScenarioSyncing) {
      return;
    }

    const hasPlayableVideo = (nodes as unknown as CustomNode[]).some((node) => {
      if (node.type !== 'video') {
        return false;
      }
      const data = node.data as VideoNodeData;
      return Boolean(data.videoUrl && data.videoUrl.trim());
    });

    if (!hasPlayableVideo) {
      setToast({ severity: 'error', message: 'Ajoutez au moins une vidéo avant export YouTube.' });
      return;
    }

    const status = youtubeAuthStatus ?? (await refreshYoutubeAuthStatus());
    if (!status.configured) {
      setToast({
        severity: 'error',
        message:
          status.error ||
          'Configuration YouTube manquante sur le serveur (client id/secret/redirect URI).',
      });
      return;
    }

    if (!status.connected) {
      setToast({
        severity: 'error',
        message:
          status.error ||
          'Compte YouTube non connecté. Utilisez le bouton Connexion YouTube.',
      });
      return;
    }

    const tags = youtubeTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const scenarioPayload = JSON.parse(JSON.stringify({ nodes, edges })) as {
      nodes: CustomNode[];
      edges: CustomEdge[];
    };
    const exportSignature = buildYoutubeExportSignature(scenarioPayload, tags);
    const cachedEntry = readYoutubeExportCacheEntry();
    const canReuseExport =
      !isForceYoutubeReexport &&
      ((Boolean(lastYoutubeExportLink) && lastYoutubeExportSignature === exportSignature) ||
        (Boolean(cachedEntry) && cachedEntry?.signature === exportSignature));

    if (canReuseExport) {
      const reusedExportLink =
        (lastYoutubeExportSignature === exportSignature ? lastYoutubeExportLink : null) ||
        cachedEntry?.lastExportLink ||
        null;
      if (reusedExportLink) {
        setLastYoutubeExportSignature(exportSignature);
        setLastYoutubeExportLink(reusedExportLink);
        setToast({
          severity: 'info',
          message: 'Réexport évité: configuration identique, liens YouTube existants réutilisés.',
        });
        setIsYoutubeDialogOpen(false);

        const primaryVideo =
          reusedExportLink.videos.find((video) => video.kind === 'main') ||
          reusedExportLink.videos[0] ||
          null;
        const destinationUrl =
          primaryVideo?.studioUrl || primaryVideo?.url || reusedExportLink.studioUrl || reusedExportLink.url;
        if (destinationUrl) {
          window.open(destinationUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }
    }

    setIsYoutubeExporting(true);
    try {
      const { interactiveCompanionUrl, youtubeDescriptionWithCompanion } =
        await publishTrackedInteractiveCompanionLink(scenarioPayload);

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: scenarioPayload,
          title: youtubeTitle.trim() || projectName || 'Export interactif',
          description: youtubeDescriptionWithCompanion,
          privacyStatus: youtubePrivacyStatus,
          tags,
          companionUrl: interactiveCompanionUrl,
          includeCompanionCta: youtubeIncludeCompanionCta,
          companionCtaText: youtubeCompanionCtaText.trim(),
        }),
      });

      const payload = (await response.json()) as
        | (YoutubeUploadJobResponse & YoutubeUploadResponse & { error?: string })
        | undefined;
      if (!response.ok) {
        throw new Error(payload?.error || 'Export YouTube impossible');
      }

      let uploadResult: YoutubeUploadResponse = payload || {};
      if (payload?.jobId) {
        setToast({
          severity: 'info',
          message: 'Upload YouTube lancé. Traitement en cours...',
        });
        uploadResult = await waitForYoutubeUploadJob(payload.jobId);
      }

      const visibilityLabel =
        uploadResult.privacyStatus === 'public'
          ? 'Publique'
          : uploadResult.privacyStatus === 'private'
            ? 'Privée'
            : 'Non répertoriée';
      const channelLabel =
        uploadResult.channelTitle || youtubeAuthStatus?.channelTitle || 'Chaîne connectée';
      const uploadedVideos =
        Array.isArray(uploadResult.videos) && uploadResult.videos.length > 0
          ? uploadResult.videos
          : [
              {
                kind: 'main',
                id: uploadResult.id,
                title: uploadResult.title,
                url: uploadResult.url,
                studioUrl: uploadResult.studioUrl,
                nodeId: null,
              },
            ];
      const endScreenPlan = Array.isArray(uploadResult.endScreenPlan)
        ? uploadResult.endScreenPlan
        : [];
      const uploadedVideoCount = uploadedVideos.length;
      const requestedUploads =
        typeof uploadResult.requestedUploads === 'number' && Number.isFinite(uploadResult.requestedUploads)
          ? uploadResult.requestedUploads
          : uploadedVideoCount;
      const completedUploads =
        typeof uploadResult.completedUploads === 'number' && Number.isFinite(uploadResult.completedUploads)
          ? uploadResult.completedUploads
          : uploadedVideoCount;
      const partialUpload =
        Boolean(uploadResult.partialUpload) || (requestedUploads > 0 && completedUploads < requestedUploads);
      const uploadWarnings =
        Array.isArray(uploadResult.uploadWarnings) && uploadResult.uploadWarnings.length > 0
          ? uploadResult.uploadWarnings.filter((warning) => typeof warning === 'string' && warning.trim())
          : [];
      const interactiveSuffix = interactiveCompanionUrl ? ' • lien interactif ajouté à la description' : '';
      const ctaSuffix =
        interactiveCompanionUrl && uploadResult.companionVideo
          ? uploadResult.companionCtaMode === 'qr_only'
            ? ' • vidéo CTA de fin créée (mode QR léger)'
            : ' • vidéo CTA de fin créée (cartouche + QR + bouton)'
          : '';
      const ctaWarningSuffix =
        interactiveCompanionUrl && youtubeIncludeCompanionCta && !uploadResult.companionVideo
          ? ` • vidéo CTA non créée (${uploadResult.companionVideoUploadError || 'upload principal conservé'})`
          : '';
      const multiVideoSuffix = uploadedVideoCount > 1 ? ` • ${uploadedVideoCount} vidéos exportées` : '';
      const partialUploadSuffix = partialUpload
        ? ` • export partiel (${completedUploads}/${requestedUploads} vidéo(s) envoyée(s))`
        : '';
      const warningSuffix = uploadWarnings.length > 0 ? ` • ${uploadWarnings.join(' • ')}` : '';
      const endScreenSuffix =
        endScreenPlan.length > 0
          ? ` • plan écrans de fin prêt (${endScreenPlan.length} vidéo(s) source)`
          : '';

      setToast({
        severity: partialUpload ? 'info' : 'success',
        message: `${partialUpload ? 'Upload YouTube partiel' : 'Upload YouTube terminé'} sur ${channelLabel} (${visibilityLabel})${uploadResult.segments ? ` • ${uploadResult.segments} segment(s)` : ''}${multiVideoSuffix}${partialUploadSuffix}${interactiveSuffix}${ctaSuffix}${ctaWarningSuffix}${endScreenSuffix}${warningSuffix}.`,
      });
      const primaryVideo =
        uploadedVideos.find((video) => video.kind === 'main') || uploadedVideos[0] || null;
      const nextLastYoutubeExportLink: LastYoutubeExportLink = {
        url: primaryVideo?.url || uploadResult.url || null,
        studioUrl: primaryVideo?.studioUrl || uploadResult.studioUrl || null,
        title: uploadResult.title || youtubeTitle.trim() || projectName || 'Export interactif',
        channelTitle: channelLabel,
        visibilityLabel,
        uploadedAt: new Date().toISOString(),
        videos: uploadedVideos,
        endScreenPlan,
      };
      setLastYoutubeExportLink(nextLastYoutubeExportLink);
      setLastYoutubeExportSignature(exportSignature);
      writeYoutubeExportCacheEntry({
        signature: exportSignature,
        lastExportLink: nextLastYoutubeExportLink,
        updatedAt: new Date().toISOString(),
      });
      setIsForceYoutubeReexport(false);
      setIsYoutubeDialogOpen(false);

      const destinationUrl =
        primaryVideo?.studioUrl || primaryVideo?.url || uploadResult.studioUrl || uploadResult.url;
      if (destinationUrl) {
        window.open(destinationUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export YouTube impossible';
      setToast({ severity: 'error', message });
    } finally {
      setIsYoutubeExporting(false);
    }
  }, [
    isYoutubeExporting,
    isYoutubeScenarioSyncing,
    nodes,
    edges,
    youtubeAuthStatus,
    refreshYoutubeAuthStatus,
    youtubeTitle,
    youtubeTagsInput,
    projectName,
    youtubePrivacyStatus,
    youtubeIncludeCompanionCta,
    youtubeCompanionCtaText,
    isForceYoutubeReexport,
    lastYoutubeExportLink,
    lastYoutubeExportSignature,
    readYoutubeExportCacheEntry,
    writeYoutubeExportCacheEntry,
    buildYoutubeExportSignature,
    publishTrackedInteractiveCompanionLink,
    waitForYoutubeUploadJob,
  ]);

  const togglePlaybackMode = useCallback(() => {
    if (isPlaybackMode) {
      endPlaybackSession('manual_toggle');
      setIsPlaybackMode(false);
      setActiveVideoNodeId(null);
      setPlaybackMenuOptions([]);
      setPlaybackIsPlaying(false);
      clearPlaybackPendingSeek();
      return;
    }

    const startVideoNodeId = findStartVideoNodeId();
    if (!startVideoNodeId) {
      return;
    }

    setActiveVideoNodeId(startVideoNodeId);
    setPlaybackMenuOptions([]);
    setPlaybackIsPlaying(true);
    clearPlaybackPendingSeek();
    playbackOutReachedRef.current = false;
    playbackTransitionHandledRef.current = false;
    setPlaybackPlayerKey((previous) => previous + 1);
    startPlaybackSession();
    void requestFullscreen(document.documentElement as FullscreenElement).catch((error) => {
      console.warn('Fullscreen request failed:', error);
    });
    setIsPlaybackMode(true);
  }, [
    isPlaybackMode,
    findStartVideoNodeId,
    startPlaybackSession,
    endPlaybackSession,
    clearPlaybackPendingSeek,
    requestFullscreen,
  ]);

  const hasSelection = useMemo(
    () =>
      (nodes as unknown as CustomNode[]).some((node) => node.selected) ||
      edges.some((edge) => edge.selected),
    [nodes, edges]
  );

  const handleRecenterCanvas = useCallback(() => {
    if (!reactFlowInstance) {
      return;
    }

    reactFlowInstance.fitView({
      padding: 0.2,
      minZoom: 0.02,
      includeHiddenNodes: true,
      duration: 220,
    });
  }, [reactFlowInstance]);

  const renderPlaybackOverlay = () => {
    if (!isPlaybackMode || !activeVideoData?.videoUrl) {
      return null;
    }

    const resolveResponsivePlaybackStyle = (
      style: ButtonNodeData['style']
    ): NonNullable<ButtonNodeData['style']> => {
      const positionMode = isMobileViewport
        ? style?.mobilePositionMode ||
          style?.positionMode ||
          defaultButtonStyle.mobilePositionMode ||
          defaultButtonStyle.positionMode ||
          'flow'
        : style?.positionMode || defaultButtonStyle.positionMode || 'flow';
      const horizontalAlign = isMobileViewport
        ? style?.mobileHorizontalAlign ||
          style?.horizontalAlign ||
          defaultButtonStyle.mobileHorizontalAlign ||
          defaultButtonStyle.horizontalAlign ||
          'center'
        : style?.horizontalAlign || defaultButtonStyle.horizontalAlign || 'center';
      const verticalAlign = isMobileViewport
        ? style?.mobileVerticalAlign ||
          style?.verticalAlign ||
          defaultButtonStyle.mobileVerticalAlign ||
          defaultButtonStyle.verticalAlign ||
          'bottom'
        : style?.verticalAlign || defaultButtonStyle.verticalAlign || 'bottom';

      const rawPositionX = isMobileViewport
        ? style?.mobilePositionX ?? style?.positionX ?? defaultButtonStyle.mobilePositionX ?? 16
        : style?.positionX ?? defaultButtonStyle.positionX ?? 24;
      const rawPositionY = isMobileViewport
        ? style?.mobilePositionY ?? style?.positionY ?? defaultButtonStyle.mobilePositionY ?? 16
        : style?.positionY ?? defaultButtonStyle.positionY ?? 24;

      const positionX = Number.isFinite(Number(rawPositionX)) ? Number(rawPositionX) : 0;
      const positionY = Number.isFinite(Number(rawPositionY)) ? Number(rawPositionY) : 0;

      return {
        ...defaultButtonStyle,
        ...(style || {}),
        positionMode,
        horizontalAlign,
        verticalAlign,
        positionX,
        positionY,
      };
    };

    const playbackMenuOptionsWithResolvedStyle = playbackMenuOptions.map((option) => ({
      ...option,
      resolvedStyle: resolveResponsivePlaybackStyle(option.style),
    }));

    const flowPlaybackMenuOptions = playbackMenuOptionsWithResolvedStyle.filter(
      (option) => option.resolvedStyle.positionMode !== 'absolute'
    );
    const absolutePlaybackMenuOptions = playbackMenuOptionsWithResolvedStyle.filter(
      (option) => option.resolvedStyle.positionMode === 'absolute'
    );

    const getPlaybackButtonSx = (
      option: PlaybackMenuOption & { resolvedStyle: NonNullable<ButtonNodeData['style']> }
    ) => {
      const size = option.size || 'medium';
      const preset = buttonSizePresets[size];
      const usesCustomFontSize = Boolean(
        option.resolvedStyle.fontSize &&
          option.resolvedStyle.fontSize !== defaultButtonStyle.fontSize
      );
      const usesCustomPadding = Boolean(
        option.resolvedStyle.padding && option.resolvedStyle.padding !== defaultButtonStyle.padding
      );

      return {
        backgroundColor: option.resolvedStyle.backgroundColor || defaultButtonStyle.backgroundColor,
        color: option.resolvedStyle.textColor || defaultButtonStyle.textColor,
        borderRadius: option.resolvedStyle.borderRadius || defaultButtonStyle.borderRadius,
        fontSize: usesCustomFontSize ? option.resolvedStyle.fontSize : preset.fontSize,
        borderStyle: option.resolvedStyle.borderStyle || defaultButtonStyle.borderStyle,
        borderColor: option.resolvedStyle.borderColor || defaultButtonStyle.borderColor,
        borderWidth: option.resolvedStyle.borderWidth || defaultButtonStyle.borderWidth,
        boxShadow: option.resolvedStyle.boxShadow || defaultButtonStyle.boxShadow,
        padding: usesCustomPadding ? option.resolvedStyle.padding : preset.padding,
        textAlign: option.resolvedStyle.textAlign || defaultButtonStyle.textAlign,
        transition: option.resolvedStyle.transition || defaultButtonStyle.transition,
        minWidth: preset.minWidth,
        '&:hover': {
          backgroundColor:
            option.resolvedStyle.hoverBackgroundColor || defaultButtonStyle.hoverBackgroundColor,
          color: option.resolvedStyle.hoverTextColor || defaultButtonStyle.hoverTextColor,
          transform: `scale(${option.resolvedStyle.hoverScale || defaultButtonStyle.hoverScale})`,
        },
      };
    };

    const getAbsoluteButtonPositionSx = (
      style: NonNullable<ButtonNodeData['style']>
    ): Record<string, string | number> => {
      const horizontalAlign = style.horizontalAlign || defaultButtonStyle.horizontalAlign || 'center';
      const verticalAlign = style.verticalAlign || defaultButtonStyle.verticalAlign || 'bottom';

      const rawX = Number(style.positionX ?? defaultButtonStyle.positionX ?? 24);
      const rawY = Number(style.positionY ?? defaultButtonStyle.positionY ?? 24);
      const positionX = Number.isFinite(rawX) ? rawX : 24;
      const positionY = Number.isFinite(rawY) ? rawY : 24;

      const positionStyles: Record<string, string | number> = {
        position: 'absolute',
      };

      const transforms: string[] = [];

      if (horizontalAlign === 'left') {
        positionStyles.left = `${positionX}px`;
      } else if (horizontalAlign === 'center') {
        positionStyles.left = '50%';
        transforms.push('translateX(-50%)');
        if (positionX !== 0) {
          transforms.push(`translateX(${positionX}px)`);
        }
      } else {
        positionStyles.right = `${positionX}px`;
      }

      if (verticalAlign === 'top') {
        positionStyles.top = `${positionY}px`;
      } else if (verticalAlign === 'center') {
        positionStyles.top = '50%';
        transforms.push('translateY(-50%)');
        if (positionY !== 0) {
          transforms.push(`translateY(${positionY}px)`);
        }
      } else {
        positionStyles.bottom = `${positionY}px`;
      }

      if (transforms.length > 0) {
        positionStyles.transform = transforms.join(' ');
      }

      return positionStyles;
    };

    return (
      <Box
        ref={playbackContainerRef}
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'black',
          zIndex: 1400,
        }}
      >
        <ReactPlayer
          ref={(player) => {
            playbackPlayerRef.current = player;
          }}
          key={`playback-${playbackPlayerKey}-${activeVideoNodeId}`}
          url={activeVideoData.videoUrl}
          width="100%"
          height="100%"
          playing={playbackIsPlaying}
          controls={false}
          onReady={handlePlaybackReady}
          onSeek={handlePlaybackSeek}
          onProgress={handlePlaybackProgress}
          progressInterval={500}
          onEnded={handlePlaybackEnded}
          onError={handlePlaybackError}
          config={{
            youtube: {
              playerVars: {
                controls: 0,
                fs: 0,
                rel: 0,
                playsinline: 1,
                disablekb: 1,
                modestbranding: 1,
                iv_load_policy: 3,
                ...(activeMediaIn > 0 ? { start: Math.floor(activeMediaIn) } : {}),
                ...(activeMediaOut ? { end: Math.floor(activeMediaOut) } : {}),
              },
            },
            file: {
              attributes: {
                controlsList: 'nodownload nofullscreen noplaybackrate',
                playsInline: true,
                preload: 'auto',
              },
            },
          }}
        />

        {absolutePlaybackMenuOptions.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {absolutePlaybackMenuOptions.map((option) => {
              const size = option.size || 'medium';
              return (
                <Button
                  key={option.id}
                  variant={option.variant || 'contained'}
                  size={size}
                  onClick={() => handlePlaybackMenuChoice(option)}
                  sx={{
                    ...getPlaybackButtonSx(option),
                    ...getAbsoluteButtonPositionSx(option.resolvedStyle),
                    pointerEvents: 'auto',
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </Box>
        )}

        {flowPlaybackMenuOptions.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              p: 3,
              display: 'flex',
              justifyContent: 'center',
              bgcolor: 'rgba(0, 0, 0, 0.65)',
            }}
          >
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {flowPlaybackMenuOptions.map((option) => {
                const size = option.size || 'medium';
                return (
                <Button
                  key={option.id}
                  variant={option.variant || 'contained'}
                  size={size}
                  onClick={() => handlePlaybackMenuChoice(option)}
                  sx={getPlaybackButtonSx(option)}
                >
                  {option.label}
                </Button>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => {
              void handleBackToLibrary();
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            Éditeur de scénario
          </Typography>
          <Tooltip title="Annuler (Ctrl/Cmd+Z)">
            <span>
              <IconButton
                color="inherit"
                onClick={handleUndo}
                disabled={!historyState.canUndo}
                size="small"
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Rétablir (Ctrl/Cmd+Y)">
            <span>
              <IconButton
                color="inherit"
                onClick={handleRedo}
                disabled={!historyState.canRedo}
                size="small"
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Recentrer le canvas">
            <span>
              <IconButton color="inherit" onClick={handleRecenterCanvas} size="small">
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Supprimer sélection (Suppr / Backspace)">
            <span>
              <IconButton
                color="inherit"
                onClick={handleDeleteSelection}
                disabled={!hasSelection}
                size="small"
                sx={{ mr: 1 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            {isSaving ? 'Sauvegarde...' : 'Autosave actif'}
          </Typography>
        </Toolbar>
      </AppBar>

      {!isPlaybackMode && (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar
            onSave={handleSave}
            onOpen={() => {
              void handleBackToLibrary();
            }}
            onExport={handleOpenYoutubeExport}
            isExporting={isYoutubeExporting || isYoutubeScenarioSyncing}
            isPlayMode={isPlaybackMode}
            onPlayModeToggle={togglePlaybackMode}
          />
          <Box
            ref={reactFlowWrapper}
            sx={{
              flex: 1,
              position: 'relative',
              height: 'calc(100vh - 64px)',
              '& .react-flow__panel': {
                zIndex: 5,
              },
              '& .react-flow__minimap': {
                zIndex: 5,
              },
              '& .react-flow__controls': {
                zIndex: 5,
              },
              '& .react-flow__handle': {
                zIndex: 3,
              },
              '& .react-flow__node': {
                zIndex: 2,
              },
              '& .react-flow__edge': {
                zIndex: 1,
              },
              '& .react-flow__background': {
                zIndex: 0,
              },
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onInit={onInit}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{
                padding: 0.2,
                minZoom: 0.02,
                includeHiddenNodes: true,
              }}
              minZoom={0.02}
              maxZoom={2.5}
              translateExtent={[
                [-50000, -50000],
                [50000, 50000],
              ]}
              nodeExtent={[
                [-50000, -50000],
                [50000, 50000],
              ]}
              deleteKeyCode={['Delete', 'Backspace']}
              selectionOnDrag
              selectNodesOnDrag
              selectionMode={SelectionMode.Partial}
              multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
              panOnDrag={[2]}
              panActivationKeyCode="Space"
              snapToGrid
              snapGrid={[15, 15]}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls fitViewOptions={{ padding: 0.2, minZoom: 0.02, includeHiddenNodes: true }} />
              <MiniMap />
            </ReactFlow>
          </Box>
        </Box>
      )}

      <Dialog
        open={isYoutubeDialogOpen}
        onClose={() => {
          if (!isYoutubeExporting && !isYoutubeScenarioSyncing) {
            setIsYoutubeDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Exporter vers YouTube</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <MuiAlert severity={youtubeAuthStatus?.configured ? 'info' : 'warning'}>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Configure les clés OAuth YouTube ci-dessous, puis clique sur Connexion YouTube.
                </Typography>
                <Typography variant="body2">
                  La connexion YouTube est maintenant liée à ton compte Studio (multi-utilisateur).
                </Typography>
                <Typography variant="body2">
                  1. Active YouTube Data API v3:{' '}
                  <Link href={googleCloudYoutubeApiUrl} target="_blank" rel="noopener noreferrer">
                    Ouvrir Google Cloud API Library
                  </Link>
                </Typography>
                <Typography variant="body2">
                  2. Configure l’écran de consentement OAuth:{' '}
                  <Link href={googleCloudConsentScreenUrl} target="_blank" rel="noopener noreferrer">
                    Ouvrir OAuth consent screen
                  </Link>
                </Typography>
                <Typography variant="body2">
                  3. Crée un identifiant OAuth 2.0 Web (Client ID / Secret):{' '}
                  <Link href={googleCloudCredentialsUrl} target="_blank" rel="noopener noreferrer">
                    Ouvrir Credentials
                  </Link>
                </Typography>
                <Typography variant="body2">
                  Note: YouTube ne gère pas le branching interactif natif. L’export crée une vidéo par node vidéo
                  (N possible), ajoute les boutons visuels de fin et ajoute le lien vers la version interactive dans
                  la description.
                </Typography>
              </Stack>
            </MuiAlert>

            <MuiAlert severity="info">
              <Stack spacing={1}>
                <Typography variant="body2">
                  Dans Google Cloud ({' '}
                  <strong>Identifiants OAuth 2.0 → Application Web</strong> ), renseigne:
                </Typography>
                <TextField
                  size="small"
                  label="Origines JavaScript autorisées"
                  value={suggestedYoutubeJavascriptOrigin}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  size="small"
                  label="URI de redirection autorisée"
                  value={suggestedYoutubeRedirectUri}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <Typography variant="body2">
                  Règle Google: pas de caractère générique, pas de chemin d’accès dans l’origine.
                  Si le port n’est pas 80, il faut le préciser (ex: https://example.com:8080).
                </Typography>
              </Stack>
            </MuiAlert>

            <FormControlLabel
              sx={{
                m: 0,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
              control={
                <Switch
                  checked={youtubeIncludeCompanionCta}
                  onChange={(event) => setYoutubeIncludeCompanionCta(event.target.checked)}
                  disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
                />
              }
              label="Créer une 2e vidéo CTA de fin (QR + bouton vers la version interactive)"
            />

            <TextField
              label="Texte quatrième de couv (vidéo CTA)"
              value={youtubeCompanionCtaText}
              onChange={(event) => setYoutubeCompanionCtaText(event.target.value)}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing || !youtubeIncludeCompanionCta}
              fullWidth
              helperText="Texte affiché sur le cartouche de fin de la vidéo CTA."
            />

            <TextField
              label="YOUTUBE_CLIENT_ID"
              value={youtubeClientIdInput}
              onChange={(event) => setYoutubeClientIdInput(event.target.value)}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing || isYoutubeConfigSaving}
              fullWidth
            />

            <TextField
              label="YOUTUBE_CLIENT_SECRET"
              type="password"
              value={youtubeClientSecretInput}
              onChange={(event) => setYoutubeClientSecretInput(event.target.value)}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing || isYoutubeConfigSaving}
              fullWidth
              placeholder={youtubeClientSecretSet ? 'Déjà enregistré (laisser vide pour conserver)' : ''}
            />

            <TextField
              label="YOUTUBE_REDIRECT_URI"
              value={youtubeRedirectUriInput}
              onChange={(event) => setYoutubeRedirectUriInput(event.target.value)}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing || isYoutubeConfigSaving}
              fullWidth
              helperText={`Doit correspondre exactement à l’URI autorisée dans Google Cloud. Exemple: ${suggestedYoutubeRedirectUri}`}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={() => {
                  void handleSaveYoutubeConfig();
                }}
                disabled={isYoutubeExporting || isYoutubeScenarioSyncing || isYoutubeConfigSaving}
                startIcon={
                  isYoutubeConfigSaving ? <CircularProgress size={16} color="inherit" /> : undefined
                }
              >
                {isYoutubeConfigSaving ? 'Enregistrement...' : 'Enregistrer config YouTube'}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Source: {youtubeConfigSource}
              </Typography>
            </Stack>

            <MuiAlert severity={youtubeAuthStatus?.connected ? 'success' : 'warning'}>
              {isYoutubeStatusLoading
                ? 'Vérification de la connexion YouTube...'
                : youtubeAuthStatus?.connected
                  ? `Connecté: ${youtubeAuthStatus.channelTitle || 'Chaîne YouTube'}`
                  : youtubeAuthStatus?.error || 'YouTube non connecté'}
            </MuiAlert>

            {lastYoutubeExportLink &&
            (lastYoutubeExportLink.url ||
              lastYoutubeExportLink.studioUrl ||
              lastYoutubeExportLink.videos.some((video) => Boolean(video.url || video.studioUrl))) ? (
              <MuiAlert severity="success">
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Dernier export: {lastYoutubeExportLink.title} ({lastYoutubeExportLink.visibilityLabel})
                  </Typography>
                  {(lastYoutubeExportLink.videos.length > 0
                    ? lastYoutubeExportLink.videos
                    : [
                        {
                          kind: 'main',
                          url: lastYoutubeExportLink.url,
                          studioUrl: lastYoutubeExportLink.studioUrl,
                          title: lastYoutubeExportLink.title,
                        },
                      ]
                  ).map((video, index) => {
                    const videoLabel =
                      video.kind === 'companion_cta'
                        ? 'Lien vidéo CTA de fin'
                        : index === 0
                          ? 'Lien vidéo principale'
                          : `Lien vidéo ${index + 1}`;
                    const videoValue = video.url || video.studioUrl || '';
                    return (
                      <Stack key={`${video.kind || 'video'}-${video.id || index}`} spacing={0.5}>
                        <TextField
                          size="small"
                          label={videoLabel}
                          value={videoValue}
                          fullWidth
                          InputProps={{ readOnly: true }}
                        />
                        {videoValue ? (
                          <Link href={videoValue} target="_blank" rel="noopener noreferrer">
                            Ouvrir directement
                          </Link>
                        ) : null}
                      </Stack>
                    );
                  })}
                  {youtubeEndScreenWizardStepCount > 0 || youtubeEndScreenPresets.length > 0 ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'primary.main',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Stack
                        direction={isMobileViewport ? 'column' : 'row'}
                        spacing={1}
                        alignItems={isMobileViewport ? 'flex-start' : 'center'}
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="subtitle2">Assistant End Screens (dans l’interface)</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedYoutubeEndScreenPreset
                              ? `Preset chargé: ${selectedYoutubeEndScreenPreset.name}`
                              : 'Source: dernier export'}
                            {youtubeEndScreenWizardStepCount > 0
                              ? ` • Étape ${Math.min(youtubeEndScreenWizardIndex + 1, youtubeEndScreenWizardStepCount)} / ${youtubeEndScreenWizardStepCount} • ${youtubeEndScreenWizardCompletedCount} source(s) finalisée(s)`
                              : ' • Aucun plan chargé'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleYoutubeEndScreenWizardPreviousStep}
                            disabled={youtubeEndScreenWizardStepCount === 0 || youtubeEndScreenWizardIndex <= 0}
                          >
                            Précédent
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleYoutubeEndScreenWizardNextStep}
                            disabled={
                              youtubeEndScreenWizardStepCount === 0 ||
                              youtubeEndScreenWizardIndex >= youtubeEndScreenWizardStepCount - 1
                            }
                          >
                            Suivant
                          </Button>
                        </Stack>
                      </Stack>

                      <Stack
                        direction={isMobileViewport ? 'column' : 'row'}
                        spacing={1}
                        flexWrap="wrap"
                        sx={{ mt: 1 }}
                      >
                        <FormControl size="small" sx={{ minWidth: isMobileViewport ? '100%' : 280 }}>
                          <InputLabel id="youtube-endscreen-preset-select-label">Configuration</InputLabel>
                          <Select
                            labelId="youtube-endscreen-preset-select-label"
                            value={selectedYoutubeEndScreenPresetId || '__latest__'}
                            label="Configuration"
                            onChange={(event) => {
                              handleSelectYoutubeEndScreenPreset(String(event.target.value));
                            }}
                          >
                            <MenuItem value="__latest__">Dernier export</MenuItem>
                            {youtubeEndScreenPresets.map((preset) => (
                              <MenuItem key={preset.id} value={preset.id}>
                                {preset.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          label="Nom du preset"
                          value={youtubeEndScreenPresetNameInput}
                          onChange={(event) => {
                            setYoutubeEndScreenPresetNameInput(event.target.value);
                          }}
                          sx={{ minWidth: isMobileViewport ? '100%' : 240 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleSaveYoutubeEndScreenPreset}
                          disabled={!latestYoutubePlaywrightPlan && !youtubeEndScreenWizardPlan}
                        >
                          Mémoriser
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          disabled={!selectedYoutubeEndScreenPreset}
                          onClick={handleDeleteSelectedYoutubeEndScreenPreset}
                        >
                          Supprimer preset
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            void handlePrepareYoutubePlaywrightLaunch(youtubeEndScreenWizardPlan);
                          }}
                          disabled={!youtubeEndScreenWizardPlan}
                        >
                          Préparer lancement Playwright
                        </Button>
                      </Stack>

                      {youtubeEndScreenWizardCurrentStep ? (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            Source: {youtubeEndScreenWizardCurrentStep.sourceLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Sur YouTube Studio, ajoute des éléments "Vidéo" de fin puis assigne les cibles ci-dessous.
                          </Typography>

                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={handleOpenYoutubeEndScreenWizardSource}
                            >
                              Ouvrir source Studio
                            </Button>
                            <Button
                              size="small"
                              variant={youtubeEndScreenWizardCurrentStepCompleted ? 'contained' : 'outlined'}
                              color={youtubeEndScreenWizardCurrentStepCompleted ? 'success' : 'primary'}
                              onClick={handleYoutubeEndScreenWizardToggleCurrentStepCompleted}
                            >
                              {youtubeEndScreenWizardCurrentStepCompleted ? 'Étape validée' : 'Marquer comme fait'}
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={handleYoutubeEndScreenWizardCompleteAndNext}
                            >
                              {youtubeEndScreenWizardIsLastStep ? 'Valider et terminer' : 'Valider et suivant'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={handleOpenYoutubeEndScreenWizardAllTargets}
                            >
                              Ouvrir toutes cibles
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                void handleCopyYoutubeEndScreenWizardAllTargetVideoIds();
                              }}
                            >
                              Copier IDs cibles
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                void handleCopyYoutubeEndScreenWizardAllTargetLinks();
                              }}
                            >
                              Copier liens cibles
                            </Button>
                          </Stack>

                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {youtubeEndScreenWizardCurrentStep.targets.map((target, targetIndex) => {
                              return (
                                <Box
                                  key={`${youtubeEndScreenWizardCurrentStep.sourceNodeId}-${target.targetNodeId}-${targetIndex}`}
                                  sx={{
                                    width: isMobileViewport ? '100%' : 220,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <YoutubeThumbnailCardImage
                                    videoId={target.targetVideoId}
                                    fallbackUrl={target.targetThumbnailUrl}
                                    alt={target.targetLabel || `Cible ${targetIndex + 1}`}
                                  />
                                  <Box sx={{ p: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {target.targetLabel || `Cible ${targetIndex + 1}`}
                                    </Typography>
                                    {target.targetVideoId ? (
                                      <Typography variant="caption" color="text.secondary">
                                        ID: {target.targetVideoId}
                                      </Typography>
                                    ) : null}
                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          handleOpenYoutubeEndScreenWizardTarget(target);
                                        }}
                                      >
                                        Ouvrir
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="text"
                                        disabled={!target.targetVideoId}
                                        onClick={() => {
                                          void handleCopyYoutubeEndScreenWizardTargetVideoId(target);
                                        }}
                                      >
                                        Copier ID
                                      </Button>
                                    </Stack>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Stack>
                      ) : null}
                    </Box>
                  ) : null}
                  {lastYoutubeExportLink.endScreenPlan.length > 0 ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                        Plan Screen Cards / End Screens (YouTube Studio)
                      </Typography>
                      <Stack spacing={1}>
                        {lastYoutubeExportLink.endScreenPlan.map((plan, planIndex) => (
                          <Box key={`${plan.sourceNodeId}-${planIndex}`}>
                            <Typography variant="body2">
                              Source: {plan.sourceLabel || plan.sourceNodeId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Ajouter un élément "Vidéo" sur les{' '}
                              {plan.recommendedStartFromEndSeconds || 20} dernières secondes vers:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                              {plan.targets.map((target, targetIndex) => {
                                const targetUrl = target.targetStudioUrl || target.targetUrl;
                                const targetVideoId =
                                  extractYoutubeVideoId(target.targetVideoId || null) ||
                                  extractYoutubeVideoId(target.targetUrl || null) ||
                                  extractYoutubeVideoId(target.targetStudioUrl || null);
                                const targetThumbnailUrl = buildYoutubeThumbnailUrl(targetVideoId);
                                return targetUrl ? (
                                  <Button
                                    key={`${plan.sourceNodeId}-${target.targetNodeId}-${targetIndex}`}
                                    size="small"
                                    variant="outlined"
                                    component="a"
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    startIcon={
                                      targetThumbnailUrl ? (
                                        <Box
                                          component="img"
                                          src={targetThumbnailUrl}
                                          alt=""
                                          sx={{
                                            width: 28,
                                            height: 16,
                                            borderRadius: 0.5,
                                            objectFit: 'cover',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                          }}
                                        />
                                      ) : undefined
                                    }
                                  >
                                    {target.targetLabel || `Cible ${targetIndex + 1}`}
                                  </Button>
                                ) : null;
                              })}
                              {plan.sourceStudioUrl ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  component="a"
                                  href={plan.sourceStudioUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Configurer source
                                </Button>
                              ) : null}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                  {lastYoutubeExportLink.endScreenPlan.length > 0 ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1,
                        borderRadius: 1,
                        border: '1px dashed',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle2">Assistant YouTube Playwright (bêta)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Prépare un lancement autonome: le plan JSON et le script assistant sont
                        téléchargés, puis la commande à lancer est copiée. Le premier lancement
                        installe Playwright automatiquement si besoin.
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            handleDownloadYoutubePlaywrightPlan();
                          }}
                        >
                          Télécharger plan Playwright
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            void handleCopyYoutubePlaywrightPlan();
                          }}
                        >
                          Copier plan JSON
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            void handlePrepareYoutubePlaywrightLaunch();
                          }}
                        >
                          Préparer lancement Playwright
                        </Button>
                      </Stack>
                    </Box>
                  ) : null}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(lastYoutubeExportLink.videos.length > 0
                      ? lastYoutubeExportLink.videos
                      : [
                          {
                            kind: 'main',
                            url: lastYoutubeExportLink.url,
                            studioUrl: lastYoutubeExportLink.studioUrl,
                            title: lastYoutubeExportLink.title,
                          },
                        ]
                    ).map((video, index) => {
                      const openUrl = video.url || video.studioUrl;
                      if (!openUrl) {
                        return null;
                      }
                      const buttonLabel =
                        video.kind === 'companion_cta'
                          ? 'Ouvrir vidéo CTA'
                          : index === 0
                            ? 'Ouvrir vidéo principale'
                            : `Ouvrir vidéo ${index + 1}`;
                      return (
                        <Button
                          key={`open-${video.kind || 'video'}-${video.id || index}`}
                          size="small"
                          variant={index === 0 ? 'contained' : 'outlined'}
                          component="a"
                          href={openUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {buttonLabel}
                        </Button>
                      );
                    })}
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        void handleCopyLastYoutubeLink();
                      }}
                    >
                      Copier le lien
                    </Button>
                  </Stack>
                </Stack>
              </MuiAlert>
            ) : null}

            {!lastYoutubeExportLink && (youtubeEndScreenPresets.length > 0 || youtubeEndScreenWizardStepCount > 0) ? (
              <MuiAlert severity="info">
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Configurations End Screens mémorisées</Typography>
                  <Stack
                    direction={isMobileViewport ? 'column' : 'row'}
                    spacing={1}
                    flexWrap="wrap"
                  >
                    <FormControl size="small" sx={{ minWidth: isMobileViewport ? '100%' : 280 }}>
                      <InputLabel id="youtube-endscreen-preset-select-inline-label">Configuration</InputLabel>
                      <Select
                        labelId="youtube-endscreen-preset-select-inline-label"
                        value={selectedYoutubeEndScreenPresetId || '__latest__'}
                        label="Configuration"
                        onChange={(event) => {
                          handleSelectYoutubeEndScreenPreset(String(event.target.value));
                        }}
                      >
                        <MenuItem value="__latest__">Dernier export (indisponible)</MenuItem>
                        {youtubeEndScreenPresets.map((preset) => (
                          <MenuItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      disabled={!selectedYoutubeEndScreenPreset}
                      onClick={handleDeleteSelectedYoutubeEndScreenPreset}
                    >
                      Supprimer preset
                    </Button>
                  </Stack>

                  {youtubeEndScreenWizardCurrentStep ? (
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2">
                        Source: {youtubeEndScreenWizardCurrentStep.sourceLabel}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleOpenYoutubeEndScreenWizardSource}
                        >
                          Ouvrir source Studio
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleOpenYoutubeEndScreenWizardAllTargets}
                        >
                          Ouvrir toutes cibles
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            void handleCopyYoutubeEndScreenWizardAllTargetVideoIds();
                          }}
                        >
                          Copier IDs cibles
                        </Button>
                        {youtubeEndScreenWizardCurrentStep.targets.map((target, targetIndex) => (
                          <Button
                            key={`${youtubeEndScreenWizardCurrentStep.sourceNodeId}-${target.targetNodeId}-${targetIndex}-quick`}
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              handleOpenYoutubeEndScreenWizardTarget(target);
                            }}
                          >
                            {target.targetLabel || `Cible ${targetIndex + 1}`}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Aucun preset exploitable pour le moment.
                    </Typography>
                  )}
                </Stack>
              </MuiAlert>
            ) : null}

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  void handleConnectYoutube();
                }}
                disabled={
                  isYoutubeExporting || isYoutubeScenarioSyncing || isYoutubeConfigSaving || isYoutubeConfigLoading
                }
              >
                Connexion YouTube
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  void refreshYoutubeAuthStatus();
                  void refreshYoutubeConfig();
                }}
                disabled={
                  isYoutubeStatusLoading || isYoutubeConfigLoading || isYoutubeExporting || isYoutubeScenarioSyncing
                }
              >
                Rafraîchir
              </Button>
            </Stack>

            <TextField
              label="Titre vidéo"
              value={youtubeTitle}
              onChange={(event) => setYoutubeTitle(event.target.value)}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
            />

            <TextField
              label="Description"
              value={youtubeDescription}
              onChange={(event) => setYoutubeDescription(event.target.value)}
              multiline
              minRows={4}
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
            />

            <FormControl fullWidth>
              <InputLabel id="youtube-privacy-label">Visibilité</InputLabel>
              <Select
                labelId="youtube-privacy-label"
                label="Visibilité"
                value={youtubePrivacyStatus}
                onChange={(event) =>
                  setYoutubePrivacyStatus(event.target.value as 'private' | 'public' | 'unlisted')
                }
                disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
              >
                <MenuItem value="private">Privée</MenuItem>
                <MenuItem value="unlisted">Non répertoriée</MenuItem>
                <MenuItem value="public">Publique</MenuItem>
              </Select>
              <FormHelperText>
                Non répertoriée et privée n’apparaissent pas sur la page publique de la chaîne.
              </FormHelperText>
            </FormControl>

            <TextField
              label="Tags (séparés par des virgules)"
              value={youtubeTagsInput}
              onChange={(event) => setYoutubeTagsInput(event.target.value)}
              placeholder="interactif,video,scenario"
              disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isForceYoutubeReexport}
                  onChange={(event) => setIsForceYoutubeReexport(event.target.checked)}
                  disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
                />
              }
              label="Forcer réexport (ignorer les liens déjà exportés)"
            />
            <FormHelperText>
              Si la configuration est identique, l’app réutilise automatiquement les liens déjà exportés.
            </FormHelperText>
            <FormHelperText>
              Besoin de recalculer uniquement les transitions/scénario? Utilise le bouton de mise à jour sans médias.
            </FormHelperText>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!isYoutubeExporting && !isYoutubeScenarioSyncing) {
                setIsYoutubeDialogOpen(false);
              }
            }}
            disabled={isYoutubeExporting || isYoutubeScenarioSyncing}
          >
            Annuler
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              void handleYoutubeScenarioOnlyUpdate();
            }}
            disabled={
              isYoutubeExporting ||
              isYoutubeScenarioSyncing ||
              !lastYoutubeExportLink ||
              lastYoutubeExportLink.videos.length === 0
            }
            startIcon={isYoutubeScenarioSyncing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isYoutubeScenarioSyncing ? 'Mise à jour...' : 'Mettre à jour scénario (sans médias)'}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleYoutubeExport();
            }}
            disabled={
              isYoutubeExporting ||
              isYoutubeScenarioSyncing ||
              isYoutubeConfigSaving ||
              isYoutubeStatusLoading ||
              !youtubeAuthStatus?.configured ||
              !youtubeAuthStatus?.connected
            }
            startIcon={isYoutubeExporting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isYoutubeExporting ? 'Upload...' : 'Exporter & uploader'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert
          onClose={() => setToast(null)}
          severity={toast?.severity || 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast?.message || ''}
        </MuiAlert>
      </Snackbar>

      {renderPlaybackOverlay()}
    </Box>
  );
};

const ScenarioEditor: React.FC<ScenarioEditorProps> = (props) => (
  <ReactFlowProvider>
    <Flow {...props} />
  </ReactFlowProvider>
);

export default ScenarioEditor;
