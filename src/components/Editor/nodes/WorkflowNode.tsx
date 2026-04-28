import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Hub as HubIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';
import type { MediaFile } from '../../../types/media';
import { WorkflowNodeData } from '../../../types/nodes';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';

interface WorkflowNodeProps {
  data: WorkflowNodeData;
  isConnectable: boolean;
}

interface WorkflowExecutionResponse {
  outputs?: MediaFile[];
  executedAt?: string;
  provider?: string;
  engine?: string;
  message?: string;
}

interface WorkflowCapabilitiesResponse {
  comfyui?: {
    configured?: boolean;
    reachable?: boolean;
    mode?: 'local' | 'cloud' | 'disabled';
    readyPresets?: string[];
    error?: string | null;
  };
  presets?: Partial<
    Record<
      WorkflowPresetKey,
      {
        executable?: boolean;
        provider?: 'comfyui' | 'server';
        fallbackProvider?: 'server' | null;
        comfyTemplateConfigured?: boolean;
      }
    >
  >;
}

type WorkflowPresetKey = NonNullable<WorkflowNodeData['workflowPreset']>;
type WorkflowStatusKey = NonNullable<WorkflowNodeData['status']>;
type WorkflowExecutionModeKey = NonNullable<WorkflowNodeData['executionMode']>;
type WorkflowInputKey = NonNullable<WorkflowNodeData['inputMode']>;
type WorkflowOutputKey = NonNullable<WorkflowNodeData['outputType']>;

const workflowPresetLabels: Record<WorkflowPresetKey, string> = {
  thumbnail_pack: 'Pack miniatures',
  style_transfer: 'Transfert de style',
  inpaint: 'Inpaint / remplacement',
  image_to_video: 'Image -> video',
  video_upscale: 'Upscale video',
  batch_variations: 'Variantes en lot',
};

const workflowPresetDescriptions: Record<
  WorkflowPresetKey,
  { summary: string; pipeline: string[]; resultLabel: string }
> = {
  thumbnail_pack: {
    summary:
      'Produit un pack de miniatures a partir d un media source. Cette V1 lance un vrai rendu serveur et renvoie les sorties dans la mediatheque.',
    pipeline: ['Source', 'Brief miniature', 'Traitement', 'Variantes', 'Sorties'],
    resultLabel: 'Miniature',
  },
  style_transfer: {
    summary:
      'Reprend un visuel ou une frame et lui applique une direction artistique cible.',
    pipeline: ['Source', 'Reference style', 'Transfert', 'Variantes', 'Retouches'],
    resultLabel: 'Variation stylee',
  },
  inpaint: {
    summary:
      'Modifie une zone ou remplace un element sans refaire tout le media.',
    pipeline: ['Source', 'Zone / masque', 'Prompt local', 'Generation', 'Sortie retouchee'],
    resultLabel: 'Retouche',
  },
  image_to_video: {
    summary:
      'Transforme une image en clip anime en conservant une direction de mouvement.',
    pipeline: ['Source image', 'Mouvement', 'Cadence', 'Generation clip', 'Sorties video'],
    resultLabel: 'Clip',
  },
  video_upscale: {
    summary:
      'Nettoie et upscale un rush ou un export pour une diffusion plus premium.',
    pipeline: ['Source video', 'Nettoyage', 'Upscale', 'Sharpen final', 'Export'],
    resultLabel: 'Master upscalé',
  },
  batch_variations: {
    summary:
      'Produit une serie de variantes pour tester plusieurs pistes creatives.',
    pipeline: ['Source', 'Prompt maitre', 'Variations', 'Scoring', 'Pack de sorties'],
    resultLabel: 'Variation',
  },
};

const workflowStatusLabels: Record<WorkflowStatusKey, string> = {
  draft: 'Brouillon',
  ready: 'Pret',
  queued: 'En file',
  running: 'En cours',
  done: 'Termine',
};

const workflowStatusColors: Record<
  WorkflowStatusKey,
  'default' | 'primary' | 'secondary' | 'success' | 'warning'
> = {
  draft: 'default',
  ready: 'primary',
  queued: 'secondary',
  running: 'warning',
  done: 'success',
};

const workflowExecutionModeLabels: Record<WorkflowExecutionModeKey, string> = {
  auto: 'Auto',
  local: 'Local',
  comfyui: 'ComfyUI',
};

const workflowInputLabels: Record<WorkflowInputKey, string> = {
  manual_upload: 'Upload manuel',
  media_library: 'Mediatheque',
  previous_node: 'Nœud precedent',
};

