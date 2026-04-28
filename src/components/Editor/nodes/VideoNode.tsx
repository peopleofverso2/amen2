import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Slider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { VideoNodeData } from '../../../types/nodes';

import VideoPlayer, { VideoPlayerHandle } from './video/VideoPlayer';
import VideoImportDialog from './video/VideoImportDialog';
import EmptyVideoState from './video/EmptyVideoState';
import useVideoNode from './video/useVideoNode';

interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  isConnectable: boolean;
  onCreateInteraction?: (sourceNodeId: string) => void;
}

interface AIGeneratedVideoResponse {
  url: string;
  sourceImageUrl?: string;
  provider?: string;
  model?: string;
  durationSeconds?: number;
  size?: string;
  soraVideoId?: string;
  metadata?: {
    name?: string;
  };
}

const MIN_TRIM_DURATION_SECONDS = 0.4;
const PREVIEW_SEEK_DEBOUNCE_MS = 90;
const TRIM_PREVIEW_SEEK_TOLERANCE_SECONDS = 0.35;
const TRIM_PREVIEW_SEEK_RETRY_DELAY_MS = 180;
const TRIM_PREVIEW_SEEK_STUCK_TIMEOUT_MS = 1400;
const TRIM_PREVIEW_MAX_SEEK_ATTEMPTS = 2;
const SORA_DURATION_OPTIONS = [4, 8, 12];
const DEFAULT_SORA_PROMPT = 'Travelling doux avec profondeur, mouvement cinématographique réaliste.';
const OPENAI_API_KEY_STORAGE_KEY = 'amen.openai.api_key';
const formatSeconds = (value: number) => `${Number(value).toFixed(1)}s`;
const roundTrimValue = (value: number) => Number(value.toFixed(2));

const closestSoraDuration = (value: number) =>
  SORA_DURATION_OPTIONS.reduce((closest, candidate) => {
    return Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest;
  }, SORA_DURATION_OPTIONS[0]);

const normalizeTrimRange = (
  inCandidate: number,
  outCandidate: number,
  maxValue: number
): [number, number] => {
  const safeMax = Math.max(0, maxValue);
  if (safeMax <= MIN_TRIM_DURATION_SECONDS) {
    return [0, roundTrimValue(safeMax)];
  }

  let nextIn = Math.max(0, Math.min(inCandidate, safeMax));
  let nextOut = Math.max(0, Math.min(outCandidate, safeMax));

  if (nextOut < nextIn) {
    [nextIn, nextOut] = [nextOut, nextIn];
  }

  if (nextOut - nextIn < MIN_TRIM_DURATION_SECONDS) {
    if (nextOut >= safeMax) {
      nextOut = safeMax;
      nextIn = Math.max(0, safeMax - MIN_TRIM_DURATION_SECONDS);
    } else {
      nextOut = Math.min(safeMax, nextIn + MIN_TRIM_DURATION_SECONDS);
    }
  }

  return [roundTrimValue(nextIn), roundTrimValue(nextOut)];
};

