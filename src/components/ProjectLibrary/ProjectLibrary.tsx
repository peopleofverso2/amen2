import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  CircularProgress,
  Divider,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Insights as InsightsIcon,
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  OpenInFull as OpenInFullIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import ReactPlayer from 'react-player';
import { ProjectService } from '../../services/projectService';
import publishService from '../../services/publishService';
import { Project, ProjectMetadata } from '../../types/project';
import {
  ButtonNodeData,
  CustomEdge,
  CustomNode,
  ScenarioGroupNodeData,
  VideoNodeData,
} from '../../types/nodes';

interface ProjectLibraryProps {
  onProjectSelect: (projectId: string) => void;
  mode?: 'authoring' | 'public';
  autoOpenProjectId?: string | null;
  canAccessAnalytics?: boolean;
}

interface MiniPreviewScenario {
  nodes: CustomNode[];
  edges: CustomEdge[];
}

interface MiniMenuOption {
  id: string;
  label: string;
  targetVideoNodeId: string;
  style?: ButtonNodeData['style'];
  variant?: ButtonNodeData['variant'];
  size?: ButtonNodeData['size'];
}

interface InteractiveMiniPlayerProps {
  scenario?: MiniPreviewScenario;
  fallbackUrl?: string;
  autoStart?: boolean;
}

interface AnalyticsNodeCount {
  nodeId: string;
  count: number;
}

interface AnalyticsPathCount {
  path: string;
  count: number;
}

interface AnalyticsEventTypeCount {
  eventType: string;
  count: number;
}

interface AnalyticsChoiceCount {
  buttonId: string | null;
  targetNodeId: string | null;
  nodeId: string | null;
  label: string | null;
  count: number;
}

interface ProjectAnalyticsStats {
  totalEvents: number;
  sessions: {
    started: number;
    ended: number;
    active: number;
    completed: number;
    uniqueVisitors: number;
    completionRatePct: number;
  };
  engagement: {
    videoStarts: number;
    videoCompletions: number;
    videoCompletionRatePct: number;
    menusShown: number;
    choiceClicks: number;
    conversions: number;
  };
  topNodes: AnalyticsNodeCount[];
  topChoices: AnalyticsChoiceCount[];
  topPaths: AnalyticsPathCount[];
  dropOffNodes: AnalyticsNodeCount[];
  eventTypeBreakdown: AnalyticsEventTypeCount[];
}

interface PublishedShareLink {
  slug: string;
  url: string;
  embedCode: string;
}

type BrowserFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type BrowserFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const miniDefaultButtonStyle: NonNullable<ButtonNodeData['style']> = {
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

const miniButtonSizePresets: Record<
  NonNullable<ButtonNodeData['size']>,
  { fontSize: string; padding: string; minWidth: string }
> = {
  small: {
    fontSize: '12px',
    padding: '4px 10px',
    minWidth: '88px',
  },
  medium: {
    fontSize: '13px',
    padding: '6px 14px',
    minWidth: '110px',
  },
  large: {
    fontSize: '15px',
    padding: '10px 18px',
    minWidth: '130px',
  },
};
const MINI_PLAYBACK_SEEK_TOLERANCE_SECONDS = 0.4;
const MINI_PLAYBACK_SEEK_RETRY_DELAY_MS = 220;
const MINI_PLAYBACK_SEEK_STUCK_TIMEOUT_MS = 1800;
const MINI_PLAYBACK_MAX_SEEK_ATTEMPTS = 2;

const InteractiveMiniPlayer: React.FC<InteractiveMiniPlayerProps> = ({
  scenario,
  fallbackUrl,
  autoStart = false,
}) => {
  const playerRef = useRef<ReactPlayer | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoNodeId, setActiveVideoNodeId] = useState<string | null>(null);
  const [menuOptions, setMenuOptions] = useState<MiniMenuOption[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingSeekAppliedAtRef = useRef<number | null>(null);
  const pendingSeekAttemptsRef = useRef(0);
  const outReachedRef = useRef(false);
  const transitionHandledRef = useRef(false);
  const isMobileViewport = useMediaQuery('(max-width:768px)');

  const graph = useMemo(() => {
    const nodeById = new Map<string, CustomNode>();
    const outgoing = new Map<string, CustomEdge[]>();
    const incoming = new Map<string, CustomEdge[]>();

    const nodes = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
    const edges = Array.isArray(scenario?.edges) ? scenario.edges : [];

    nodes.forEach((node) => {
      nodeById.set(node.id, node);
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
  }, [scenario]);

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

  const buildTransitions = useCallback(
    (videoNodeId: string): { menuOptions: MiniMenuOption[]; autoNextVideoId?: string } => {
      const outgoing = graph.outgoing.get(videoNodeId) ?? [];
      const options: MiniMenuOption[] = [];
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

        return {
          menuOptions: directVideoTargets.map((target, index) => {
            const targetNode = graph.nodeById.get(target.videoNodeId);
            const targetData = targetNode?.type === 'video' ? (targetNode.data as VideoNodeData) : undefined;
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
          }),
        };
      }

      return { menuOptions: [] };
    },
    [graph, resolveButtonTargetVideoId, resolveNodeToVideoTargets]
  );

  const findStartVideoNodeId = useCallback((): string | null => {
    const videos = Array.from(graph.nodeById.values()).filter((node) => {
      if (node.type !== 'video') {
        return false;
      }
      const data = node.data as VideoNodeData;
      return Boolean(data.videoUrl && data.videoUrl.trim());
    });

    if (videos.length === 0) {
      return null;
    }

    const rootVideo = videos.find((videoNode) => {
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

    return rootVideo?.id || videos[0].id;
  }, [graph]);

  useEffect(() => {
    const startNodeId = findStartVideoNodeId();
    setActiveVideoNodeId(startNodeId);
    setMenuOptions([]);
    setIsPlaying(autoStart);
    setPlayerKey((previous) => previous + 1);
  }, [findStartVideoNodeId, scenario, autoStart]);

  useEffect(() => {
    outReachedRef.current = false;
    transitionHandledRef.current = false;
    pendingSeekRef.current = null;
    pendingSeekAppliedAtRef.current = null;
    pendingSeekAttemptsRef.current = 0;
  }, [activeVideoNodeId, playerKey]);

  const activeVideoNode = useMemo(() => {
    if (!activeVideoNodeId) {
      return null;
    }
    const node = graph.nodeById.get(activeVideoNodeId);
    if (!node || node.type !== 'video') {
      return null;
    }
    return node;
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

  const currentVideoUrl = (activeVideoData?.videoUrl || fallbackUrl || '').trim();
  const useNativeMiniPlayer = useMemo(() => {
    const normalizedUrl = currentVideoUrl.toLowerCase();
    const isUploaded = normalizedUrl.startsWith('/uploads/') || normalizedUrl.includes('/uploads/');
    const looksLikeFile = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/.test(normalizedUrl);
    return isUploaded || looksLikeFile;
  }, [currentVideoUrl]);

  const clearPendingMiniSeek = useCallback(() => {
    pendingSeekRef.current = null;
    pendingSeekAppliedAtRef.current = null;
    pendingSeekAttemptsRef.current = 0;
  }, []);

  const applyMiniSeek = useCallback((targetSeconds: number) => {
    if (useNativeMiniPlayer) {
      const nativePlayer = nativeVideoRef.current;
      if (!nativePlayer) {
        return;
      }
      try {
        nativePlayer.currentTime = Math.max(0, targetSeconds);
        pendingSeekAttemptsRef.current += 1;
        pendingSeekAppliedAtRef.current = Date.now();
      } catch (error) {
        console.error('Mini preview native seek error:', error);
      }
      return;
    }

    if (!playerRef.current) {
      return;
    }
    try {
      playerRef.current.seekTo(targetSeconds, 'seconds');
      pendingSeekAttemptsRef.current += 1;
      pendingSeekAppliedAtRef.current = Date.now();
    } catch (error) {
      console.error('Mini preview seek error:', error);
    }
  }, [useNativeMiniPlayer]);

  const handleNavigate = useCallback((targetVideoNodeId: string) => {
    setActiveVideoNodeId(targetVideoNodeId);
    setMenuOptions([]);
    setIsPlaying(true);
    clearPendingMiniSeek();
    outReachedRef.current = false;
    transitionHandledRef.current = false;
    setPlayerKey((previous) => previous + 1);
  }, [clearPendingMiniSeek]);

  const handleEnded = useCallback(() => {
    if (!activeVideoNodeId || transitionHandledRef.current) {
      return;
    }

    transitionHandledRef.current = true;
    setIsPlaying(false);
    clearPendingMiniSeek();

    const { menuOptions: nextOptions, autoNextVideoId } = buildTransitions(activeVideoNodeId);
    if (nextOptions.length > 0) {
      setMenuOptions(nextOptions);
      return;
    }

    if (autoNextVideoId) {
      handleNavigate(autoNextVideoId);
      return;
    }

    setMenuOptions([]);
  }, [activeVideoNodeId, buildTransitions, handleNavigate, clearPendingMiniSeek]);

  const forceMiniPlaybackPlay = useCallback(() => {
    if (useNativeMiniPlayer) {
      try {
        const playAttempt = nativeVideoRef.current?.play?.();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          void playAttempt.catch(() => undefined);
        }
      } catch (error) {
        console.error('Mini preview force native play error:', error);
      }
      return;
    }

    if (!playerRef.current) {
      return;
    }
    try {
      const internalPlayer = playerRef.current.getInternalPlayer?.() as HTMLMediaElement | null;
      const playAttempt = internalPlayer?.play?.();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        void playAttempt.catch(() => undefined);
      }
    } catch (error) {
      console.error('Mini preview force play error:', error);
    }
  }, [useNativeMiniPlayer]);

  useEffect(() => {
    if (!isPlaying) {
      if (useNativeMiniPlayer && nativeVideoRef.current) {
        nativeVideoRef.current.pause();
      }
      return;
    }
    forceMiniPlaybackPlay();
  }, [isPlaying, forceMiniPlaybackPlay, useNativeMiniPlayer]);

  const handleSeek = useCallback(
    (seconds: number) => {
      const pendingTarget = pendingSeekRef.current;
      if (pendingTarget === null) {
        return;
      }
      if (seconds >= pendingTarget - MINI_PLAYBACK_SEEK_TOLERANCE_SECONDS) {
        clearPendingMiniSeek();
        forceMiniPlaybackPlay();
      }
    },
    [forceMiniPlaybackPlay, clearPendingMiniSeek]
  );

  const handleProgress = useCallback(
    (progressState: { playedSeconds: number }) => {
      if (!isPlaying) {
        return;
      }

      const pendingTarget = pendingSeekRef.current;
      if (pendingTarget !== null) {
        if (progressState.playedSeconds >= pendingTarget - MINI_PLAYBACK_SEEK_TOLERANCE_SECONDS) {
          clearPendingMiniSeek();
          forceMiniPlaybackPlay();
        } else {
          const now = Date.now();
          const lastAttemptAt = pendingSeekAppliedAtRef.current;
          const elapsedSinceAttempt =
            typeof lastAttemptAt === 'number' ? now - lastAttemptAt : Number.POSITIVE_INFINITY;

          if (
            pendingSeekAttemptsRef.current < MINI_PLAYBACK_MAX_SEEK_ATTEMPTS &&
            elapsedSinceAttempt >= MINI_PLAYBACK_SEEK_RETRY_DELAY_MS
          ) {
            applyMiniSeek(pendingTarget);
          } else if (elapsedSinceAttempt >= MINI_PLAYBACK_SEEK_STUCK_TIMEOUT_MS) {
            // Avoid dead-locking on a frozen frame when seek events are dropped.
            clearPendingMiniSeek();
            forceMiniPlaybackPlay();
          }
          return;
        }
      }

      if (progressState.playedSeconds < activeMediaIn - MINI_PLAYBACK_SEEK_TOLERANCE_SECONDS) {
        return;
      }

      if (!activeMediaOut || outReachedRef.current) {
        return;
      }

      if (progressState.playedSeconds >= activeMediaOut) {
        outReachedRef.current = true;
        handleEnded();
      }
    },
    [
      isPlaying,
      activeMediaOut,
      activeMediaIn,
      handleEnded,
      forceMiniPlaybackPlay,
      clearPendingMiniSeek,
      applyMiniSeek,
    ]
  );

  const handleMiniPlayerReady = useCallback(() => {
    if (activeMediaIn > 0) {
      pendingSeekRef.current = activeMediaIn;
      pendingSeekAttemptsRef.current = 0;
      pendingSeekAppliedAtRef.current = null;
      applyMiniSeek(activeMediaIn);
    } else {
      clearPendingMiniSeek();
    }
    if (isPlaying) {
      forceMiniPlaybackPlay();
    }
  }, [
    activeMediaIn,
    applyMiniSeek,
    clearPendingMiniSeek,
    forceMiniPlaybackPlay,
    isPlaying,
  ]);

  const resolveResponsivePlaybackStyle = (
    style: ButtonNodeData['style']
  ): NonNullable<ButtonNodeData['style']> => {
    const positionMode = isMobileViewport
      ? style?.mobilePositionMode ||
        style?.positionMode ||
        miniDefaultButtonStyle.mobilePositionMode ||
        miniDefaultButtonStyle.positionMode ||
        'flow'
      : style?.positionMode || miniDefaultButtonStyle.positionMode || 'flow';
    const horizontalAlign = isMobileViewport
      ? style?.mobileHorizontalAlign ||
        style?.horizontalAlign ||
        miniDefaultButtonStyle.mobileHorizontalAlign ||
        miniDefaultButtonStyle.horizontalAlign ||
        'center'
      : style?.horizontalAlign || miniDefaultButtonStyle.horizontalAlign || 'center';
    const verticalAlign = isMobileViewport
      ? style?.mobileVerticalAlign ||
        style?.verticalAlign ||
        miniDefaultButtonStyle.mobileVerticalAlign ||
        miniDefaultButtonStyle.verticalAlign ||
        'bottom'
      : style?.verticalAlign || miniDefaultButtonStyle.verticalAlign || 'bottom';

    const rawPositionX = isMobileViewport
      ? style?.mobilePositionX ?? style?.positionX ?? miniDefaultButtonStyle.mobilePositionX ?? 16
      : style?.positionX ?? miniDefaultButtonStyle.positionX ?? 24;
    const rawPositionY = isMobileViewport
      ? style?.mobilePositionY ?? style?.positionY ?? miniDefaultButtonStyle.mobilePositionY ?? 16
      : style?.positionY ?? miniDefaultButtonStyle.positionY ?? 24;

    const positionX = Number.isFinite(Number(rawPositionX)) ? Number(rawPositionX) : 0;
    const positionY = Number.isFinite(Number(rawPositionY)) ? Number(rawPositionY) : 0;

    return {
      ...miniDefaultButtonStyle,
      ...(style || {}),
      positionMode,
      horizontalAlign,
      verticalAlign,
      positionX,
      positionY,
    };
  };

  const menuOptionsWithResolvedStyle = menuOptions.map((option) => ({
    ...option,
    resolvedStyle: resolveResponsivePlaybackStyle(option.style),
  }));

  const flowMenuOptions = menuOptionsWithResolvedStyle.filter(
    (option) => option.resolvedStyle.positionMode !== 'absolute'
  );
  const absoluteMenuOptions = menuOptionsWithResolvedStyle.filter(
    (option) => option.resolvedStyle.positionMode === 'absolute'
  );

  const getButtonSx = (
    option: MiniMenuOption & { resolvedStyle: NonNullable<ButtonNodeData['style']> }
  ) => {
    const optionSize = option.size || 'medium';
    const preset = miniButtonSizePresets[optionSize];
    const usesCustomFontSize = Boolean(
      option.resolvedStyle.fontSize &&
        option.resolvedStyle.fontSize !== miniDefaultButtonStyle.fontSize
    );
    const usesCustomPadding = Boolean(
      option.resolvedStyle.padding &&
        option.resolvedStyle.padding !== miniDefaultButtonStyle.padding
    );

    return {
      backgroundColor: option.resolvedStyle.backgroundColor || miniDefaultButtonStyle.backgroundColor,
      color: option.resolvedStyle.textColor || miniDefaultButtonStyle.textColor,
      borderRadius: option.resolvedStyle.borderRadius || miniDefaultButtonStyle.borderRadius,
      fontSize: usesCustomFontSize ? option.resolvedStyle.fontSize : preset.fontSize,
      borderStyle: option.resolvedStyle.borderStyle || miniDefaultButtonStyle.borderStyle,
      borderColor: option.resolvedStyle.borderColor || miniDefaultButtonStyle.borderColor,
      borderWidth: option.resolvedStyle.borderWidth || miniDefaultButtonStyle.borderWidth,
      boxShadow: option.resolvedStyle.boxShadow || miniDefaultButtonStyle.boxShadow,
      padding: usesCustomPadding ? option.resolvedStyle.padding : preset.padding,
      textAlign: option.resolvedStyle.textAlign || miniDefaultButtonStyle.textAlign,
      transition: option.resolvedStyle.transition || miniDefaultButtonStyle.transition,
      minWidth: preset.minWidth,
      '&:hover': {
        backgroundColor:
          option.resolvedStyle.hoverBackgroundColor || miniDefaultButtonStyle.hoverBackgroundColor,
        color: option.resolvedStyle.hoverTextColor || miniDefaultButtonStyle.hoverTextColor,
        transform: `scale(${option.resolvedStyle.hoverScale || miniDefaultButtonStyle.hoverScale})`,
      },
    };
  };

  const getAbsoluteButtonPositionSx = (
    style: NonNullable<ButtonNodeData['style']>
  ): Record<string, string | number> => {
    const horizontalAlign = style.horizontalAlign || miniDefaultButtonStyle.horizontalAlign || 'center';
    const verticalAlign = style.verticalAlign || miniDefaultButtonStyle.verticalAlign || 'bottom';

    const rawX = Number(style.positionX ?? miniDefaultButtonStyle.positionX ?? 24);
    const rawY = Number(style.positionY ?? miniDefaultButtonStyle.positionY ?? 24);
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

  if (!currentVideoUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 13,
        }}
      >
        Aperçu indisponible
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {useNativeMiniPlayer ? (
        <video
          ref={nativeVideoRef}
          key={`mini-native-${playerKey}-${activeVideoNodeId || 'fallback'}`}
          src={currentVideoUrl}
          playsInline
          preload="auto"
          controls={false}
          onLoadedMetadata={handleMiniPlayerReady}
          onSeeked={(event) => {
            handleSeek(event.currentTarget.currentTime || 0);
          }}
          onTimeUpdate={(event) => {
            handleProgress({ playedSeconds: event.currentTarget.currentTime || 0 });
          }}
          onEnded={handleEnded}
          onError={() => {
            setIsPlaying(false);
            clearPendingMiniSeek();
          }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      ) : (
        <ReactPlayer
          ref={(player) => {
            playerRef.current = player;
          }}
          key={`mini-${playerKey}-${activeVideoNodeId || 'fallback'}`}
          url={currentVideoUrl}
          width="100%"
          height="100%"
          playing={isPlaying}
          controls={false}
          onReady={handleMiniPlayerReady}
          onSeek={handleSeek}
          onEnded={handleEnded}
          onError={() => {
            setIsPlaying(false);
            clearPendingMiniSeek();
          }}
          onProgress={handleProgress}
          progressInterval={400}
        />
      )}

      {!isPlaying && menuOptions.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
        >
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => {
              setIsPlaying(true);
              forceMiniPlaybackPlay();
            }}
          >
            Lecture interactive
          </Button>
        </Box>
      )}

      {absoluteMenuOptions.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {absoluteMenuOptions.map((option) => {
            const optionSize = option.size || 'medium';
            return (
              <Button
                key={option.id}
                variant={option.variant || 'contained'}
                size={optionSize}
                onClick={() => handleNavigate(option.targetVideoNodeId)}
                sx={{
                  ...getButtonSx(option),
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

      {flowMenuOptions.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            p: 1,
            display: 'flex',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {flowMenuOptions.map((option) => {
              const optionSize = option.size || 'medium';
              return (
                <Button
                  key={option.id}
                  variant={option.variant || 'contained'}
                  size={optionSize}
                  onClick={() => handleNavigate(option.targetVideoNodeId)}
                  sx={getButtonSx(option)}
                >
                  {option.label}
                </Button>
              );
            })}
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: 0.75,
          alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.6)',
          color: 'white',
          borderRadius: 999,
          px: 1,
          py: 0.5,
          fontSize: 11,
        }}
      >
        <IconButton
          size="small"
          onClick={() => {
            setIsPlaying((previous) => {
              const next = !previous;
              if (next) {
                forceMiniPlaybackPlay();
              }
              return next;
            });
          }}
          sx={{ color: 'white', p: 0.25 }}
        >
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
        <span>Interactif</span>
      </Box>
    </Box>
  );
};

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  onProjectSelect,
  mode = 'authoring',
  autoOpenProjectId = null,
  canAccessAnalytics = false,
}) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [projectPreviewUrls, setProjectPreviewUrls] = useState<Record<string, string>>({});
  const [projectScenarios, setProjectScenarios] = useState<Record<string, MiniPreviewScenario>>({});
  const [publishedShareLinks, setPublishedShareLinks] = useState<Record<string, PublishedShareLink>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [shareAnchorEl, setShareAnchorEl] = useState<HTMLElement | null>(null);
  const [shareProject, setShareProject] = useState<ProjectMetadata | null>(null);
  const [shareLoadingProjectId, setShareLoadingProjectId] = useState<string | null>(null);
  const [statsProject, setStatsProject] = useState<ProjectMetadata | null>(null);
  const [fullscreenProjectId, setFullscreenProjectId] = useState<string | null>(null);
  const [externalFullscreenScenario, setExternalFullscreenScenario] = useState<MiniPreviewScenario | null>(null);
  const [externalWatchTargetId, setExternalWatchTargetId] = useState<string | null>(null);
  const [externalWatchError, setExternalWatchError] = useState<string | null>(null);
  const [isExternalWatchLoading, setIsExternalWatchLoading] = useState(false);
  const [statsData, setStatsData] = useState<ProjectAnalyticsStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const statsRequestIdRef = useRef(0);
  const externalWatchRequestIdRef = useRef(0);
  const autoOpenHandledRef = useRef(false);
  const isPublicMode = mode === 'public';
  const showStatsControls = !isPublicMode || canAccessAnalytics;

  const projectService = ProjectService.getInstance();

  const loadProjects = useCallback(async () => {
    const projectsList = await projectService.listProjects();
    setProjects(projectsList);

    const previews = await Promise.all(
      projectsList.map(async (project) => {
        try {
          const fullProject = (await projectService.loadProject(project.id)) as Project;
          const firstVideoNode = fullProject.nodes.find((node) => {
            if (node.type !== 'video') {
              return false;
            }
            const data = node.data as { videoUrl?: string };
            return typeof data.videoUrl === 'string' && data.videoUrl.trim().length > 0;
          });
          const previewUrl = ((firstVideoNode?.data as { videoUrl?: string } | undefined)?.videoUrl || '').trim();
          return {
            projectId: project.id,
            previewUrl,
            scenario: {
              nodes: [...fullProject.nodes],
              edges: [...fullProject.edges],
            } as MiniPreviewScenario,
          };
        } catch {
          return {
            projectId: project.id,
            previewUrl: '',
            scenario: {
              nodes: [] as CustomNode[],
              edges: [] as CustomEdge[],
            } as MiniPreviewScenario,
          };
        }
      })
    );

    const previewUrlMap: Record<string, string> = {};
    const scenarioMap: Record<string, MiniPreviewScenario> = {};

    previews.forEach((payload) => {
      previewUrlMap[payload.projectId] = payload.previewUrl;
      scenarioMap[payload.projectId] = payload.scenario;
    });

    setProjectPreviewUrls(previewUrlMap);
    setProjectScenarios(scenarioMap);
  }, [projectService]);

  const loadExternalWatchScenario = useCallback(async (watchId: string) => {
    const normalizedWatchId = watchId.trim();
    if (!normalizedWatchId) {
      setExternalWatchTargetId(null);
      setExternalWatchError('Lien de lecture invalide');
      setExternalFullscreenScenario(null);
      setFullscreenProjectId(null);
      setIsExternalWatchLoading(false);
      return;
    }

    const requestId = externalWatchRequestIdRef.current + 1;
    externalWatchRequestIdRef.current = requestId;
    setExternalWatchTargetId(normalizedWatchId);
    setExternalWatchError(null);
    setExternalFullscreenScenario(null);
    setIsExternalWatchLoading(true);
    setFullscreenProjectId(null);

    try {
      const payload = await publishService.getPublishedScenario(normalizedWatchId);
      if (requestId !== externalWatchRequestIdRef.current) {
        return;
      }
      setExternalFullscreenScenario(payload.scenario);
    } catch (error) {
      if (requestId !== externalWatchRequestIdRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Publication introuvable';
      setExternalWatchError(message);
      console.warn('Unable to open published scenario:', error);
    } finally {
      if (requestId === externalWatchRequestIdRef.current) {
        setIsExternalWatchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    autoOpenHandledRef.current = false;
  }, [autoOpenProjectId]);

  useEffect(() => {
    if (autoOpenHandledRef.current) {
      return;
    }

    if (!autoOpenProjectId) {
      return;
    }

    const localProjectExists = projects.some((project) => project.id === autoOpenProjectId);
    if (localProjectExists) {
      autoOpenHandledRef.current = true;
      setExternalFullscreenScenario(null);
      setExternalWatchTargetId(null);
      setExternalWatchError(null);
      setIsExternalWatchLoading(false);
      setFullscreenProjectId(autoOpenProjectId);
      return;
    }

    if (!isPublicMode) {
      return;
    }

    autoOpenHandledRef.current = true;
    void loadExternalWatchScenario(autoOpenProjectId);
  }, [autoOpenProjectId, isPublicMode, loadExternalWatchScenario, projects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const projectId = await projectService.createProject(
        newProjectName,
        newProjectDescription
      );
      setIsCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      await loadProjects();
      onProjectSelect(projectId);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      try {
        await projectService.deleteProject(id);
        await loadProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const handleUpdateProjectName = async () => {
    if (!editingProject || !editingProject.name.trim()) return;

    try {
      await projectService.updateProjectName(
        editingProject.id,
        editingProject.name
      );
      setEditingProject(null);
      await loadProjects();
    } catch (error) {
      console.error('Error updating project name:', error);
    }
  };

  const getLocalShareUrl = (projectId: string) => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}?watch=${encodeURIComponent(projectId)}`;
  };

  const getLocalEmbedCode = (shareUrl: string) =>
    `<iframe src="${shareUrl}" width="1280" height="720" style="border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

  const publishProjectShare = useCallback(
    async (project: ProjectMetadata): Promise<PublishedShareLink> => {
      const cachedShare = publishedShareLinks[project.id];
      if (cachedShare) {
        return cachedShare;
      }

      let scenario = projectScenarios[project.id];
      if (!scenario) {
        const loadedProject = await projectService.loadProject(project.id);
        scenario = {
          nodes: [...loadedProject.nodes],
          edges: [...loadedProject.edges],
        };
      }

      const payload = await publishService.publishScenarioLink({
        projectId: project.id,
        title: project.name || 'Projet interactif',
        description: project.description,
        nodes: scenario.nodes,
        edges: scenario.edges,
      });

      const nextShareLink: PublishedShareLink = {
        slug: payload.slug,
        url: payload.url,
        embedCode: payload.embedCode,
      };

      setPublishedShareLinks((previousLinks) => ({
        ...previousLinks,
        [project.id]: nextShareLink,
      }));

      return nextShareLink;
    },
    [projectScenarios, projectService, publishedShareLinks]
  );

  const openShareMenu = (event: React.MouseEvent<HTMLElement>, project: ProjectMetadata) => {
    setShareAnchorEl(event.currentTarget);
    setShareProject(project);

    setShareLoadingProjectId(project.id);
    void publishProjectShare(project)
      .catch((error) => {
        console.warn('Share publish fallback to local URL:', error);
      })
      .finally(() => {
        setShareLoadingProjectId((currentProjectId) =>
          currentProjectId === project.id ? null : currentProjectId
        );
      });
  };

  const closeShareMenu = () => {
    setShareAnchorEl(null);
    setShareProject(null);
    setShareLoadingProjectId(null);
  };

  const requestBrowserFullscreen = useCallback(async (element: BrowserFullscreenElement) => {
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

  const exitBrowserFullscreen = useCallback(async () => {
    const doc = document as BrowserFullscreenDocument;
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

  const openFullscreenProject = useCallback(
    (projectId: string) => {
      externalWatchRequestIdRef.current += 1;
      setExternalFullscreenScenario(null);
      setExternalWatchTargetId(null);
      setExternalWatchError(null);
      setIsExternalWatchLoading(false);
      setFullscreenProjectId(projectId);
      void requestBrowserFullscreen(document.documentElement as BrowserFullscreenElement).catch(
        (error) => {
          console.warn('Fullscreen request failed:', error);
        }
      );
    },
    [requestBrowserFullscreen]
  );

  const closeFullscreenProject = useCallback(() => {
    externalWatchRequestIdRef.current += 1;
    setFullscreenProjectId(null);
    setExternalFullscreenScenario(null);
    setExternalWatchTargetId(null);
    setExternalWatchError(null);
    setIsExternalWatchLoading(false);
    void exitBrowserFullscreen().catch((error) => {
      console.warn('Fullscreen exit failed:', error);
    });
  }, [exitBrowserFullscreen]);

  const handleSharePlatform = async (
    platform: 'x' | 'facebook' | 'linkedin' | 'whatsapp' | 'copy' | 'embed'
  ) => {
    if (!shareProject) {
      return;
    }

    const localUrl = getLocalShareUrl(shareProject.id);
    const localEmbedCode = getLocalEmbedCode(localUrl);
    let shareUrl = localUrl;
    let embedCode = localEmbedCode;
    let title = shareProject.name || 'Projet interactif';

    try {
      const publishedLink = await publishProjectShare(shareProject);
      shareUrl = publishedLink.url;
      embedCode = publishedLink.embedCode;
      if (publishedLink.slug) {
        title = shareProject.name || publishedLink.slug || title;
      }
    } catch (error) {
      console.warn('Unable to publish project before sharing, local URL used:', error);
    }

    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch (error) {
        console.error('Clipboard error:', error);
      } finally {
        closeShareMenu();
      }
      return;
    }

    if (platform === 'embed') {
      try {
        await navigator.clipboard.writeText(embedCode);
      } catch (error) {
        console.error('Clipboard error:', error);
      } finally {
        closeShareMenu();
      }
      return;
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`${title} ${shareUrl}`);
    const encodedTitle = encodeURIComponent(title);

    const links = {
      x: `https://twitter.com/intent/tweet?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedText}`,
    };

    window.open(links[platform], '_blank', 'noopener,noreferrer');
    closeShareMenu();
  };

  const loadProjectStats = useCallback(async (projectId: string) => {
    const requestId = statsRequestIdRef.current + 1;
    statsRequestIdRef.current = requestId;
    setIsStatsLoading(true);
    setStatsError(null);

    try {
      const response = await fetch(`/api/analytics/stats?projectId=${encodeURIComponent(projectId)}`);
      const payload = (await response.json()) as ProjectAnalyticsStats & { error?: string };

      if (requestId !== statsRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Impossible de récupérer les stats');
      }

      setStatsData(payload);
    } catch (error) {
      if (requestId !== statsRequestIdRef.current) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Impossible de récupérer les stats';
      setStatsData(null);
      setStatsError(message);
    } finally {
      if (requestId === statsRequestIdRef.current) {
        setIsStatsLoading(false);
      }
    }
  }, []);

  const openStatsDialog = useCallback(
    (project: ProjectMetadata) => {
      setStatsProject(project);
      setStatsData(null);
      setStatsError(null);
      void loadProjectStats(project.id);
    },
    [loadProjectStats]
  );

  const closeStatsDialog = useCallback(() => {
    setStatsProject(null);
    setStatsData(null);
    setStatsError(null);
  }, []);

  const getNodeLabel = useCallback(
    (projectId: string, nodeId: string | null | undefined): string => {
      if (!nodeId) {
        return 'Node inconnu';
      }

      const scenario = projectScenarios[projectId];
      const node = scenario?.nodes.find((item) => item.id === nodeId);
      if (!node) {
        return nodeId;
      }

      if (node.type === 'video') {
        const videoData = node.data as VideoNodeData;
        return videoData.label?.trim() ? `${videoData.label} (${nodeId})` : `Vidéo (${nodeId})`;
      }

      if (node.type === 'button') {
        const buttonData = node.data as ButtonNodeData;
        const buttonLabel = buttonData.text || buttonData.label;
        return buttonLabel?.trim() ? `${buttonLabel} (${nodeId})` : `Bouton (${nodeId})`;
      }

      if (node.type === 'group') {
        const groupData = node.data as ScenarioGroupNodeData;
        const groupLabel = groupData.label?.trim();
        return groupLabel ? `${groupLabel} (${nodeId})` : `Groupe (${nodeId})`;
      }

      const genericData =
        node.data && typeof node.data === 'object'
          ? (node.data as { label?: string })
          : undefined;
      return genericData?.label?.trim()
        ? `${genericData.label} (${nodeId})`
        : `Node (${nodeId})`;
    },
    [projectScenarios]
  );
  const statsProjectId = statsProject?.id || '';
  const isFullscreenDialogOpen = Boolean(
    fullscreenProjectId || externalFullscreenScenario || isExternalWatchLoading || externalWatchError
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Bibliothèque de projets</Typography>
        {!isPublicMode && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Nouveau projet
          </Button>
        )}
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        {projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id} sx={{ display: 'flex' }}>
            <Card
              sx={{
                width: '100%',
                height: '100%',
                minHeight: { xs: 392, sm: 404, md: 416 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  '&:last-child': { pb: { xs: 1.5, sm: 2 } },
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                }}
              >
                {editingProject?.id === project.id ? (
                  <TextField
                    fullWidth
                    value={editingProject.name}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        name: e.target.value,
                      })
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateProjectName();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{
                        pr: 1,
                        minHeight: { xs: 34, sm: 38 },
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {project.name}
                    </Typography>
                    <Box>
                      {showStatsControls && (
                        <Tooltip title="Stats">
                          <IconButton
                            size="small"
                            onClick={() => openStatsDialog(project)}
                          >
                            <InsightsIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Partager">
                        <IconButton
                          size="small"
                          onClick={(event) => openShareMenu(event, project)}
                        >
                          <ShareIcon />
                        </IconButton>
                      </Tooltip>
                      {!isPublicMode && (
                        <Tooltip title="Renommer">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setEditingProject({
                                id: project.id,
                                name: project.name,
                              })
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!isPublicMode && (
                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteProject(project.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                )}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    minHeight: { xs: 38, sm: 44 },
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {project.description || ' '}
                </Typography>
                <Box
                  sx={{
                    mt: { xs: 0.75, sm: 1 },
                    width: '100%',
                    aspectRatio: '16 / 9',
                    bgcolor: 'black',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <InteractiveMiniPlayer
                    scenario={projectScenarios[project.id]}
                    fallbackUrl={projectPreviewUrls[project.id]}
                  />
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: { xs: 0.75, sm: 1 }, display: 'block' }}
                >
                  Modifié le{' '}
                  {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, pt: 0 }}>
                {!isPublicMode && (
                  <Button
                    size="small"
                    onClick={() => onProjectSelect(project.id)}
                  >
                    Ouvrir
                  </Button>
                )}
                {isPublicMode && (
                  <Button
                    size="small"
                    onClick={() => onProjectSelect(project.id)}
                  >
                    Éditer (Studio)
                  </Button>
                )}
                <Button
                  size="small"
                  startIcon={<OpenInFullIcon />}
                  onClick={() => openFullscreenProject(project.id)}
                >
                  Plein écran
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={isFullscreenDialogOpen}
        onClose={closeFullscreenProject}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'black',
          },
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <IconButton
            onClick={closeFullscreenProject}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 20,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.75)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box sx={{ width: '100%', height: '100%' }}>
            {isExternalWatchLoading ? (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <CircularProgress size={34} color="inherit" />
              </Box>
            ) : externalWatchError && !fullscreenProjectId ? (
              <Stack
                spacing={2}
                sx={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 3,
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                <Typography variant="h6">Lecture indisponible</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.8)',
                    maxWidth: 560,
                  }}
                >
                  {externalWatchError}
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (externalWatchTargetId) {
                        void loadExternalWatchScenario(externalWatchTargetId);
                      }
                    }}
                  >
                    Réessayer
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={closeFullscreenProject}>
                    Fermer
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <InteractiveMiniPlayer
                scenario={
                  externalFullscreenScenario ||
                  (fullscreenProjectId ? projectScenarios[fullscreenProjectId] : undefined)
                }
                fallbackUrl={
                  externalFullscreenScenario
                    ? undefined
                    : fullscreenProjectId
                      ? projectPreviewUrls[fullscreenProjectId]
                      : undefined
                }
                autoStart
              />
            )}
          </Box>
        </Box>
      </Dialog>

      <Menu
        anchorEl={shareAnchorEl}
        open={Boolean(shareAnchorEl)}
        onClose={closeShareMenu}
      >
        <MenuItem
          onClick={() => void handleSharePlatform('x')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <Typography variant="body2" fontWeight={700}>
              X
            </Typography>
          </ListItemIcon>
          <ListItemText>X / Twitter</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => void handleSharePlatform('facebook')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <FacebookIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Facebook</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => void handleSharePlatform('linkedin')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <LinkedInIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>LinkedIn</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => void handleSharePlatform('whatsapp')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>WhatsApp</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => void handleSharePlatform('copy')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copier le lien</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => void handleSharePlatform('embed')}
          disabled={Boolean(shareProject && shareLoadingProjectId === shareProject.id)}
        >
          <ListItemIcon>
            <CodeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copier le code embed</ListItemText>
        </MenuItem>
      </Menu>

      {showStatsControls && (
        <Dialog
          open={Boolean(statsProject)}
          onClose={closeStatsDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Stats parcours
            {statsProject ? ` · ${statsProject.name}` : ''}
          </DialogTitle>
          <DialogContent dividers>
            {isStatsLoading && (
              <Box
                sx={{
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={28} />
              </Box>
            )}

            {!isStatsLoading && statsError && (
              <Typography color="error">{statsError}</Typography>
            )}

            {!isStatsLoading && !statsError && statsData && statsProject && (
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                    gap: 1,
                  }}
                >
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      Sessions
                    </Typography>
                    <Typography variant="h6">{statsData.sessions.started}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      Visiteurs uniques
                    </Typography>
                    <Typography variant="h6">{statsData.sessions.uniqueVisitors}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      Taux complétion session
                    </Typography>
                    <Typography variant="h6">{statsData.sessions.completionRatePct}%</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      Taux complétion vidéo
                    </Typography>
                    <Typography variant="h6">{statsData.engagement.videoCompletionRatePct}%</Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Parcours fréquents
                    </Typography>
                    {statsData.topPaths.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Aucun parcours enregistré.
                      </Typography>
                    )}
                    {statsData.topPaths.slice(0, 8).map((pathItem, index) => (
                      <Typography key={`${pathItem.path}-${index}`} variant="body2" sx={{ mb: 0.5 }}>
                        {index + 1}. {pathItem.path} · {pathItem.count}
                      </Typography>
                    ))}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Choix les plus cliqués
                    </Typography>
                    {statsData.topChoices.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Aucun clic sur bouton enregistré.
                      </Typography>
                    )}
                    {statsData.topChoices.slice(0, 8).map((choice, index) => (
                      <Typography
                        key={`${choice.buttonId || 'btn'}-${choice.targetNodeId || 'target'}-${index}`}
                        variant="body2"
                        sx={{ mb: 0.5 }}
                      >
                        {index + 1}. {choice.label || choice.buttonId || 'Bouton'}
                        {' → '}
                        {getNodeLabel(statsProjectId, choice.targetNodeId)} · {choice.count}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                <Divider />

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Nodes avec plus de trafic
                    </Typography>
                    {statsData.topNodes.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Aucun node visité.
                      </Typography>
                    )}
                    {statsData.topNodes.slice(0, 8).map((item) => (
                      <Typography key={item.nodeId} variant="body2" sx={{ mb: 0.5 }}>
                        {getNodeLabel(statsProjectId, item.nodeId)} · {item.count}
                      </Typography>
                    ))}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Points de drop-off
                    </Typography>
                    {statsData.dropOffNodes.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Pas de sortie partielle détectée.
                      </Typography>
                    )}
                    {statsData.dropOffNodes.slice(0, 8).map((item) => (
                      <Typography key={`drop-${item.nodeId}`} variant="body2" sx={{ mb: 0.5 }}>
                        {getNodeLabel(statsProjectId, item.nodeId)} · {item.count}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Événements captés ({statsData.totalEvents})
                  </Typography>
                  {statsData.eventTypeBreakdown.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Aucun événement.
                    </Typography>
                  )}
                  {statsData.eventTypeBreakdown.slice(0, 12).map((eventType) => (
                    <Typography key={eventType.eventType} variant="body2" sx={{ mb: 0.5 }}>
                      {eventType.eventType} · {eventType.count}
                    </Typography>
                  ))}
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeStatsDialog}>Fermer</Button>
            <Button
              onClick={() => {
                if (statsProject) {
                  void loadProjectStats(statsProject.id);
                }
              }}
              variant="contained"
              disabled={!statsProject || isStatsLoading}
            >
              Rafraîchir
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Dialog de création de projet */}
      {!isPublicMode && (
        <Dialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
        >
          <DialogTitle>Nouveau projet</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Nom du projet"
              fullWidth
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <TextField
              margin="dense"
              label="Description (optionnelle)"
              fullWidth
              multiline
              rows={3}
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsCreateDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateProject} variant="contained">
              Créer
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default ProjectLibrary;
