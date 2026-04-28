import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MovieIcon from '@mui/icons-material/Movie';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';
import { LocalStorageAdapter } from '../../../services/storage/LocalStorageAdapter';
import { MediaFile } from '../../../types/media';
import { Choice } from '../../../types/project';
import {
  ButtonAssetPlacement,
  ButtonAssetStyle,
  ButtonHorizontalAlign,
  ButtonPreset,
  ButtonSize,
  ButtonVariant,
  ButtonVerticalAlign,
} from '../../../types/buttonAsset';
import {
  BUTTON_PRESETS,
  DEFAULT_BUTTON_PLACEMENT,
  DEFAULT_BUTTON_STYLE,
  getChoiceButtonSx,
  getChoiceContainerSx,
  resolveButtonAssetStyle,
  resolveButtonPlacement,
} from './button/buttonAsset';

interface VideoNodeData {
  mediaId?: string;
  choices?: Choice[];
  onDataChange?: (id: string, data: Partial<VideoNodeData>) => void;
  isPlaybackMode?: boolean;
  onVideoEnd?: (id: string) => void;
  onChoiceSelect?: (id: string, choice: Choice) => void;
  isCurrentNode?: boolean;
  isPlaying?: boolean;
}

interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  selected?: boolean;
}

interface ChoiceDesignDialogProps {
  open: boolean;
  choice: Choice | null;
  onClose: () => void;
  onSave: (choice: Choice) => void;
}

const BUTTON_PRESET_OPTIONS: Array<{ value: ButtonPreset; label: string }> = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'danger', label: 'Danger' },
];

const BUTTON_VARIANT_OPTIONS: Array<{ value: ButtonVariant; label: string }> = [
  { value: 'contained', label: 'Contained' },
  { value: 'outlined', label: 'Outlined' },
  { value: 'text', label: 'Text' },
];

const BUTTON_SIZE_OPTIONS: Array<{ value: ButtonSize; label: string }> = [
  { value: 'small', label: 'Petit' },
  { value: 'medium', label: 'Moyen' },
  { value: 'large', label: 'Grand' },
];

const HORIZONTAL_OPTIONS: Array<{ value: ButtonHorizontalAlign; label: string }> = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
];