const VideoNode: React.FC<VideoNodeProps> = React.memo(
  ({ id, data, isConnectable, onCreateInteraction }) => {
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [isTrimPreviewPlaying, setIsTrimPreviewPlaying] = useState(false);
    const [isPreviewPlayerReady, setIsPreviewPlayerReady] = useState(false);
    const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState(DEFAULT_SORA_PROMPT);
    const [aiAnimate, setAiAnimate] = useState(true);
    const [aiDurationSeconds, setAiDurationSeconds] = useState(8);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiGenerationMode, setAiGenerationMode] = useState<'imageToVideo' | 'textToVideo'>(
      'imageToVideo'
    );
    const [aiModel, setAiModel] = useState<'sora-2' | 'sora-2-pro' | 'local-zoom'>('sora-2');
    const [aiImageFile, setAiImageFile] = useState<File | null>(null);
    const [aiImagePreviewUrl, setAiImagePreviewUrl] = useState<string | null>(null);
    const [aiFallbackToLocal, setAiFallbackToLocal] = useState(true);
    const [aiShowAdvanced, setAiShowAdvanced] = useState(false);
    const [aiApiKey, setAiApiKey] = useState<string>(() => {
      if (typeof window === 'undefined') {
        return '';
      }
      return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '';
    });
    const [aiPersistApiKey, setAiPersistApiKey] = useState<boolean>(() => {
      if (typeof window === 'undefined') {
        return false;
      }
      return Boolean(localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY));
    });
    const previewPlayerRef = useRef<VideoPlayerHandle | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const pendingSeekAppliedAtRef = useRef<number | null>(null);
    const pendingSeekAttemptsRef = useRef(0);
    const sliderSeekTimeoutRef = useRef<number | null>(null);

    const forceNativePreviewPlay = useCallback(() => {
      if (!previewPlayerRef.current) {
        return;
      }
      try {
        const internalPlayer = previewPlayerRef.current.getInternalPlayer?.() as
          | HTMLMediaElement
          | null;
        const playAttempt = internalPlayer?.play?.();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          void playAttempt.catch(() => undefined);
        }
      } catch (error) {
        console.error('Error forcing trim preview play:', error);
      }
    }, []);

    const clearPendingTrimSeek = useCallback(() => {
      pendingSeekRef.current = null;
      pendingSeekAppliedAtRef.current = null;
      pendingSeekAttemptsRef.current = 0;
    }, []);

    const applyTrimSeek = useCallback((targetSeconds: number) => {
      if (!previewPlayerRef.current) {
        return;
      }
      try {
        previewPlayerRef.current.seekTo(targetSeconds, 'seconds');
        pendingSeekAttemptsRef.current += 1;
        pendingSeekAppliedAtRef.current = Date.now();
      } catch (error) {
        console.error('Error applying trim preview seek:', error);
      }
    }, []);

    const setPreviewPlayerRef = useCallback(
      (player: VideoPlayerHandle | null) => {
        previewPlayerRef.current = player;
        if (!player) {
          return;
        }

        if (pendingSeekRef.current !== null) {
          applyTrimSeek(pendingSeekRef.current);
        }

        if (isTrimPreviewPlaying) {
          forceNativePreviewPlay();
        }
      },
      [isTrimPreviewPlaying, forceNativePreviewPlay, applyTrimSeek]
    );

    const handleDataChange = useCallback(
      (updates: Record<string, unknown>) => {
        if (data.onDataChange) {
          data.onDataChange({ ...updates, id });
        }
      },
      [data, id]
    );

    const {
      isOpen,
      isPlaying,
      showButtons,
      handleOpen,
      handleClose,
      handleSave,
      handleVideoEnd,
      handleError,
      handleButtonClick,
    } = useVideoNode({
      id,
      initialUrl: data.videoUrl,
      isPlaybackMode: data.isPlaybackMode,
      onDataChange: handleDataChange,
      onNavigate: data.onNavigate,
    });

    const handleCreateInteraction = useCallback(() => {
      if (onCreateInteraction) {
        onCreateInteraction(id);
      }
    }, [onCreateInteraction, id]);

    const sliderMax = useMemo(() => {
      if (Number.isFinite(videoDuration) && videoDuration > 0) {
        return videoDuration;
      }
      const fromData = Math.max(data.mediaIn ?? 0, data.mediaOut ?? 0, 30);
      return Math.max(fromData, 1);
    }, [videoDuration, data.mediaIn, data.mediaOut]);

    const committedRange = useMemo<[number, number]>(() => {
      return normalizeTrimRange(data.mediaIn ?? 0, data.mediaOut ?? sliderMax, sliderMax);
    }, [data.mediaIn, data.mediaOut, sliderMax]);

    const [sliderDraft, setSliderDraft] = useState<[number, number]>(committedRange);

    useEffect(() => {
      setSliderDraft(committedRange);
    }, [committedRange]);

    useEffect(() => {
      if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
        return;
      }

      const [nextIn, nextOut] = normalizeTrimRange(
        data.mediaIn ?? 0,
        data.mediaOut ?? videoDuration,
        videoDuration
      );

      if (nextIn !== (data.mediaIn ?? 0) || nextOut !== (data.mediaOut ?? videoDuration)) {
        handleDataChange({
          mediaIn: nextIn,
          mediaOut: nextOut,
        });
      }
    }, [videoDuration, data.mediaIn, data.mediaOut, handleDataChange]);

    useEffect(() => {
      return () => {
        if (aiImagePreviewUrl) {
          URL.revokeObjectURL(aiImagePreviewUrl);
        }
      };
    }, [aiImagePreviewUrl]);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      if (aiPersistApiKey && aiApiKey.trim()) {
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, aiApiKey.trim());
      } else {
        localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
      }
    }, [aiPersistApiKey, aiApiKey]);

    useEffect(
      () => () => {
        if (sliderSeekTimeoutRef.current !== null) {
          window.clearTimeout(sliderSeekTimeoutRef.current);
          sliderSeekTimeoutRef.current = null;
        }
      },
      []
    );

    useEffect(() => {
      setIsTrimPreviewPlaying(false);
      setIsPreviewPlayerReady(false);
      clearPendingTrimSeek();
      if (sliderSeekTimeoutRef.current !== null) {
        window.clearTimeout(sliderSeekTimeoutRef.current);
        sliderSeekTimeoutRef.current = null;
      }
    }, [data.videoUrl, clearPendingTrimSeek]);

    const handleDuration = useCallback((duration: number) => {
      if (Number.isFinite(duration) && duration > 0) {
        setVideoDuration(duration);
      }
    }, []);

    const startTrimPreview = useCallback(() => {
      if (!data.videoUrl) {
        return;
      }

      if (sliderSeekTimeoutRef.current !== null) {
        window.clearTimeout(sliderSeekTimeoutRef.current);
        sliderSeekTimeoutRef.current = null;
      }

      const [normalizedIn, normalizedOut] = normalizeTrimRange(sliderDraft[0], sliderDraft[1], sliderMax);
      if (normalizedIn !== sliderDraft[0] || normalizedOut !== sliderDraft[1]) {
        setSliderDraft([normalizedIn, normalizedOut]);
        handleDataChange({
          mediaIn: normalizedIn,
          mediaOut: normalizedOut,
        });
      }

      const maxStart =
        Number.isFinite(videoDuration) && videoDuration > MIN_TRIM_DURATION_SECONDS
          ? videoDuration - MIN_TRIM_DURATION_SECONDS
          : sliderMax;
      const startIn = Math.max(0, Math.min(normalizedIn, maxStart));
      if (startIn !== normalizedIn) {
        const correctedRange: [number, number] = [startIn, Math.max(startIn + MIN_TRIM_DURATION_SECONDS, normalizedOut)];
        setSliderDraft(correctedRange);
        handleDataChange({
          mediaIn: correctedRange[0],
          mediaOut: correctedRange[1],
        });
      }
      pendingSeekRef.current = startIn;
      pendingSeekAppliedAtRef.current = null;
      pendingSeekAttemptsRef.current = 0;
      setIsTrimPreviewPlaying(true);

      if (isPreviewPlayerReady && previewPlayerRef.current) {
        applyTrimSeek(startIn);
        forceNativePreviewPlay();
      }
    }, [
      data.videoUrl,
      sliderDraft,
      isPreviewPlayerReady,
      forceNativePreviewPlay,
      videoDuration,
      sliderMax,
      handleDataChange,
      applyTrimSeek,
    ]);

    const stopTrimPreview = useCallback(() => {
      clearPendingTrimSeek();
      if (sliderSeekTimeoutRef.current !== null) {
        window.clearTimeout(sliderSeekTimeoutRef.current);
        sliderSeekTimeoutRef.current = null;
      }
      setIsTrimPreviewPlaying(false);
    }, [clearPendingTrimSeek]);

    const queuePreviewSeek = useCallback(
      (seconds: number) => {
        const clampedSeconds = Math.max(0, Math.min(seconds, sliderMax));
        pendingSeekRef.current = clampedSeconds;
        pendingSeekAppliedAtRef.current = null;
        pendingSeekAttemptsRef.current = 0;

        if (sliderSeekTimeoutRef.current !== null) {
          window.clearTimeout(sliderSeekTimeoutRef.current);
        }

        sliderSeekTimeoutRef.current = window.setTimeout(() => {
          sliderSeekTimeoutRef.current = null;
          if (!isPreviewPlayerReady || !previewPlayerRef.current || pendingSeekRef.current === null) {
            return;
          }
          try {
            previewPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
            clearPendingTrimSeek();
          } catch (error) {
            console.error('Error seeking preview point:', error);
          }
        }, PREVIEW_SEEK_DEBOUNCE_MS);
      },
      [isPreviewPlayerReady, sliderMax, clearPendingTrimSeek]
    );

    const seekPreviewPoint = useCallback(
      (seconds: number) => {
        setIsTrimPreviewPlaying(false);
        queuePreviewSeek(seconds);
      },
      [queuePreviewSeek]
    );

    const handleMediaRangeDraftChange = useCallback(
      (_: Event, value: number | number[], activeThumb: number) => {
        if (!Array.isArray(value)) {
          return;
        }

        const [nextIn, nextOut] = normalizeTrimRange(value[0], value[1], sliderMax);
        setSliderDraft([nextIn, nextOut]);
        setIsTrimPreviewPlaying(false);

        const previewPoint = activeThumb === 0 ? nextIn : nextOut;
        queuePreviewSeek(previewPoint);
      },
      [sliderMax, queuePreviewSeek]
    );

    const handleMediaRangeCommit = useCallback(
      (_: Event | React.SyntheticEvent, value: number | number[]) => {
        if (!Array.isArray(value)) {
          return;
        }

        const [nextIn, nextOut] = normalizeTrimRange(value[0], value[1], sliderMax);
        setSliderDraft([nextIn, nextOut]);
        handleDataChange({
          mediaIn: nextIn,
          mediaOut: nextOut,
        });
      },
      [sliderMax, handleDataChange]
    );

    const handleTrimPreviewReady = useCallback(() => {
      setIsPreviewPlayerReady(true);
      if (pendingSeekRef.current !== null && previewPlayerRef.current) {
        applyTrimSeek(pendingSeekRef.current);
      }
      if (isTrimPreviewPlaying) {
        forceNativePreviewPlay();
      }
    }, [isTrimPreviewPlaying, forceNativePreviewPlay, applyTrimSeek]);

    const handleTrimPreviewSeek = useCallback(
      (seconds: number) => {
        const pendingTarget = pendingSeekRef.current;
        if (
          pendingTarget !== null &&
          seconds >= pendingTarget - TRIM_PREVIEW_SEEK_TOLERANCE_SECONDS
        ) {
          clearPendingTrimSeek();
        }
        if (!isTrimPreviewPlaying) {
          return;
        }
        const startIn = sliderDraft[0];
        if (seconds < startIn - TRIM_PREVIEW_SEEK_TOLERANCE_SECONDS) {
          return;
        }
        forceNativePreviewPlay();
      },
      [isTrimPreviewPlaying, sliderDraft, forceNativePreviewPlay, clearPendingTrimSeek]
    );

    const handleTrimPreviewProgress = useCallback(
      (state: { playedSeconds: number }) => {
        if (!isTrimPreviewPlaying) {
          return;
        }
        const [startIn, endOut] = sliderDraft;
        const safeEndOut =
          Number.isFinite(videoDuration) && videoDuration > 0 ? Math.min(endOut, videoDuration) : endOut;
        if (pendingSeekRef.current !== null) {
          const pendingTarget = pendingSeekRef.current;
          if (state.playedSeconds >= pendingTarget - TRIM_PREVIEW_SEEK_TOLERANCE_SECONDS) {
            clearPendingTrimSeek();
            forceNativePreviewPlay();
          } else {
            const now = Date.now();
            const lastAttemptAt = pendingSeekAppliedAtRef.current;
            const elapsedSinceAttempt =
              typeof lastAttemptAt === 'number' ? now - lastAttemptAt : Number.POSITIVE_INFINITY;

            if (
              pendingSeekAttemptsRef.current < TRIM_PREVIEW_MAX_SEEK_ATTEMPTS &&
              elapsedSinceAttempt >= TRIM_PREVIEW_SEEK_RETRY_DELAY_MS
            ) {
              applyTrimSeek(pendingTarget);
            } else if (elapsedSinceAttempt >= TRIM_PREVIEW_SEEK_STUCK_TIMEOUT_MS) {
              // Prevent hard freeze when seek callbacks are not emitted.
              clearPendingTrimSeek();
              forceNativePreviewPlay();
            }
            return;
          }
        }
        if (state.playedSeconds < startIn - TRIM_PREVIEW_SEEK_TOLERANCE_SECONDS) {
          return;
        }
        if (state.playedSeconds >= safeEndOut - 0.02) {
          stopTrimPreview();
          queuePreviewSeek(startIn);
        }
      },
      [
        isTrimPreviewPlaying,
        sliderDraft,
        stopTrimPreview,
        queuePreviewSeek,
        videoDuration,
        clearPendingTrimSeek,
        forceNativePreviewPlay,
        applyTrimSeek,
      ]
    );

    const isSoraModel = aiModel === 'sora-2' || aiModel === 'sora-2-pro';

    const handleAiImageSelection = useCallback((file: File | null) => {
      if (aiImagePreviewUrl) {
        URL.revokeObjectURL(aiImagePreviewUrl);
      }

      if (!file) {
        setAiImageFile(null);
        setAiImagePreviewUrl(null);
        return;
      }

      const nextPreviewUrl = URL.createObjectURL(file);
      setAiImageFile(file);
      setAiImagePreviewUrl(nextPreviewUrl);
    }, [aiImagePreviewUrl]);

    const handleOpenAIDialog = useCallback(() => {
      setAiError(null);
      setAiShowAdvanced(false);
      setAiGenerationMode('imageToVideo');
      setAiModel('sora-2');
      setIsAIDialogOpen(true);
    }, []);

    const handleCloseAIDialog = useCallback(() => {
      if (aiGenerating) {
        return;
      }
      setIsAIDialogOpen(false);
      setAiError(null);
    }, [aiGenerating]);

    const handleGenerateAIVideo = useCallback(async () => {
      const apiKeyOverride = aiApiKey.trim();
      setAiGenerating(true);
      setAiError(null);
      try {
        let response: Response;

        if (aiGenerationMode === 'imageToVideo') {
          if (!aiImageFile) {
            setAiError('Importe une image avant de générer la vidéo');
            return;
          }

          const formData = new FormData();
          formData.append('image', aiImageFile);
          formData.append('prompt', aiPrompt.trim() || DEFAULT_SORA_PROMPT);
          formData.append('model', isSoraModel ? aiModel : 'local-zoom');
          formData.append('durationSeconds', String(aiDurationSeconds));
          formData.append('size', '1280x720');
          formData.append('animate', String(aiAnimate));
          formData.append('fallbackToLocal', String(aiFallbackToLocal));
          if (apiKeyOverride) {
            formData.append('apiKey', apiKeyOverride);
          }

          response = await fetch('/api/ai/generate-video-from-image', {
            method: 'POST',
            body: formData,
          });
        } else {
          const trimmedPrompt = aiPrompt.trim();
          if (!trimmedPrompt) {
            setAiError('Le prompt est requis');
            return;
          }

          response = await fetch('/api/ai/generate-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: trimmedPrompt,
              animate: aiAnimate,
              durationSeconds: aiDurationSeconds,
              ...(apiKeyOverride ? { apiKey: apiKeyOverride } : {}),
            }),
          });
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Erreur IA');
        }

        const generated = payload as AIGeneratedVideoResponse;
        handleDataChange({
          videoUrl: generated.url,
          label: generated.metadata?.name || data.label || 'Vidéo IA',
          mediaIn: 0,
          mediaOut: Number((generated.durationSeconds ?? aiDurationSeconds).toFixed(2)),
        });
        setIsAIDialogOpen(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Impossible de générer la vidéo IA';
        setAiError(message);
      } finally {
        setAiGenerating(false);
      }
    }, [
      aiGenerationMode,
      aiImageFile,
      aiPrompt,
      aiModel,
      isSoraModel,
      aiApiKey,
      aiAnimate,
      aiDurationSeconds,
      aiFallbackToLocal,
      handleDataChange,
      data.label,
    ]);

    return (
      <Box sx={{ width: 350 }}>
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} />

        <Box
          sx={{
            bgcolor: '#2a2a2a',
            borderRadius: 1,
            p: 2,
            '&:hover': {
              '& .add-interaction': {
                opacity: 1,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography
              variant="h6"
              title={data.label || 'Nœud Vidéo'}
              noWrap
              sx={{
                color: 'white',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {data.label || 'Nœud Vidéo'}
            </Typography>
            {!data.isPlaybackMode && (
              <Stack direction="row" spacing={1}>
                <IconButton
                  className="add-interaction nodrag nopan"
                  onClick={handleOpenAIDialog}
                  sx={{
                    color: 'white',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  title="Générer avec IA"
                >
                  <AutoAwesomeIcon />
                </IconButton>
                <IconButton
                  className="add-interaction nodrag nopan"
                  onClick={handleCreateInteraction}
                  sx={{
                    color: 'white',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  title="Ajouter un bouton de choix"
                >
                  <AddIcon />
                </IconButton>
              </Stack>
            )}
          </Box>

          {!data.isPlaybackMode && (
            <Stack
              spacing={1}
              className="nodrag nopan"
              sx={{ mb: 2 }}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Découpe média
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => seekPreviewPoint(sliderDraft[0])}
                  disabled={!data.videoUrl}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.35)' }}
                >
                  IN
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => seekPreviewPoint(sliderDraft[1])}
                  disabled={!data.videoUrl}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.35)' }}
                >
                  OUT
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={isTrimPreviewPlaying ? <StopIcon /> : <PlayArrowIcon />}
                  onClick={isTrimPreviewPlaying ? stopTrimPreview : startTrimPreview}
                  disabled={!data.videoUrl}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.35)' }}
                >
                  {isTrimPreviewPlaying ? 'Stop' : 'Lire'}
                </Button>
              </Stack>
            </Stack>
              <Slider
                className="nodrag nopan"
                value={sliderDraft}
                min={0}
                max={Number(sliderMax.toFixed(2))}
                step={0.1}
                onChange={handleMediaRangeDraftChange}
                onChangeCommitted={handleMediaRangeCommit}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => formatSeconds(Number(value))}
                disableSwap
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                IN {formatSeconds(sliderDraft[0])} - OUT {formatSeconds(sliderDraft[1])}
              </Typography>
            </Stack>
          )}

          <Box
            onClick={!data.isPlaybackMode ? handleOpen : undefined}
            sx={{
              cursor: data.isPlaybackMode ? 'default' : 'pointer',
              position: 'relative',
            }}
          >
            {data.videoUrl ? (
              <VideoPlayer
                playerRef={setPreviewPlayerRef}
                url={data.videoUrl}
                isPlaybackMode={data.isPlaybackMode}
                mediaIn={sliderDraft[0]}
                mediaOut={sliderDraft[1]}
                applyMediaBounds={false}
                muted={!data.isPlaybackMode}
                playing={isTrimPreviewPlaying || isPlaying}
                showControls={false}
                onReady={handleTrimPreviewReady}
                onSeek={handleTrimPreviewSeek}
                onProgress={handleTrimPreviewProgress}
                progressInterval={200}
                onDuration={handleDuration}
                onEnded={() => {
                  stopTrimPreview();
                  queuePreviewSeek(sliderDraft[0]);
                  if (data.isPlaybackMode) {
                    handleVideoEnd();
                  }
                }}
                onError={() => {
                  stopTrimPreview();
                  handleError();
                }}
                buttons={
                  data.buttons?.map((button) => ({
                    ...button,
                    onClick: () => handleButtonClick(button.targetNodeId || ''),
                  })) || []
                }
                showButtons={showButtons}
              />
            ) : (
              <EmptyVideoState />
            )}
          </Box>
        </Box>

        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />

        <VideoImportDialog open={isOpen} onClose={handleClose} onSave={handleSave} />

        <Dialog open={isAIDialogOpen} onClose={handleCloseAIDialog} fullWidth maxWidth="sm">
          <DialogTitle>Générer une vidéo IA pour ce node</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {aiGenerationMode === 'imageToVideo' ? (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Importe une image, décris le mouvement, puis clique sur Générer.
                </Typography>
              ) : (
                <Alert severity="info">
                  Mode texte: le système génère d’abord une image puis la transforme en vidéo.
                </Alert>
              )}

              {aiGenerationMode === 'imageToVideo' && (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Chip label="Sora-2 recommandé" color="success" size="small" />
                    <Chip label="Image -> vidéo" color="default" size="small" />
                  </Stack>
                  <Button
                    component="label"
                    variant="outlined"
                    disabled={aiGenerating}
                    className="nodrag nopan"
                  >
                    {aiImageFile ? 'Changer l’image source' : 'Importer une image source'}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        handleAiImageSelection(file);
                        event.target.value = '';
                      }}
                    />
                  </Button>
                  {aiImageFile && (
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      Image: {aiImageFile.name}
                    </Typography>
                  )}
                  {aiImagePreviewUrl && (
                    <Box
                      component="img"
                      src={aiImagePreviewUrl}
                      alt="Aperçu image source"
                      sx={{
                        width: '100%',
                        maxHeight: 220,
                        objectFit: 'contain',
                        borderRadius: 1,
                        bgcolor: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    />
                  )}
                </Stack>
              )}

              <TextField
                label={aiGenerationMode === 'imageToVideo' ? 'Prompt de mouvement' : 'Prompt IA'}
                multiline
                minRows={3}
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder={
                  aiGenerationMode === 'imageToVideo'
                    ? 'Ex: caméra avance lentement, vent léger dans les cheveux, profondeur de champ cinéma'
                    : "Décris précisément l'image à générer..."
                }
                disabled={aiGenerating}
              />

              <Button
                size="small"
                onClick={() => setAiShowAdvanced((current) => !current)}
                sx={{ alignSelf: 'flex-start' }}
                disabled={aiGenerating}
              >
                {aiShowAdvanced ? 'Masquer options avancées' : 'Afficher options avancées'}
              </Button>

              <Collapse in={aiShowAdvanced}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="ai-mode-label">Mode IA</InputLabel>
                    <Select
                      labelId="ai-mode-label"
                      value={aiGenerationMode}
                      label="Mode IA"
                      onChange={(event) =>
                        setAiGenerationMode(event.target.value as 'imageToVideo' | 'textToVideo')
                      }
                      disabled={aiGenerating}
                    >
                      <MenuItem value="imageToVideo">Image importée -&gt; vidéo (recommandé)</MenuItem>
                      <MenuItem value="textToVideo">Prompt -&gt; image -&gt; vidéo</MenuItem>
                    </Select>
                  </FormControl>

                  {aiGenerationMode === 'imageToVideo' && (
                    <FormControl fullWidth size="small">
                      <InputLabel id="ai-model-label">Modèle vidéo</InputLabel>
                      <Select
                        labelId="ai-model-label"
                        value={aiModel}
                        label="Modèle vidéo"
                        onChange={(event) => {
                          const nextModel = event.target.value as
                            | 'sora-2'
                            | 'sora-2-pro'
                            | 'local-zoom';
                          setAiModel(nextModel);
                          if (nextModel === 'sora-2' || nextModel === 'sora-2-pro') {
                            setAiDurationSeconds((previous) => closestSoraDuration(previous));
                          }
                        }}
                        disabled={aiGenerating}
                      >
                        <MenuItem value="sora-2">Sora-2 (recommandé)</MenuItem>
                        <MenuItem value="sora-2-pro">Sora-2 Pro (qualité max)</MenuItem>
                        <MenuItem value="local-zoom">Local FFmpeg (sans modèle externe)</MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  <TextField
                    label="Clé API OpenAI (optionnel)"
                    type="password"
                    value={aiApiKey}
                    onChange={(event) => setAiApiKey(event.target.value)}
                    disabled={aiGenerating}
                    autoComplete="off"
                    placeholder="sk-..."
                    helperText="Utilisée pour les modèles Sora / image si la clé serveur n'est pas définie."
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={aiPersistApiKey}
                        onChange={(event) => setAiPersistApiKey(event.target.checked)}
                        disabled={aiGenerating}
                      />
                    }
                    label="Mémoriser la clé API localement"
                  />

                  {aiGenerationMode === 'imageToVideo' && isSoraModel && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={aiFallbackToLocal}
                          onChange={(event) => setAiFallbackToLocal(event.target.checked)}
                          disabled={aiGenerating}
                        />
                      }
                      label="Fallback local auto si le modèle vidéo échoue"
                    />
                  )}

                  <FormControlLabel
                    control={
                      <Switch
                        checked={aiAnimate}
                        onChange={(event) => setAiAnimate(event.target.checked)}
                        disabled={aiGenerating}
                      />
                    }
                    label={
                      aiGenerationMode === 'imageToVideo' && isSoraModel
                        ? 'Animation locale utilisée uniquement en fallback'
                        : 'Animer la vidéo (zoom doux)'
                    }
                  />

                  {aiGenerationMode === 'imageToVideo' && isSoraModel ? (
                    <FormControl fullWidth size="small">
                      <InputLabel id="ai-sora-duration-label">Durée vidéo</InputLabel>
                      <Select
                        labelId="ai-sora-duration-label"
                        value={closestSoraDuration(aiDurationSeconds)}
                        label="Durée vidéo"
                        onChange={(event) => setAiDurationSeconds(Number(event.target.value))}
                        disabled={aiGenerating}
                      >
                        {SORA_DURATION_OPTIONS.map((duration) => (
                          <MenuItem key={duration} value={duration}>
                            {duration}s
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        Durée vidéo: {aiDurationSeconds.toFixed(1)}s
                      </Typography>
                      <Slider
                        className="nodrag nopan"
                        value={aiDurationSeconds}
                        min={2}
                        max={20}
                        step={0.5}
                        onChange={(_, value) => {
                          if (!Array.isArray(value)) {
                            setAiDurationSeconds(value);
                          }
                        }}
                        disabled={aiGenerating}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => formatSeconds(Number(value))}
                      />
                    </Stack>
                  )}
                </Stack>
              </Collapse>

              {aiError && <Alert severity="error">{aiError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAIDialog} disabled={aiGenerating}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerateAIVideo}
              disabled={
                aiGenerating ||
                (aiGenerationMode === 'imageToVideo' && !aiImageFile) ||
                (aiGenerationMode === 'textToVideo' && !aiPrompt.trim())
              }
              startIcon={aiGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {aiGenerating ? 'Génération...' : 'Générer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
);

export default VideoNode;
