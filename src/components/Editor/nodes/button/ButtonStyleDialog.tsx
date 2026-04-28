import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ButtonNodeData } from '../../../../types/nodes';

type ButtonStyle = NonNullable<ButtonNodeData['style']>;
type ButtonEditorData = {
  text: string;
  style: ButtonStyle;
  variant: NonNullable<ButtonNodeData['variant']>;
  size: NonNullable<ButtonNodeData['size']>;
  icon?: ButtonNodeData['icon'];
  targetNodeId?: string;
};

const defaultStyle: ButtonStyle = {
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

const sizeStylePresets: Record<
  NonNullable<ButtonNodeData['size']>,
  { fontSize: string; padding: string; minWidth: string }
> = {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toNumber = (value: string, fallback: number): number => {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
};

const toPxNumber = (rawValue: string | undefined, fallback: number): number => {
  if (!rawValue) {
    return fallback;
  }

  const matched = rawValue.match(/-?\d+(\.\d+)?/);
  if (!matched) {
    return fallback;
  }

  const parsed = Number(matched[0]);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

const parsePadding = (
  rawPadding: string | undefined,
  fallbackVertical: number,
  fallbackHorizontal: number
): { vertical: number; horizontal: number } => {
  if (!rawPadding || !rawPadding.trim()) {
    return { vertical: fallbackVertical, horizontal: fallbackHorizontal };
  }

  const tokens = rawPadding
    .trim()
    .split(/\s+/)
    .map((token) => toPxNumber(token, Number.NaN))
    .filter((token) => Number.isFinite(token));

  if (tokens.length === 0) {
    return { vertical: fallbackVertical, horizontal: fallbackHorizontal };
  }

  if (tokens.length === 1) {
    return {
      vertical: tokens[0],
      horizontal: tokens[0],
    };
  }

  return {
    vertical: tokens[0],
    horizontal: tokens[1],
  };
};

const formatPadding = (vertical: number, horizontal: number) =>
  `${Math.round(vertical)}px ${Math.round(horizontal)}px`;

type PositionPreset = {
  id: string;
  horizontalAlign: NonNullable<ButtonStyle['horizontalAlign']>;
  verticalAlign: NonNullable<ButtonStyle['verticalAlign']>;
  label: string;
};

const positionPresets: PositionPreset[] = [
  { id: 'top-left', horizontalAlign: 'left', verticalAlign: 'top', label: 'HG' },
  { id: 'top-center', horizontalAlign: 'center', verticalAlign: 'top', label: 'H' },
  { id: 'top-right', horizontalAlign: 'right', verticalAlign: 'top', label: 'HD' },
  { id: 'center-left', horizontalAlign: 'left', verticalAlign: 'center', label: 'G' },
  { id: 'center', horizontalAlign: 'center', verticalAlign: 'center', label: 'C' },
  { id: 'center-right', horizontalAlign: 'right', verticalAlign: 'center', label: 'D' },
  { id: 'bottom-left', horizontalAlign: 'left', verticalAlign: 'bottom', label: 'BG' },
  { id: 'bottom-center', horizontalAlign: 'center', verticalAlign: 'bottom', label: 'B' },
  { id: 'bottom-right', horizontalAlign: 'right', verticalAlign: 'bottom', label: 'BD' },
];

type VisualPresetId = 'cta' | 'ghost' | 'pill' | 'danger';

type VisualPreset = {
  label: string;
  variant: NonNullable<ButtonNodeData['variant']>;
  size?: NonNullable<ButtonNodeData['size']>;
  style: Partial<ButtonStyle>;
};

const visualPresets: Record<VisualPresetId, VisualPreset> = {
  cta: {
    label: 'CTA',
    variant: 'contained',
    style: {
      backgroundColor: '#2563eb',
      textColor: '#ffffff',
      borderRadius: '8px',
      borderStyle: 'none',
      boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
      hoverBackgroundColor: '#1d4ed8',
      hoverTextColor: '#ffffff',
      hoverScale: '1.04',
    },
  },
  ghost: {
    label: 'Ghost',
    variant: 'outlined',
    style: {
      backgroundColor: 'transparent',
      textColor: '#e5e7eb',
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: '#e5e7eb',
      boxShadow: 'none',
      hoverBackgroundColor: 'rgba(255,255,255,0.08)',
      hoverTextColor: '#ffffff',
      hoverScale: '1.02',
    },
  },
  pill: {
    label: 'Pill',
    variant: 'contained',
    size: 'medium',
    style: {
      backgroundColor: '#16a34a',
      textColor: '#ffffff',
      borderRadius: '999px',
      borderStyle: 'none',
      padding: '10px 20px',
      boxShadow: '0 6px 14px rgba(22,163,74,0.35)',
      hoverBackgroundColor: '#15803d',
      hoverTextColor: '#ffffff',
      hoverScale: '1.04',
    },
  },
  danger: {
    label: 'Danger',
    variant: 'contained',
    style: {
      backgroundColor: '#dc2626',
      textColor: '#ffffff',
      borderRadius: '8px',
      borderStyle: 'none',
      boxShadow: '0 8px 20px rgba(220,38,38,0.35)',
      hoverBackgroundColor: '#b91c1c',
      hoverTextColor: '#ffffff',
      hoverScale: '1.03',
    },
  },
};

const STYLE_CLIPBOARD_STORAGE_KEY = 'amen_button_style_clipboard_v1';

interface ButtonStyleDialogProps {
  open: boolean;
  onClose: () => void;
  data: ButtonNodeData;
  onSave: (data: Partial<ButtonNodeData>) => void;
}

const ButtonStyleDialog: React.FC<ButtonStyleDialogProps> = ({
  open,
  onClose,
  data,
  onSave,
}) => {
  const [editData, setEditData] = React.useState<ButtonEditorData>({
    text: data.text || 'Nouveau bouton',
    style: {
      ...defaultStyle,
      ...(data.style || {}),
    },
    variant: data.variant || 'contained',
    size: data.size || 'medium',
    icon: data.icon,
    targetNodeId: data.targetNodeId,
  });
  const [editorMode, setEditorMode] = React.useState<'standard' | 'advanced'>('standard');
  const [positionViewport, setPositionViewport] = React.useState<'desktop' | 'mobile'>('desktop');
  const [hasClipboardStyle, setHasClipboardStyle] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setEditData({
      text: data.text || 'Nouveau bouton',
      style: {
        ...defaultStyle,
        ...(data.style || {}),
      },
      variant: data.variant || 'contained',
      size: data.size || 'medium',
      icon: data.icon,
      targetNodeId: data.targetNodeId,
    });
    setPositionViewport('desktop');

    if (typeof window !== 'undefined') {
      setHasClipboardStyle(Boolean(window.localStorage.getItem(STYLE_CLIPBOARD_STORAGE_KEY)));
    } else {
      setHasClipboardStyle(false);
    }
  }, [open, data]);

  const handleStyleChange = <K extends keyof ButtonStyle>(field: K, value: ButtonStyle[K]) => {
    setEditData((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave({
      text: editData.text,
      style: editData.style,
      variant: editData.variant,
      size: editData.size,
      icon: editData.icon,
      targetNodeId: editData.targetNodeId,
    });
    onClose();
  };

  const handleResetStyle = () => {
    setEditData((prev) => ({
      ...prev,
      style: { ...defaultStyle },
      variant: 'contained',
      size: 'medium',
    }));
  };

  const handleApplyVisualPreset = (presetId: VisualPresetId) => {
    const preset = visualPresets[presetId];
    setEditData((prev) => ({
      ...prev,
      variant: preset.variant,
      size: preset.size || prev.size,
      style: {
        ...prev.style,
        ...preset.style,
      },
    }));
    setEditorMode('advanced');
  };

  const handleCopyStyle = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      style: editData.style,
      variant: editData.variant,
      size: editData.size,
    };

    window.localStorage.setItem(STYLE_CLIPBOARD_STORAGE_KEY, JSON.stringify(payload));
    setHasClipboardStyle(true);
  };

  const handlePasteStyle = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawClipboard = window.localStorage.getItem(STYLE_CLIPBOARD_STORAGE_KEY);
      if (!rawClipboard) {
        return;
      }

      const parsed = JSON.parse(rawClipboard) as {
        style?: Partial<ButtonStyle>;
        variant?: ButtonEditorData['variant'];
        size?: ButtonEditorData['size'];
      };

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      setEditData((prev) => ({
        ...prev,
        variant: parsed.variant || prev.variant,
        size: parsed.size || prev.size,
        style: {
          ...defaultStyle,
          ...prev.style,
          ...(parsed.style || {}),
        },
      }));
    } catch {
      // ignore invalid clipboard payload
    }
  };

  const setViewportPositionMode = (value: 'flow' | 'absolute') => {
    if (positionViewport === 'mobile') {
      handleStyleChange('mobilePositionMode', value);
      return;
    }
    handleStyleChange('positionMode', value);
  };

  const setViewportHorizontalAlign = (value: 'left' | 'center' | 'right') => {
    if (positionViewport === 'mobile') {
      handleStyleChange('mobileHorizontalAlign', value);
      return;
    }
    handleStyleChange('horizontalAlign', value);
  };

  const setViewportVerticalAlign = (value: 'top' | 'center' | 'bottom') => {
    if (positionViewport === 'mobile') {
      handleStyleChange('mobileVerticalAlign', value);
      return;
    }
    handleStyleChange('verticalAlign', value);
  };

  const setViewportOffsetX = (value: number) => {
    if (positionViewport === 'mobile') {
      handleStyleChange('mobilePositionX', value);
      return;
    }
    handleStyleChange('positionX', value);
  };

  const setViewportOffsetY = (value: number) => {
    if (positionViewport === 'mobile') {
      handleStyleChange('mobilePositionY', value);
      return;
    }
    handleStyleChange('positionY', value);
  };

  const selectedHorizontalAlign =
    positionViewport === 'mobile'
      ? editData.style.mobileHorizontalAlign ||
        editData.style.horizontalAlign ||
        defaultStyle.mobileHorizontalAlign
      : editData.style.horizontalAlign || defaultStyle.horizontalAlign;
  const selectedVerticalAlign =
    positionViewport === 'mobile'
      ? editData.style.mobileVerticalAlign ||
        editData.style.verticalAlign ||
        defaultStyle.mobileVerticalAlign
      : editData.style.verticalAlign || defaultStyle.verticalAlign;
  const selectedPositionMode =
    positionViewport === 'mobile'
      ? editData.style.mobilePositionMode ||
        editData.style.positionMode ||
        defaultStyle.mobilePositionMode
      : editData.style.positionMode || defaultStyle.positionMode;
  const selectedPositionX =
    positionViewport === 'mobile'
      ? editData.style.mobilePositionX ??
        editData.style.positionX ??
        defaultStyle.mobilePositionX
      : editData.style.positionX ?? defaultStyle.positionX;
  const selectedPositionY =
    positionViewport === 'mobile'
      ? editData.style.mobilePositionY ??
        editData.style.positionY ??
        defaultStyle.mobilePositionY
      : editData.style.positionY ?? defaultStyle.positionY;
  const isAbsolutePosition = selectedPositionMode === 'absolute';

  const fontSizeValue = clamp(
    toPxNumber(editData.style.fontSize, toPxNumber(defaultStyle.fontSize, 14)),
    10,
    48
  );
  const borderRadiusValue = clamp(
    toPxNumber(editData.style.borderRadius, toPxNumber(defaultStyle.borderRadius, 4)),
    0,
    80
  );
  const borderWidthValue = clamp(
    toPxNumber(editData.style.borderWidth, toPxNumber(defaultStyle.borderWidth, 1)),
    0,
    12
  );
  const hoverScaleValue = clamp(
    Number.parseFloat(String(editData.style.hoverScale ?? defaultStyle.hoverScale ?? '1.05')),
    1,
    1.25
  );

  const defaultPadding = parsePadding(defaultStyle.padding, 8, 16);
  const currentPadding = parsePadding(
    editData.style.padding,
    defaultPadding.vertical,
    defaultPadding.horizontal
  );

  const previewPreset = sizeStylePresets[editData.size];
  const usesCustomFontSize = Boolean(
    editData.style.fontSize && editData.style.fontSize !== defaultStyle.fontSize
  );
  const usesCustomPadding = Boolean(editData.style.padding && editData.style.padding !== defaultStyle.padding);
  const previewLabel = editData.text.trim() || 'Nouveau bouton';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Personnaliser le bouton</DialogTitle>
      <DialogContent>
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Texte du bouton"
              value={editData.text}
              onChange={(e) => setEditData((prev) => ({ ...prev, text: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Niveau de réglage
            </Typography>
            <ToggleButtonGroup
              color="primary"
              fullWidth
              exclusive
              value={editorMode}
              onChange={(_, value) => {
                if (!value) {
                  return;
                }
                setEditorMode(value as 'standard' | 'advanced');
              }}
            >
              <ToggleButton value="standard">Standard</ToggleButton>
              <ToggleButton value="advanced">Avancé</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Presets rapides
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {Object.entries(visualPresets).map(([presetId, preset]) => (
                <Button
                  key={presetId}
                  size="small"
                  variant="outlined"
                  onClick={() => handleApplyVisualPreset(presetId as VisualPresetId)}
                >
                  {preset.label}
                </Button>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.14)',
                bgcolor: 'rgba(255,255,255,0.03)',
                p: 2,
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Aperçu live
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant={editData.variant}
                  size={editData.size}
                  sx={{
                    backgroundColor: editData.style.backgroundColor || defaultStyle.backgroundColor,
                    color: editData.style.textColor || defaultStyle.textColor,
                    borderRadius: editData.style.borderRadius || defaultStyle.borderRadius,
                    fontSize: usesCustomFontSize ? editData.style.fontSize : previewPreset.fontSize,
                    borderStyle: editData.style.borderStyle || defaultStyle.borderStyle,
                    borderColor: editData.style.borderColor || defaultStyle.borderColor,
                    borderWidth: editData.style.borderWidth || defaultStyle.borderWidth,
                    boxShadow: editData.style.boxShadow || defaultStyle.boxShadow,
                    padding: usesCustomPadding ? editData.style.padding : previewPreset.padding,
                    textAlign: editData.style.textAlign || defaultStyle.textAlign,
                    transition: editData.style.transition || defaultStyle.transition,
                    minWidth: previewPreset.minWidth,
                    '&:hover': {
                      backgroundColor:
                        editData.style.hoverBackgroundColor || defaultStyle.hoverBackgroundColor,
                      color: editData.style.hoverTextColor || defaultStyle.hoverTextColor,
                      transform: `scale(${editData.style.hoverScale || defaultStyle.hoverScale})`,
                    },
                  }}
                >
                  {previewLabel}
                </Button>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Structure
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Variante</InputLabel>
                  <Select
                    value={editData.variant}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        variant: e.target.value as NonNullable<ButtonNodeData['variant']>,
                      }))
                    }
                    label="Variante"
                  >
                    <MenuItem value="contained">Contained</MenuItem>
                    <MenuItem value="outlined">Outlined</MenuItem>
                    <MenuItem value="text">Text</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Taille</InputLabel>
                  <Select
                    value={editData.size}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        size: e.target.value as NonNullable<ButtonNodeData['size']>,
                      }))
                    }
                    label="Taille"
                  >
                    <MenuItem value="small">Petit</MenuItem>
                    <MenuItem value="medium">Moyen</MenuItem>
                    <MenuItem value="large">Grand</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Alignement du texte</InputLabel>
                  <Select
                    value={editData.style.textAlign || defaultStyle.textAlign}
                    onChange={(e) =>
                      handleStyleChange(
                        'textAlign',
                        e.target.value as NonNullable<ButtonStyle['textAlign']>
                      )
                    }
                    label="Alignement du texte"
                  >
                    <MenuItem value="left">Gauche</MenuItem>
                    <MenuItem value="center">Centre</MenuItem>
                    <MenuItem value="right">Droite</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {editorMode === 'advanced' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Style de bordure</InputLabel>
                    <Select
                      value={editData.style.borderStyle || defaultStyle.borderStyle}
                      onChange={(e) =>
                        handleStyleChange('borderStyle', e.target.value as ButtonStyle['borderStyle'])
                      }
                      label="Style de bordure"
                    >
                      <MenuItem value="none">Aucune</MenuItem>
                      <MenuItem value="solid">Pleine</MenuItem>
                      <MenuItem value="dashed">Pointillés</MenuItem>
                      <MenuItem value="dotted">Points</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Position
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <ToggleButtonGroup
                  color="primary"
                  fullWidth
                  exclusive
                  value={positionViewport}
                  onChange={(_, value) => {
                    if (!value) {
                      return;
                    }
                    setPositionViewport(value as 'desktop' | 'mobile');
                  }}
                >
                  <ToggleButton value="desktop">Desktop</ToggleButton>
                  <ToggleButton value="mobile">Mobile</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              <Grid item xs={12}>
                <ToggleButtonGroup
                  color="primary"
                  fullWidth
                  exclusive
                  value={selectedPositionMode}
                  onChange={(_, value) => {
                    if (!value) {
                      return;
                    }
                    setViewportPositionMode(value as NonNullable<ButtonStyle['positionMode']>);
                  }}
                >
                  <ToggleButton value="flow">Flux</ToggleButton>
                  <ToggleButton value="absolute">Libre</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {isAbsolutePosition && (
                <>
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 1,
                      }}
                    >
                      {positionPresets.map((preset) => {
                        const isSelected =
                          selectedHorizontalAlign === preset.horizontalAlign &&
                          selectedVerticalAlign === preset.verticalAlign;
                        return (
                          <Button
                            key={preset.id}
                            variant={isSelected ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => {
                              setViewportHorizontalAlign(preset.horizontalAlign);
                              setViewportVerticalAlign(preset.verticalAlign);
                            }}
                          >
                            {preset.label}
                          </Button>
                        );
                      })}
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Alignement horizontal</InputLabel>
                      <Select
                        value={selectedHorizontalAlign}
                        onChange={(e) =>
                          setViewportHorizontalAlign(
                            e.target.value as NonNullable<ButtonStyle['horizontalAlign']>
                          )
                        }
                        label="Alignement horizontal"
                      >
                        <MenuItem value="left">Gauche</MenuItem>
                        <MenuItem value="center">Centre</MenuItem>
                        <MenuItem value="right">Droite</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Alignement vertical</InputLabel>
                      <Select
                        value={selectedVerticalAlign}
                        onChange={(e) =>
                          setViewportVerticalAlign(
                            e.target.value as NonNullable<ButtonStyle['verticalAlign']>
                          )
                        }
                        label="Alignement vertical"
                      >
                        <MenuItem value="top">Haut</MenuItem>
                        <MenuItem value="center">Centre</MenuItem>
                        <MenuItem value="bottom">Bas</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Offset X (px)"
                      value={selectedPositionX}
                      onChange={(e) =>
                        setViewportOffsetX(
                          toNumber(
                            e.target.value,
                            positionViewport === 'mobile'
                              ? defaultStyle.mobilePositionX ?? 16
                              : defaultStyle.positionX ?? 24
                          )
                        )
                      }
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Offset Y (px)"
                      value={selectedPositionY}
                      onChange={(e) =>
                        setViewportOffsetY(
                          toNumber(
                            e.target.value,
                            positionViewport === 'mobile'
                              ? defaultStyle.mobilePositionY ?? 16
                              : defaultStyle.positionY ?? 24
                          )
                        )
                      }
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Couleurs
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 1 }}>
                  <Typography gutterBottom>Fond</Typography>
                  <input
                    type="color"
                    value={editData.style.backgroundColor}
                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    style={{ width: '100%', height: '40px' }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 1 }}>
                  <Typography gutterBottom>Texte</Typography>
                  <input
                    type="color"
                    value={editData.style.textColor}
                    onChange={(e) => handleStyleChange('textColor', e.target.value)}
                    style={{ width: '100%', height: '40px' }}
                  />
                </Box>
              </Grid>

              {editorMode === 'advanced' && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 1 }}>
                    <Typography gutterBottom>Bordure</Typography>
                    <input
                      type="color"
                      value={editData.style.borderColor}
                      onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </Box>
                </Grid>
              )}

              {editorMode === 'advanced' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Ombre"
                    value={editData.style.boxShadow}
                    onChange={(e) => handleStyleChange('boxShadow', e.target.value)}
                    placeholder="ex: 0 2px 6px rgba(0,0,0,0.3)"
                  />
                </Grid>
              )}
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Dimensions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography gutterBottom>Taille de police ({Math.round(fontSizeValue)}px)</Typography>
                <Slider
                  value={fontSizeValue}
                  onChange={(_, value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    handleStyleChange('fontSize', `${Math.round(next)}px`);
                  }}
                  min={10}
                  max={48}
                  step={1}
                  valueLabelDisplay="auto"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography gutterBottom>
                  Padding vertical ({Math.round(currentPadding.vertical)}px)
                </Typography>
                <Slider
                  value={clamp(currentPadding.vertical, 0, 40)}
                  onChange={(_, value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    handleStyleChange('padding', formatPadding(next, currentPadding.horizontal));
                  }}
                  min={0}
                  max={40}
                  step={1}
                  valueLabelDisplay="auto"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography gutterBottom>
                  Padding horizontal ({Math.round(currentPadding.horizontal)}px)
                </Typography>
                <Slider
                  value={clamp(currentPadding.horizontal, 0, 80)}
                  onChange={(_, value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    handleStyleChange('padding', formatPadding(currentPadding.vertical, next));
                  }}
                  min={0}
                  max={80}
                  step={1}
                  valueLabelDisplay="auto"
                />
              </Grid>

              {editorMode === 'advanced' && (
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Rayon ({Math.round(borderRadiusValue)}px)</Typography>
                  <Slider
                    value={borderRadiusValue}
                    onChange={(_, value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      handleStyleChange('borderRadius', `${Math.round(next)}px`);
                    }}
                    min={0}
                    max={80}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              )}

              {editorMode === 'advanced' && (
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Épaisseur bordure ({Math.round(borderWidthValue)}px)</Typography>
                  <Slider
                    value={borderWidthValue}
                    onChange={(_, value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      handleStyleChange('borderWidth', `${Math.round(next)}px`);
                    }}
                    min={0}
                    max={12}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              )}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {editorMode === 'advanced' && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Survol
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 1 }}>
                    <Typography gutterBottom>Fond (hover)</Typography>
                    <input
                      type="color"
                      value={editData.style.hoverBackgroundColor}
                      onChange={(e) => handleStyleChange('hoverBackgroundColor', e.target.value)}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 1 }}>
                    <Typography gutterBottom>Texte (hover)</Typography>
                    <input
                      type="color"
                      value={editData.style.hoverTextColor}
                      onChange={(e) => handleStyleChange('hoverTextColor', e.target.value)}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Animation
            </Typography>
            <Typography gutterBottom>Scale hover ({hoverScaleValue.toFixed(2)})</Typography>
            <Slider
              value={hoverScaleValue}
              onChange={(_, value) => {
                const next = Array.isArray(value) ? value[0] : value;
                handleStyleChange('hoverScale', next.toFixed(2));
              }}
              min={1}
              max={1.25}
              step={0.01}
              marks
              valueLabelDisplay="auto"
            />
            {editorMode === 'advanced' && (
              <TextField
                fullWidth
                label="Transition"
                value={editData.style.transition}
                onChange={(e) => handleStyleChange('transition', e.target.value)}
                placeholder="ex: all 0.3s ease"
                sx={{ mt: 2 }}
              />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleCopyStyle}>Copier style</Button>
          <Button onClick={handlePasteStyle} disabled={!hasClipboardStyle}>
            Coller style
          </Button>
          <Button onClick={handleResetStyle}>Réinitialiser</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Enregistrer
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ButtonStyleDialog;