const VERTICAL_OPTIONS: Array<{ value: ButtonVerticalAlign; label: string }> = [
  { value: 'top', label: 'Haut' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom', label: 'Bas' },
];

const POSITION_PRESETS: Array<{ label: string; placement: ButtonAssetPlacement }> = [
  { label: 'Bas Centre', placement: { x: 50, y: 84, horizontal: 'center', vertical: 'center' } },
  { label: 'Bas Gauche', placement: { x: 8, y: 84, horizontal: 'left', vertical: 'center' } },
  { label: 'Bas Droite', placement: { x: 92, y: 84, horizontal: 'right', vertical: 'center' } },
  { label: 'Milieu Centre', placement: { x: 50, y: 50, horizontal: 'center', vertical: 'center' } },
  { label: 'Haut Centre', placement: { x: 50, y: 15, horizontal: 'center', vertical: 'center' } },
];

const createChoiceId = () => `choice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createDefaultChoice = (): Choice => ({
  id: createChoiceId(),
  text: 'Nouveau bouton',
  style: {
    preset: DEFAULT_BUTTON_STYLE.preset,
    variant: DEFAULT_BUTTON_STYLE.variant,
    size: DEFAULT_BUTTON_STYLE.size,
  },
  placement: { ...DEFAULT_BUTTON_PLACEMENT },
});

const normalizeChoice = (choice: Choice): Choice => ({
  ...choice,
  style: {
    preset: choice.style?.preset ?? DEFAULT_BUTTON_STYLE.preset,
    variant: choice.style?.variant ?? DEFAULT_BUTTON_STYLE.variant,
    size: choice.style?.size ?? DEFAULT_BUTTON_STYLE.size,
    backgroundColor: choice.style?.backgroundColor,
    textColor: choice.style?.textColor,
    borderColor: choice.style?.borderColor,
    borderStyle: choice.style?.borderStyle ?? DEFAULT_BUTTON_STYLE.borderStyle,
    borderWidth: choice.style?.borderWidth ?? DEFAULT_BUTTON_STYLE.borderWidth,
    borderRadius: choice.style?.borderRadius ?? DEFAULT_BUTTON_STYLE.borderRadius,
    fontSize: choice.style?.fontSize ?? DEFAULT_BUTTON_STYLE.fontSize,
    fontWeight: choice.style?.fontWeight ?? DEFAULT_BUTTON_STYLE.fontWeight,
    paddingX: choice.style?.paddingX ?? DEFAULT_BUTTON_STYLE.paddingX,
    paddingY: choice.style?.paddingY ?? DEFAULT_BUTTON_STYLE.paddingY,
    boxShadow: choice.style?.boxShadow ?? DEFAULT_BUTTON_STYLE.boxShadow,
    hoverBackgroundColor: choice.style?.hoverBackgroundColor,
    hoverTextColor: choice.style?.hoverTextColor,
    hoverBorderColor: choice.style?.hoverBorderColor,
    hoverScale: choice.style?.hoverScale ?? DEFAULT_BUTTON_STYLE.hoverScale,
    transitionMs: choice.style?.transitionMs ?? DEFAULT_BUTTON_STYLE.transitionMs,
    letterSpacing: choice.style?.letterSpacing ?? DEFAULT_BUTTON_STYLE.letterSpacing,
    textTransform: choice.style?.textTransform ?? DEFAULT_BUTTON_STYLE.textTransform,
    opacity: choice.style?.opacity ?? DEFAULT_BUTTON_STYLE.opacity,
  },
  placement: resolveButtonPlacement(choice.placement),
});

const ChoiceDesignDialog = ({ open, choice, onClose, onSave }: ChoiceDesignDialogProps) => {
  const [draft, setDraft] = useState<Choice | null>(choice ? normalizeChoice(choice) : null);

  useEffect(() => {
    setDraft(choice ? normalizeChoice(choice) : null);
  }, [choice]);

  const updateStyle = useCallback((updates: Partial<ButtonAssetStyle>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        style: {
          ...(current.style ?? {}),
          ...updates,
        },
      };
    });
  }, []);

  const updatePlacement = useCallback((updates: Partial<ButtonAssetPlacement>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const currentPlacement = resolveButtonPlacement(current.placement);
      return {
        ...current,
        placement: {
          ...currentPlacement,
          ...updates,
        },
      };
    });
  }, []);

  if (!draft) {
    return null;
  }

  const resolvedStyle = resolveButtonAssetStyle(draft.style);
  const resolvedPlacement = resolveButtonPlacement(draft.placement);
  const leftDistance = Math.round(resolvedPlacement.x);
  const rightDistance = Math.round(100 - resolvedPlacement.x);
  const topDistance = Math.round(resolvedPlacement.y);
  const bottomDistance = Math.round(100 - resolvedPlacement.y);
  const centerXOffset = Math.round(resolvedPlacement.x - 50);
  const centerYOffset = Math.round(resolvedPlacement.y - 50);
  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  const clampOffset = (value: number) => Math.min(50, Math.max(-50, value));
  const parseInput = (raw: string, fallback: number) => {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Personnaliser le bouton</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Texte du bouton"
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            fullWidth
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {POSITION_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="small"
                variant="outlined"
                onClick={() => updatePlacement(preset.placement)}
              >
                {preset.label}
              </Button>
            ))}
          </Stack>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              p: 2,
              bgcolor: 'rgba(0,0,0,0.02)',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Contraintes de position
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '88px minmax(180px, 1fr) 88px',
                gridTemplateRows: 'auto auto auto',
                gap: 1,
                alignItems: 'center',
                maxWidth: 430,
                mx: 'auto',
              }}
            >
              <Box />
              <TextField
                size="small"
                label="Haut"
                type="number"
                value={topDistance}
                onChange={(event) => {
                  const value = clampPercent(parseInput(event.target.value, topDistance));
                  updatePlacement({ y: value, vertical: 'top' });
                }}
              />
              <Box />

              <TextField
                size="small"
                label="Gauche"
                type="number"
                value={leftDistance}
                onChange={(event) => {
                  const value = clampPercent(parseInput(event.target.value, leftDistance));
                  updatePlacement({ x: value, horizontal: 'left' });
                }}
              />

              <Box
                sx={{
                  minHeight: 110,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.2,
                  bgcolor: 'background.paper',
                  p: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  + / Contraintes
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="dx"
                    type="number"
                    value={centerXOffset}
                    onChange={(event) => {
                      const value = clampOffset(parseInput(event.target.value, centerXOffset));
                      updatePlacement({ x: clampPercent(50 + value), horizontal: 'center' });
                    }}
                    sx={{ width: 74 }}
                  />
                  <TextField
                    size="small"
                    label="dy"
                    type="number"
                    value={centerYOffset}
                    onChange={(event) => {
                      const value = clampOffset(parseInput(event.target.value, centerYOffset));
                      updatePlacement({ y: clampPercent(50 + value), vertical: 'center' });
                    }}
                    sx={{ width: 74 }}
                  />
                </Stack>
              </Box>

              <TextField
                size="small"
                label="Droite"
                type="number"
                value={rightDistance}
                onChange={(event) => {
                  const value = clampPercent(parseInput(event.target.value, rightDistance));
                  updatePlacement({ x: clampPercent(100 - value), horizontal: 'right' });
                }}
              />

              <Box />
              <TextField
                size="small"
                label="Bas"
                type="number"
                value={bottomDistance}
                onChange={(event) => {
                  const value = clampPercent(parseInput(event.target.value, bottomDistance));
                  updatePlacement({ y: clampPercent(100 - value), vertical: 'bottom' });
                }}
              />
              <Box />
            </Box>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="horizontal-align-label">Horizontal</InputLabel>
              <Select
                labelId="horizontal-align-label"
                label="Horizontal"
                value={resolvedPlacement.horizontal}
                onChange={(event) =>
                  updatePlacement({
                    horizontal: event.target.value as ButtonHorizontalAlign,
                  })
                }
              >
                {HORIZONTAL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="vertical-align-label">Vertical</InputLabel>
              <Select
                labelId="vertical-align-label"
                label="Vertical"
                value={resolvedPlacement.vertical}
                onChange={(event) =>
                  updatePlacement({
                    vertical: event.target.value as ButtonVerticalAlign,
                  })
                }
              >
                {VERTICAL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="preset-label">Preset</InputLabel>
              <Select
                labelId="preset-label"
                label="Preset"
                value={resolvedStyle.preset}
                onChange={(event) => updateStyle({ preset: event.target.value as ButtonPreset })}
              >
                {BUTTON_PRESET_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="variant-label">Variante</InputLabel>
              <Select
                labelId="variant-label"
                label="Variante"
                value={resolvedStyle.variant}
                onChange={(event) => updateStyle({ variant: event.target.value as ButtonVariant })}
              >
                {BUTTON_VARIANT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="size-label">Taille</InputLabel>
              <Select
                labelId="size-label"
                label="Taille"
                value={resolvedStyle.size}
                onChange={(event) => updateStyle({ size: event.target.value as ButtonSize })}
              >
                {BUTTON_SIZE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fond"
              type="color"
              value={resolvedStyle.backgroundColor}
              onChange={(event) => updateStyle({ backgroundColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Texte"
              type="color"
              value={resolvedStyle.textColor}
              onChange={(event) => updateStyle({ textColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Bordure"
              type="color"
              value={resolvedStyle.borderColor}
              onChange={(event) => updateStyle({ borderColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fond hover"
              type="color"
              value={resolvedStyle.hoverBackgroundColor}
              onChange={(event) => updateStyle({ hoverBackgroundColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Texte hover"
              type="color"
              value={resolvedStyle.hoverTextColor}
              onChange={(event) => updateStyle({ hoverTextColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Bordure hover"
              type="color"
              value={resolvedStyle.hoverBorderColor}
              onChange={(event) => updateStyle({ hoverBorderColor: event.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="border-style-label">Style de bordure</InputLabel>
              <Select
                labelId="border-style-label"
                label="Style de bordure"
                value={resolvedStyle.borderStyle}
                onChange={(event) =>
                  updateStyle({
                    borderStyle: event.target.value as ButtonAssetStyle['borderStyle'],
                  })
                }
              >
                <MenuItem value="none">Aucune</MenuItem>
                <MenuItem value="solid">Solide</MenuItem>
                <MenuItem value="dashed">Pointillée</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Largeur bordure (px)"
              type="number"
              value={Number.parseInt(resolvedStyle.borderWidth, 10)}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                updateStyle({ borderWidth: `${Number.isFinite(value) ? value : 0}px` });
              }}
              fullWidth
            />

            <TextField
              label="Rayon (px)"
              type="number"
              value={Number.parseInt(resolvedStyle.borderRadius, 10)}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                updateStyle({ borderRadius: `${Number.isFinite(value) ? value : 0}px` });
              }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>
                Hover scale ({resolvedStyle.hoverScale.toFixed(2)})
              </Typography>
              <Slider
                value={resolvedStyle.hoverScale}
                min={1}
                max={1.25}
                step={0.01}
                onChange={(_, value) =>
                  updateStyle({
                    hoverScale: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>
                Font size ({Number.parseInt(resolvedStyle.fontSize, 10)}px)
              </Typography>
              <Slider
                value={Number.parseInt(resolvedStyle.fontSize, 10)}
                min={10}
                max={32}
                onChange={(_, value) =>
                  updateStyle({
                    fontSize: `${Array.isArray(value) ? value[0] : value}px`,
                  })
                }
              />
            </Box>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>Poids ({resolvedStyle.fontWeight})</Typography>
              <Slider
                value={resolvedStyle.fontWeight}
                min={300}
                max={900}
                step={100}
                onChange={(_, value) =>
                  updateStyle({
                    fontWeight: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>Padding X ({resolvedStyle.paddingX.toFixed(1)})</Typography>
              <Slider
                value={resolvedStyle.paddingX}
                min={0}
                max={6}
                step={0.1}
                onChange={(_, value) =>
                  updateStyle({
                    paddingX: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>Padding Y ({resolvedStyle.paddingY.toFixed(1)})</Typography>
              <Slider
                value={resolvedStyle.paddingY}
                min={0}
                max={4}
                step={0.1}
                onChange={(_, value) =>
                  updateStyle({
                    paddingY: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>
            <Box sx={{ width: '100%' }}>
              <Typography gutterBottom>Transition ({resolvedStyle.transitionMs}ms)</Typography>
              <Slider
                value={resolvedStyle.transitionMs}
                min={0}
                max={500}
                step={10}
                onChange={(_, value) =>
                  updateStyle({
                    transitionMs: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>
          </Stack>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              p: 2,
              display: 'flex',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.02)',
            }}
          >
            <Button
              variant={resolvedStyle.variant}
              size={resolvedStyle.size}
              sx={getChoiceButtonSx(draft.style)}
            >
              {draft.text || 'Aperçu'}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function VideoNode2({ id, data, selected }: VideoNodeProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditingButtons, setIsEditingButtons] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [choiceUnderDesign, setChoiceUnderDesign] = useState<Choice | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageAdapter = useRef(LocalStorageAdapter.getInstance());
  const [videoUrl, setVideoUrl] = useState<string>();

  const choices = useMemo(
    () => (data.choices ?? []).map((choice) => normalizeChoice(choice)),
    [data.choices]
  );

  const updateChoices = useCallback(
    (nextChoices: Choice[]) => {
      data.onDataChange?.(id, { choices: nextChoices });
    },
    [data.onDataChange, id]
  );

  const loadVideo = useCallback(async () => {
    if (!data.mediaId) {
      setVideoUrl(undefined);
      return;
    }

    try {
      const mediaFile = await storageAdapter.current.getMedia(data.mediaId);
      if (mediaFile?.url) {
        setVideoUrl(mediaFile.url);
      } else {
        setVideoUrl(undefined);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoUrl(undefined);
    }
  }, [data.mediaId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  useEffect(() => {
    if (data.isPlaying && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [data.isPlaying]);

  const handleVideoEnd = useCallback(() => {
    data.onVideoEnd?.(id);
  }, [data.onVideoEnd, id]);

  const handleChoiceClick = useCallback(
    (choice: Choice) => {
      if (!data.isPlaybackMode) {
        return;
      }
      data.onChoiceSelect?.(id, choice);
    },
    [data.isPlaybackMode, data.onChoiceSelect, id]
  );

  const handlePlayPause = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!videoRef.current) {
        return;
      }

      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    },
    [isPlaying]
  );

  const handleMediaSelect = useCallback(
    (mediaFiles: MediaFile[]) => {
      if (!mediaFiles.length || !data.onDataChange) {
        return;
      }

      const mediaFile = mediaFiles[0];
      const mediaId = mediaFile.metadata?.id;
      if (!mediaId) {
        console.error('Selected media is missing metadata.id');
        return;
      }

      data.onDataChange(id, { mediaId });
      setIsDialogOpen(false);
    },
    [data.onDataChange, id]
  );

  const handleAddChoice = useCallback(() => {
    updateChoices([...choices, createDefaultChoice()]);
  }, [choices, updateChoices]);

  const handleChoiceTextChange = useCallback(
    (choiceId: string, text: string) => {
      updateChoices(
        choices.map((choice) => (choice.id === choiceId ? { ...choice, text } : choice))
      );
    },
    [choices, updateChoices]
  );

  const handleDeleteChoice = useCallback(
    (choiceId: string) => {
      updateChoices(choices.filter((choice) => choice.id !== choiceId));
      setChoiceUnderDesign((current) => (current?.id === choiceId ? null : current));
    },
    [choices, updateChoices]
  );

  const handleChoiceDesignSave = useCallback(
    (updatedChoice: Choice) => {
      updateChoices(
        choices.map((choice) => (choice.id === updatedChoice.id ? normalizeChoice(updatedChoice) : choice))
      );
    },
    [choices, updateChoices]
  );

  const renderChoiceButtons = () => {
    if (!choices.length) {
      return null;
    }

    return choices.map((choice) => {
      const resolvedStyle = resolveButtonAssetStyle(choice.style);
      const isEditing = !data.isPlaybackMode;

      return (
        <Box
          key={choice.id}
          sx={{
            ...getChoiceContainerSx(choice.placement),
            zIndex: 3,
          }}
        >
          <Button
            variant={resolvedStyle.variant}
            size={resolvedStyle.size}
            onClick={() => {
              if (isEditing) {
                setChoiceUnderDesign(choice);
                return;
              }
              handleChoiceClick(choice);
            }}
            sx={{
              ...getChoiceButtonSx(choice.style),
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              cursor: isEditing ? 'pointer' : 'default',
              outline: isEditing ? '1px dashed rgba(255,255,255,0.45)' : 'none',
              outlineOffset: isEditing ? '2px' : 0,
            }}
          >
            {choice.text || 'Continuer'}
          </Button>

          {isEditing && (
            <Handle
              type="source"
              position={Position.Right}
              id={`button-handle-${choice.id}`}
              style={{
                right: -18,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
                background: '#101828',
                border: '2px solid #fff',
                zIndex: 1000,
                cursor: 'crosshair',
              }}
            />
          )}
        </Box>
      );
    });
  };

  return (
    <Box
      sx={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      <Paper
        elevation={selected ? 8 : isHovered ? 4 : 1}
        sx={{
          width: 320,
          borderRadius: 2,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          border: selected ? '2px solid' : '2px solid transparent',
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: 'background.paper',
          '&:hover': {
            transform: data.isPlaybackMode ? 'none' : 'translateY(-2px)',
          },
        }}
      >
        {!videoUrl ? (
          <Box
            onClick={() => !data.isPlaybackMode && setIsDialogOpen(true)}
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: data.isPlaybackMode ? 'default' : 'pointer',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              m: 2,
              backgroundColor: 'action.hover',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.selected',
              },
            }}
          >
            <MovieIcon sx={{ fontSize: 48, color: 'action.active' }} />
            <Typography variant="body1" color="text.secondary">
              Add Video
            </Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ position: 'relative' }}>
              <video
                ref={videoRef}
                src={videoUrl}
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: '8px 8px 0 0',
                }}
                onEnded={handleVideoEnd}
                controls={!data.isPlaybackMode}
                playsInline
              />

              {!data.isPlaybackMode && (
                <Fade in={isHovered}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.4)',
                      transition: 'opacity 0.2s',
                      borderRadius: '8px 8px 0 0',
                      pointerEvents: 'none',
                    }}
                  >
                    <IconButton
                      onClick={handlePlayPause}
                      sx={{
                        color: 'white',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        pointerEvents: 'auto',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>
                  </Box>
                </Fade>
              )}

              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'auto',
                }}
              >
                {renderChoiceButtons()}
              </Box>
            </Box>

            {!data.isPlaybackMode && (
              <Box sx={{ p: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditingButtons(true)}
                >
                  Edit Choices
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Select Video</DialogTitle>
        <DialogContent>
          <MediaLibrary onSelect={handleMediaSelect} multiSelect={false} acceptedTypes={['video/*']} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditingButtons}
        onClose={() => setIsEditingButtons(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Choices</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {choices.map((choice) => {
              const placement = resolveButtonPlacement(choice.placement);
              const presetLabel = choice.style?.preset ? BUTTON_PRESETS[choice.style.preset] : null;

              return (
                <Stack
                  key={choice.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    value={choice.text}
                    onChange={(event) => handleChoiceTextChange(choice.id, event.target.value)}
                  />

                  <Tooltip title={`X ${Math.round(placement.x)}% | Y ${Math.round(placement.y)}%`}>
                    <Box
                      sx={{
                        width: 48,
                        height: 34,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: presetLabel?.backgroundColor ?? 'background.default',
                        color: presetLabel?.textColor ?? 'text.primary',
                        fontSize: 12,
                      }}
                    >
                      {Math.round(placement.x)}
                    </Box>
                  </Tooltip>

                  <Tooltip title="Style et position">
                    <IconButton onClick={() => setChoiceUnderDesign(choice)}>
                      <TuneIcon />
                    </IconButton>
                  </Tooltip>

                  <IconButton color="error" onClick={() => handleDeleteChoice(choice.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              );
            })}

            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddChoice}>
              Add Choice
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditingButtons(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <ChoiceDesignDialog
        open={Boolean(choiceUnderDesign)}
        choice={choiceUnderDesign}
        onClose={() => setChoiceUnderDesign(null)}
        onSave={handleChoiceDesignSave}
      />
    </Box>
  );
}