const workflowOutputLabels: Record<WorkflowOutputKey, string> = {
  image: 'Image',
  video: 'Video',
  image_batch: 'Lot d images',
  video_batch: 'Lot de videos',
};

const clampExpectedOutputs = (value: number) => Math.max(1, Math.min(24, Number(value) || 1));

const formatDateTime = (value: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('fr-FR');
};

const formatExecutionProviderLabel = (provider?: string, engine?: string) => {
  const normalizedProvider = String(provider || '').trim();
  const normalizedEngine = String(engine || '').trim();

  if (normalizedProvider === 'comfyui') {
    return normalizedEngine ? `ComfyUI • ${normalizedEngine}` : 'ComfyUI';
  }

  if (normalizedProvider === 'server') {
    return normalizedEngine ? `Local • ${normalizedEngine}` : 'Local';
  }

  return normalizedEngine || 'Moteur non defini';
};

const WorkflowNode = ({ data, isConnectable }: WorkflowNodeProps) => {
  const nodeId = data.id;
  const onDataChange = data.onDataChange;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [label, setLabel] = useState(data.label || 'Workflow IA');
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPresetKey>(
    data.workflowPreset || 'thumbnail_pack'
  );
  const [executionMode, setExecutionMode] = useState<WorkflowExecutionModeKey>(
    data.executionMode || 'local'
  );
  const [inputMode, setInputMode] = useState<WorkflowInputKey>(data.inputMode || 'media_library');
  const [outputType, setOutputType] = useState<WorkflowOutputKey>(
    data.outputType || 'image_batch'
  );
  const [status, setStatus] = useState<WorkflowStatusKey>(data.status || 'draft');
  const [expectedOutputs, setExpectedOutputs] = useState<number>(data.expectedOutputs || 4);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(data.negativePrompt || '');
  const [notes, setNotes] = useState(data.notes || '');
  const [sourceMediaId, setSourceMediaId] = useState(data.sourceMediaId || '');
  const [sourceMediaName, setSourceMediaName] = useState(data.sourceMediaName || '');
  const [sourceThumbnailUrl, setSourceThumbnailUrl] = useState(data.sourceThumbnailUrl || '');
  const [outputs, setOutputs] = useState<MediaFile[]>(Array.isArray(data.outputs) ? data.outputs : []);
  const [lastRunAt, setLastRunAt] = useState(data.lastRunAt || '');
  const [lastError, setLastError] = useState(data.lastError || '');
  const [lastExecutionProvider, setLastExecutionProvider] = useState(
    data.lastExecutionProvider || ''
  );
  const [lastExecutionEngine, setLastExecutionEngine] = useState(data.lastExecutionEngine || '');
  const [capabilities, setCapabilities] = useState<WorkflowCapabilitiesResponse | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState('');
  const isCompactModal = useMediaQuery('(max-width:1200px)');
  const isFullScreenModal = useMediaQuery('(max-width:900px)');

  useEffect(() => {
    setLabel(data.label || 'Workflow IA');
    setWorkflowPreset(data.workflowPreset || 'thumbnail_pack');
    setExecutionMode(data.executionMode || 'local');
    setInputMode(data.inputMode || 'media_library');
    setOutputType(data.outputType || 'image_batch');
    setStatus(data.status || 'draft');
    setExpectedOutputs(data.expectedOutputs || 4);
    setPrompt(data.prompt || '');
    setNegativePrompt(data.negativePrompt || '');
    setNotes(data.notes || '');
    setSourceMediaId(data.sourceMediaId || '');
    setSourceMediaName(data.sourceMediaName || '');
    setSourceThumbnailUrl(data.sourceThumbnailUrl || '');
    setOutputs(Array.isArray(data.outputs) ? data.outputs : []);
    setLastRunAt(data.lastRunAt || '');
    setLastError(data.lastError || '');
    setLastExecutionProvider(data.lastExecutionProvider || '');
    setLastExecutionEngine(data.lastExecutionEngine || '');
  }, [
    data.expectedOutputs,
    data.executionMode,
    data.inputMode,
    data.label,
    data.lastError,
    data.lastExecutionEngine,
    data.lastExecutionProvider,
    data.lastRunAt,
    data.negativePrompt,
    data.notes,
    data.outputType,
    data.outputs,
    data.prompt,
    data.sourceMediaId,
    data.sourceMediaName,
    data.sourceThumbnailUrl,
    data.status,
    data.workflowPreset,
  ]);

  const persistChanges = useCallback(
    (overrides: Partial<WorkflowNodeData> = {}) => {
      onDataChange?.({
        id: nodeId,
        label: label.trim() || 'Workflow IA',
        provider: 'workflow',
        workflowPreset,
        executionMode,
        inputMode,
        outputType,
        status,
        expectedOutputs: clampExpectedOutputs(expectedOutputs),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        notes: notes.trim(),
        sourceMediaId,
        sourceMediaName,
        sourceThumbnailUrl,
        outputs,
        lastRunAt,
        lastError,
        lastExecutionProvider,
        lastExecutionEngine,
        ...overrides,
      });
    },
    [
      expectedOutputs,
      executionMode,
      inputMode,
      label,
      lastError,
      lastRunAt,
      negativePrompt,
      notes,
      outputType,
      outputs,
      prompt,
      sourceMediaId,
      sourceMediaName,
      sourceThumbnailUrl,
      status,
      workflowPreset,
      lastExecutionProvider,
      lastExecutionEngine,
      nodeId,
      onDataChange,
    ]
  );

  const commitChanges = () => {
    persistChanges();
    setIsEditorOpen(false);
  };

  const activePreset = workflowPresetDescriptions[workflowPreset];
  const promptPreview = prompt.trim();
  const compactOutputCount = Math.min(
    outputs.length > 0 ? outputs.length : clampExpectedOutputs(expectedOutputs),
    4
  );
  const visibleOutputCount = Math.min(
    outputs.length > 0 ? outputs.length : clampExpectedOutputs(expectedOutputs),
    6
  );
  const sourceSummary = sourceMediaName || workflowInputLabels[inputMode];
  const presetCapabilities = capabilities?.presets?.[workflowPreset];
  const supportsExecution = Boolean(presetCapabilities?.executable ?? (workflowPreset === 'thumbnail_pack'));
  const comfyConfigured = Boolean(capabilities?.comfyui?.configured);
  const comfyReachable = Boolean(capabilities?.comfyui?.reachable);
  const comfyTemplateConfigured = Boolean(presetCapabilities?.comfyTemplateConfigured);
  const comfyReadyForPreset =
    presetCapabilities?.provider === 'comfyui' && comfyReachable && comfyTemplateConfigured;
  const selectedEngineLabel = workflowExecutionModeLabels[executionMode];
  const executionProviderLabel = formatExecutionProviderLabel(
    lastExecutionProvider,
    lastExecutionEngine
  );
  const executionBlockedReason = useMemo(() => {
    if (!supportsExecution) {
      return 'Seul le preset Pack miniatures est exécutable dans cette version.';
    }

    if (executionMode === 'comfyui') {
      if (!comfyConfigured) {
        return 'ComfyUI n est pas configuré côté serveur.';
      }
      if (!comfyTemplateConfigured) {
        return 'Le template ComfyUI de ce preset n est pas configuré.';
      }
      if (!comfyReachable) {
        return 'Le backend ComfyUI ne répond pas.';
      }
    }

    return '';
  }, [
    comfyConfigured,
    comfyReachable,
    comfyTemplateConfigured,
    executionMode,
    supportsExecution,
  ]);
  const selectedEngineSummary =
    executionMode === 'auto'
      ? comfyReadyForPreset
        ? 'Auto: ComfyUI si disponible, sinon local'
        : 'Auto: moteur local'
      : executionMode === 'comfyui'
        ? 'ComfyUI uniquement'
        : 'Moteur local uniquement';

  useEffect(() => {
    let isMounted = true;

    const loadCapabilities = async () => {
      try {
        const response = await fetch('/api/workflows/capabilities');
        const payload = (await response.json()) as WorkflowCapabilitiesResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Impossible de charger les capacites workflow.');
        }

        if (!isMounted) {
          return;
        }

        setCapabilities(payload);
        setCapabilitiesError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Impossible de charger les capacites workflow.';
        setCapabilitiesError(message);
      }
    };

    void loadCapabilities();

    return () => {
      isMounted = false;
    };
  }, []);

  const atelierSteps = useMemo(
    () => [
      {
        title: activePreset.pipeline[0],
        detail: sourceSummary,
      },
      {
        title: activePreset.pipeline[1],
        detail:
          prompt.trim() ||
          'Le brief creatif se pilote ici, sans exposer toute la plomberie technique.',
      },
      {
        title: activePreset.pipeline[2],
        detail: supportsExecution
          ? selectedEngineSummary
          : 'Preset structure, execution backend a brancher',
      },
      {
        title: activePreset.pipeline[3],
        detail: `${clampExpectedOutputs(expectedOutputs)} sortie(s) ciblees`,
      },
      {
        title: activePreset.pipeline[4],
        detail: workflowOutputLabels[outputType],
      },
    ],
    [
      activePreset.pipeline,
      expectedOutputs,
      outputType,
      prompt,
      selectedEngineSummary,
      sourceSummary,
      supportsExecution,
    ]
  );

  const renderedCompactOutputs = useMemo(() => {
    if (outputs.length > 0) {
      return outputs.slice(0, compactOutputCount);
    }

    return Array.from({ length: compactOutputCount }).map((_, index) => ({
      metadata: {
        id: `placeholder-${index}`,
        name: `${activePreset.resultLabel} ${index + 1}`,
        type: 'image' as const,
        mimeType: 'image/jpeg',
        size: 0,
        tags: [],
        createdAt: '',
        updatedAt: '',
      },
      url: '',
    }));
  }, [activePreset.resultLabel, compactOutputCount, outputs]);

  const renderedVisibleOutputs = useMemo(() => {
    if (outputs.length > 0) {
      return outputs.slice(0, visibleOutputCount);
    }

    return Array.from({ length: visibleOutputCount }).map((_, index) => ({
      metadata: {
        id: `placeholder-${index}`,
        name: `${activePreset.resultLabel} ${index + 1}`,
        type: outputType.includes('video') ? ('video' as const) : ('image' as const),
        mimeType: outputType.includes('video') ? 'video/mp4' : 'image/jpeg',
        size: 0,
        tags: [],
        createdAt: '',
        updatedAt: '',
      },
      url: '',
    }));
  }, [activePreset.resultLabel, outputType, outputs, visibleOutputCount]);

  const handleSourceMediaSelect = useCallback(
    (selectedMedia: MediaFile[]) => {
      const media = selectedMedia[0];
      if (!media) {
        return;
      }

      const nextSourceMediaId = media.metadata.id;
      const nextSourceMediaName = media.metadata.name;
      const nextSourceThumbnailUrl = media.thumbnailUrl || media.url;

      setSourceMediaId(nextSourceMediaId);
      setSourceMediaName(nextSourceMediaName);
      setSourceThumbnailUrl(nextSourceThumbnailUrl);
      setInputMode('media_library');
      setLastError('');
      persistChanges({
        inputMode: 'media_library',
        sourceMediaId: nextSourceMediaId,
        sourceMediaName: nextSourceMediaName,
        sourceThumbnailUrl: nextSourceThumbnailUrl,
        lastError: '',
      });
      setIsSourcePickerOpen(false);
    },
    [persistChanges]
  );

  const handleExecutePreset = useCallback(async () => {
    if (!supportsExecution) {
      const message = 'V1 exécutable disponible uniquement pour le preset Pack miniatures.';
      setLastError(message);
      persistChanges({ lastError: message });
      return;
    }

    if (executionBlockedReason) {
      setLastError(executionBlockedReason);
      persistChanges({ lastError: executionBlockedReason });
      return;
    }

    if (inputMode !== 'media_library') {
      const message =
        'La V1 du pack miniatures fonctionne avec une source choisie dans la médiathèque.';
      setLastError(message);
      persistChanges({ lastError: message });
      return;
    }

    if (!sourceMediaId) {
      const message = 'Choisis un média source avant de lancer le workflow.';
      setLastError(message);
      persistChanges({ lastError: message });
      return;
    }

    setIsExecuting(true);
    setStatus('running');
    setLastError('');
    persistChanges({
      status: 'running',
      lastError: '',
    });

    try {
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowPreset,
          executionMode,
          sourceMediaId,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          notes: notes.trim(),
          expectedOutputs: clampExpectedOutputs(expectedOutputs),
        }),
      });

      const payload = (await response.json()) as WorkflowExecutionResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Erreur workflow');
      }

      const nextOutputs = Array.isArray(payload.outputs) ? payload.outputs : [];
      const nextExecutedAt = payload.executedAt || new Date().toISOString();
      const nextProvider =
        payload.provider || (executionMode === 'comfyui' ? 'comfyui' : 'server');
      const nextEngine = payload.engine || '';

      setOutputs(nextOutputs);
      setLastRunAt(nextExecutedAt);
      setLastError('');
      setStatus('done');
      setLastExecutionProvider(nextProvider);
      setLastExecutionEngine(nextEngine);
      persistChanges({
        outputs: nextOutputs,
        lastRunAt: nextExecutedAt,
        lastError: '',
        status: 'done',
        lastExecutionProvider: nextProvider,
        lastExecutionEngine: nextEngine,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Impossible de lancer le workflow.';
      setLastError(message);
      setStatus('ready');
      persistChanges({
        lastError: message,
        status: 'ready',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [
    expectedOutputs,
    inputMode,
    negativePrompt,
    notes,
    persistChanges,
    prompt,
    executionBlockedReason,
    executionMode,
    sourceMediaId,
    supportsExecution,
    workflowPreset,
  ]);

  return (
    <>
      <Box
        onDoubleClick={() => setIsEditorOpen(true)}
        sx={{
          minWidth: 300,
          maxWidth: 340,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid rgba(110, 231, 183, 0.35)',
          background:
            'linear-gradient(180deg, rgba(6, 23, 23, 0.96) 0%, rgba(13, 34, 39, 0.98) 100%)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
        }}
      >
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
        <Handle type="target" position={Position.Left} isConnectable={isConnectable} />

        <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(110, 231, 183, 0.14)' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.25,
                display: 'grid',
                placeItems: 'center',
                background:
                  'linear-gradient(135deg, rgba(52, 211, 153, 0.18), rgba(45, 212, 191, 0.26))',
                color: '#9ff5d8',
              }}
            >
              <HubIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: '#f0fdf4', fontWeight: 800 }}
                noWrap
                title={data.label || label || 'Workflow IA'}
              >
                {data.label || label || 'Workflow IA'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(220,252,231,0.72)' }}>
                Workflow IA
              </Typography>
            </Box>
            <Chip
              size="small"
              label="PRO"
              sx={{
                bgcolor: 'rgba(250, 204, 21, 0.14)',
                color: '#fde68a',
                fontWeight: 700,
              }}
            />
          </Stack>
        </Box>

        <Stack spacing={1.1} sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              icon={<AutoAwesomeIcon />}
              label={workflowPresetLabels[workflowPreset]}
              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#d1fae5' }}
            />
            <Chip
              size="small"
              label={workflowStatusLabels[status]}
              color={workflowStatusColors[status]}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Moteur: ${selectedEngineLabel}`}
              sx={{
                bgcolor:
                  executionMode === 'comfyui'
                    ? 'rgba(45, 212, 191, 0.14)'
                    : executionMode === 'local'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(125, 211, 252, 0.14)',
                color:
                  executionMode === 'comfyui'
                    ? '#99f6e4'
                    : executionMode === 'local'
                      ? 'rgba(220,252,231,0.8)'
                      : '#bae6fd',
              }}
            />
          </Stack>

          <Typography variant="caption" sx={{ color: 'rgba(220,252,231,0.75)' }}>
            Source: {sourceMediaName || 'Aucune'} • Sortie: {workflowOutputLabels[outputType]} •{' '}
            {outputs.length > 0 ? outputs.length : clampExpectedOutputs(expectedOutputs)} sortie(s)
          </Typography>

          {(lastExecutionProvider || lastExecutionEngine) && (
            <Typography variant="caption" sx={{ color: 'rgba(153,246,228,0.82)' }}>
              Dernier moteur: {executionProviderLabel}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {renderedCompactOutputs.map((output, index) => {
              const previewUrl =
                ('thumbnailUrl' in output ? output.thumbnailUrl : undefined) || output.url || '';

              return (
                <Box
                  key={output.metadata.id || `compact-output-${index}`}
                  sx={{
                    aspectRatio: '16 / 10',
                    borderRadius: 1.5,
                    p: 1,
                    border: '1px solid rgba(255,255,255,0.07)',
                    backgroundImage: previewUrl
                      ? `linear-gradient(rgba(0,0,0,0.14), rgba(0,0,0,0.5)), url(${previewUrl})`
                      : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(110,231,183,0.08))',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#f0fdf4', fontWeight: 700 }}>
                    {activePreset.resultLabel} {index + 1}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box
            sx={{
              minHeight: 68,
              borderRadius: 1.5,
              px: 1.25,
              py: 1,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'rgba(167,243,208,0.74)', display: 'block', mb: 0.5 }}
            >
              Direction creative
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: promptPreview ? '#ecfdf5' : 'rgba(236,253,245,0.45)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {promptPreview ||
                'Double-clic pour ouvrir l atelier, choisir la source et lire les sorties.'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<ViewKanbanIcon />}
              onClick={() => setIsEditorOpen(true)}
              sx={{
                color: '#bbf7d0',
                borderColor: 'rgba(110, 231, 183, 0.28)',
              }}
            >
              Ouvrir l atelier
            </Button>
            {supportsExecution ? (
              <Button
                variant="contained"
                onClick={() => {
                  setIsEditorOpen(true);
                }}
                sx={{
                  background: 'linear-gradient(135deg, #22c55e, #14b8a6)',
                  color: '#052e16',
                  fontWeight: 800,
                }}
              >
                Lancer
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
      </Box>

      <Dialog
        open={isEditorOpen}
        onClose={() => {
          if (!isExecuting) {
            setIsEditorOpen(false);
          }
        }}
        fullWidth
        maxWidth="xl"
        fullScreen={isFullScreenModal}
        PaperProps={{
          sx: {
            background:
              'linear-gradient(180deg, rgba(7, 18, 18, 0.99) 0%, rgba(11, 24, 29, 0.995) 100%)',
            color: '#ecfdf5',
          },
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Atelier Workflow IA
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(220,252,231,0.72)', mt: 0.5 }}>
                  Le canevas principal reste narratif. Ici, on ouvre une vue simplifiee type ComfyUI,
                  focalisee sur les entrees, le pipeline et les sorties lisibles.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={workflowPresetLabels[workflowPreset]}
                  sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#d1fae5' }}
                />
                <Chip
                  label={workflowStatusLabels[status]}
                  color={workflowStatusColors[status]}
                  variant="outlined"
                />
                <Chip
                  label={`${outputs.length > 0 ? outputs.length : clampExpectedOutputs(expectedOutputs)} sortie(s)`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#d1fae5' }}
                />
                <Chip
                  label={`Mode: ${selectedEngineLabel}`}
                  sx={{
                    bgcolor:
                      executionMode === 'comfyui'
                        ? 'rgba(45, 212, 191, 0.14)'
                        : executionMode === 'local'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(125, 211, 252, 0.14)',
                    color:
                      executionMode === 'comfyui'
                        ? '#99f6e4'
                        : executionMode === 'local'
                          ? '#d1fae5'
                          : '#bae6fd',
                  }}
                />
              </Stack>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isCompactModal
                ? '1fr'
                : 'minmax(320px, 1.05fr) minmax(320px, 0.95fr) minmax(320px, 1fr)',
              gap: 2,
            }}
          >
            <Stack
              spacing={2}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Box>
                <Typography variant="overline" sx={{ color: '#86efac', letterSpacing: 1.1 }}>
                  Entrees
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Brief et sources
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(220,252,231,0.68)' }}>
                  Tu pilotes l intention sans faire entrer toute la complexite technique dans le canevas.
                </Typography>
              </Box>

              <TextField
                label="Nom du nœud"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                fullWidth
                disabled={isExecuting}
              />

              <FormControl fullWidth>
                <InputLabel id="workflow-preset-label">Preset</InputLabel>
                <Select
                  labelId="workflow-preset-label"
                  label="Preset"
                  value={workflowPreset}
                  onChange={(event) => setWorkflowPreset(event.target.value as WorkflowPresetKey)}
                  disabled={isExecuting}
                >
                  {Object.entries(workflowPresetLabels).map(([value, presetLabelValue]) => (
                    <MenuItem key={value} value={value}>
                      {presetLabelValue}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="workflow-engine-label">Moteur</InputLabel>
                <Select
                  labelId="workflow-engine-label"
                  label="Moteur"
                  value={executionMode}
                  onChange={(event) => setExecutionMode(event.target.value as WorkflowExecutionModeKey)}
                  disabled={isExecuting}
                >
                  {Object.entries(workflowExecutionModeLabels).map(([value, engineLabel]) => (
                    <MenuItem key={value} value={value}>
                      {engineLabel}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="workflow-input-label">Entree</InputLabel>
                  <Select
                    labelId="workflow-input-label"
                    label="Entree"
                    value={inputMode}
                    onChange={(event) => setInputMode(event.target.value as WorkflowInputKey)}
                    disabled={isExecuting}
                  >
                    {Object.entries(workflowInputLabels).map(([value, inputLabel]) => (
                      <MenuItem key={value} value={value}>
                        {inputLabel}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="workflow-output-label">Sortie</InputLabel>
                  <Select
                    labelId="workflow-output-label"
                    label="Sortie"
                    value={outputType}
                    onChange={(event) => setOutputType(event.target.value as WorkflowOutputKey)}
                    disabled={isExecuting}
                  >
                    {Object.entries(workflowOutputLabels).map(([value, outputLabel]) => (
                      <MenuItem key={value} value={value}>
                        {outputLabel}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Nombre de sorties attendues"
                  type="number"
                  value={expectedOutputs}
                  onChange={(event) => setExpectedOutputs(Number(event.target.value))}
                  inputProps={{ min: 1, max: 24 }}
                  fullWidth
                  disabled={isExecuting}
                />
                <FormControl fullWidth>
                  <InputLabel id="workflow-status-label">Statut</InputLabel>
                  <Select
                    labelId="workflow-status-label"
                    label="Statut"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as WorkflowStatusKey)}
                    disabled={isExecuting}
                  >
                    {Object.entries(workflowStatusLabels).map(([value, statusLabel]) => (
                      <MenuItem key={value} value={value}>
                        {statusLabel}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Box
                sx={{
                  borderRadius: 2,
                  p: 1.5,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="center">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Media source
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(220,252,231,0.7)' }}>
                      {sourceMediaName || 'Aucun media selectionne'}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={() => setIsSourcePickerOpen(true)}
                    disabled={isExecuting}
                    sx={{ color: '#bbf7d0', borderColor: 'rgba(110, 231, 183, 0.28)' }}
                  >
                    Choisir
                  </Button>
                </Stack>

                {sourceThumbnailUrl ? (
                  <Box
                    sx={{
                      mt: 1.5,
                      height: 160,
                      borderRadius: 1.5,
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.36)), url(${sourceThumbnailUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                ) : null}
              </Box>

              <TextField
                label="Prompt principal"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                multiline
                minRows={5}
                fullWidth
                helperText={activePreset.summary}
                disabled={isExecuting}
              />

              <TextField
                label="Negative prompt"
                value={negativePrompt}
                onChange={(event) => setNegativePrompt(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                disabled={isExecuting}
              />

              <TextField
                label="Notes d exploitation"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                multiline
                minRows={3}
                fullWidth
                disabled={isExecuting}
                helperText="Exemple: angle hero, texte court, version sans texte, publication manuelle."
              />
            </Stack>

            <Stack
              spacing={2}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Box>
                <Typography variant="overline" sx={{ color: '#7dd3fc', letterSpacing: 1.1 }}>
                  Workflow simplifie
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Arborescence lisible
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(220,252,231,0.68)' }}>
                  On montre la logique metier du pipeline, pas le graphe technique complet.
                </Typography>
              </Box>

              {capabilitiesError ? (
                <Alert severity="warning" sx={{ bgcolor: 'rgba(120,53,15,0.22)', color: '#ffedd5' }}>
                  Capacites serveur non lues: {capabilitiesError}
                </Alert>
              ) : null}

              {!supportsExecution ? (
                <Alert severity="info" sx={{ bgcolor: 'rgba(2,132,199,0.15)', color: '#e0f2fe' }}>
                  Pour l instant, seule la V1 du preset Pack miniatures est branchée en execution.
                </Alert>
              ) : executionBlockedReason ? (
                <Alert severity="warning" sx={{ bgcolor: 'rgba(120,53,15,0.22)', color: '#ffedd5' }}>
                  {executionBlockedReason}
                </Alert>
              ) : executionMode === 'comfyui' ? (
                <Alert severity="success" sx={{ bgcolor: 'rgba(20,184,166,0.12)', color: '#ccfbf1' }}>
                  Ce nœud exécutera ComfyUI uniquement. Si le backend ou le template manque,
                  le lancement sera refusé au lieu de masquer le problème.
                </Alert>
              ) : executionMode === 'auto' ? (
                <Alert severity="info" sx={{ bgcolor: 'rgba(2,132,199,0.15)', color: '#e0f2fe' }}>
                  Le mode auto choisit ComfyUI quand il est vraiment prêt, sinon le moteur local.
                </Alert>
              ) : (
                <Alert severity="success" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#dcfce7' }}>
                  Ce preset lance le moteur local uniquement, sans dépendre de ComfyUI.
                </Alert>
              )}

              <Stack spacing={1.25}>
                {atelierSteps.map((step, index) => (
                  <Box key={`${step.title}-${index}`}>
                    <Box
                      sx={{
                        borderRadius: 2,
                        p: 1.5,
                        border: '1px solid rgba(125, 211, 252, 0.18)',
                        background:
                          index === 0
                            ? 'linear-gradient(135deg, rgba(125,211,252,0.09), rgba(255,255,255,0.03))'
                            : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            borderRadius: 999,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: 'rgba(125, 211, 252, 0.14)',
                            color: '#bae6fd',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {step.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.35,
                              color: 'rgba(226, 232, 240, 0.74)',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {step.detail}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    {index < atelierSteps.length - 1 ? (
                      <Box
                        sx={{
                          ml: 1.75,
                          mt: 0.4,
                          mb: 0.4,
                          height: 18,
                          borderLeft: '2px solid rgba(125, 211, 252, 0.24)',
                        }}
                      />
                    ) : null}
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Box
                sx={{
                  borderRadius: 2,
                  p: 1.5,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Mode expert
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(226, 232, 240, 0.7)' }}>
                  Le choix du moteur est explicite. Le canevas reste propre, mais l execution n est
                  plus ambigue.
                </Typography>
              </Box>
            </Stack>

            <Stack
              spacing={2}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Box>
                <Typography variant="overline" sx={{ color: '#fcd34d', letterSpacing: 1.1 }}>
                  Resultats
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Sorties lisibles
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(220,252,231,0.68)' }}>
                  Une fois referme, le nœud principal reste clair: preset, statut, preview, compteur.
                </Typography>
              </Box>

              {lastError ? (
                <Alert severity="error" sx={{ bgcolor: 'rgba(127,29,29,0.2)', color: '#fee2e2' }}>
                  {lastError}
                </Alert>
              ) : null}

              <Box
                sx={{
                  borderRadius: 2,
                  p: 1.5,
                  background:
                    'linear-gradient(135deg, rgba(250,204,21,0.09), rgba(255,255,255,0.03))',
                  border: '1px solid rgba(250,204,21,0.18)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleOutlineIcon
                    sx={{ color: status === 'done' ? '#fde68a' : '#fcd34d' }}
                  />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Lecture resumee
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,248,220,0.78)' }}>
                      {workflowStatusLabels[status]} • {workflowPresetLabels[workflowPreset]} •{' '}
                      {outputs.length > 0 ? outputs.length : clampExpectedOutputs(expectedOutputs)} sortie(s)
                    </Typography>
                    {(lastExecutionProvider || lastExecutionEngine) && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,248,220,0.68)', display: 'block' }}>
                        Moteur utilise: {executionProviderLabel}
                      </Typography>
                    )}
                    {lastRunAt ? (
                      <Typography variant="caption" sx={{ color: 'rgba(255,248,220,0.68)' }}>
                        Derniere execution: {formatDateTime(lastRunAt)}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1,
                }}
              >
                {renderedVisibleOutputs.map((output, index) => {
                  const previewUrl =
                    ('thumbnailUrl' in output ? output.thumbnailUrl : undefined) || output.url || '';

                  return (
                    <Box
                      key={output.metadata.id || `workflow-output-preview-${index}`}
                      sx={{
                        aspectRatio: outputType.includes('video') ? '16 / 10' : '1 / 1',
                        borderRadius: 2,
                        p: 1.1,
                        border: '1px solid rgba(255,255,255,0.07)',
                        backgroundImage: previewUrl
                          ? `linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.5)), url(${previewUrl})`
                          : index % 2 === 0
                            ? 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(255,255,255,0.04))'
                            : 'linear-gradient(135deg, rgba(125,211,252,0.10), rgba(255,255,255,0.04))',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'rgba(236,253,245,0.72)' }}>
                        {activePreset.resultLabel}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {output.metadata.name || `Sortie ${index + 1}`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(236,253,245,0.68)' }}>
                        {output.metadata.type === 'video' ? 'Video' : 'Image'}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {outputs.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>
                  Aucune sortie pour le moment. Lance le preset pour remplir cette colonne.
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, md: 3 }, pb: 2.5, pt: 1.5 }}>
          <Button onClick={() => setIsEditorOpen(false)} disabled={isExecuting}>
            Fermer
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setStatus('ready');
              persistChanges({ status: 'ready' });
            }}
            disabled={isExecuting}
            sx={{ color: '#bae6fd', borderColor: 'rgba(125,211,252,0.32)' }}
          >
            Marquer pret
          </Button>
          <Button
            variant="outlined"
            onClick={handleExecutePreset}
            disabled={isExecuting || Boolean(executionBlockedReason) || !supportsExecution}
            sx={{ color: '#bbf7d0', borderColor: 'rgba(110,231,183,0.28)' }}
          >
            {isExecuting ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
                Lancement...
              </>
            ) : (
              'Lancer le preset'
            )}
          </Button>
          <Button
            variant="contained"
            onClick={commitChanges}
            disabled={isExecuting}
            sx={{
              background: 'linear-gradient(135deg, #22c55e, #14b8a6)',
              color: '#052e16',
              fontWeight: 800,
            }}
          >
            Enregistrer l atelier
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Choisir le media source</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <MediaLibrary onSelect={handleSourceMediaSelect} multiSelect={false} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSourcePickerOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default memo(WorkflowNode);
