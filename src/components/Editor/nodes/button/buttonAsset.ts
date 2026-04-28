import type { SxProps, Theme } from '@mui/material';
import {
  ButtonAssetPlacement,
  ButtonAssetStyle,
  ButtonHorizontalAlign,
  ButtonPreset,
  ButtonSize,
  ButtonVariant,
  ButtonVerticalAlign,
} from '../../../../types/buttonAsset';

interface PresetPalette {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  hoverBackgroundColor: string;
  hoverTextColor: string;
  hoverBorderColor: string;
}

export const BUTTON_PRESETS: Record<ButtonPreset, PresetPalette> = {
  primary: {
    backgroundColor: '#2E7DFF',
    textColor: '#FFFFFF',
    borderColor: '#2E7DFF',
    hoverBackgroundColor: '#1E5FD0',
    hoverTextColor: '#FFFFFF',
    hoverBorderColor: '#1E5FD0',
  },
  secondary: {
    backgroundColor: '#222A35',
    textColor: '#F4F7FF',
    borderColor: '#384355',
    hoverBackgroundColor: '#1A202A',
    hoverTextColor: '#FFFFFF',
    hoverBorderColor: '#445068',
  },
  ghost: {
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
    borderColor: '#D1D5DB',
    hoverBackgroundColor: '#F3F4F6',
    hoverTextColor: '#111827',
    hoverBorderColor: '#9CA3AF',
  },
  danger: {
    backgroundColor: '#DC2626',
    textColor: '#FFFFFF',
    borderColor: '#B91C1C',
    hoverBackgroundColor: '#B91C1C',
    hoverTextColor: '#FFFFFF',
    hoverBorderColor: '#991B1B',
  },
};

export const DEFAULT_BUTTON_STYLE: Required<
  Omit<
    ButtonAssetStyle,
    | 'backgroundColor'
    | 'textColor'
    | 'borderColor'
    | 'hoverBackgroundColor'
    | 'hoverTextColor'
    | 'hoverBorderColor'
  >
> = {
  preset: 'primary',
  variant: 'contained',
  size: 'medium',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600,
  paddingX: 2.5,
  paddingY: 1.1,
  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  hoverScale: 1.03,
  transitionMs: 180,
  letterSpacing: '0.01em',
  textTransform: 'none',
  opacity: 1,
};

export const DEFAULT_BUTTON_PLACEMENT: ButtonAssetPlacement = {
  x: 50,
  y: 82,
  horizontal: 'center',
  vertical: 'center',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizePx = (value: string | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  if (value.trim().endsWith('px')) {
    return value;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed)) {
    return `${parsed}px`;
  }

  return fallback;
};

const resolvePalette = (style?: ButtonAssetStyle) => {
  const preset = style?.preset ?? DEFAULT_BUTTON_STYLE.preset;
  const base = BUTTON_PRESETS[preset];

  return {
    backgroundColor: style?.backgroundColor ?? base.backgroundColor,
    textColor: style?.textColor ?? base.textColor,
    borderColor: style?.borderColor ?? base.borderColor,
    hoverBackgroundColor: style?.hoverBackgroundColor ?? base.hoverBackgroundColor,
    hoverTextColor: style?.hoverTextColor ?? base.hoverTextColor,
    hoverBorderColor: style?.hoverBorderColor ?? base.hoverBorderColor,
  };
};

export interface ResolvedButtonAssetStyle {
  preset: ButtonPreset;
  variant: ButtonVariant;
  size: ButtonSize;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderStyle: ButtonAssetStyle['borderStyle'];
  borderWidth: string;
  borderRadius: string;
  fontSize: string;
  fontWeight: number;
  paddingX: number;
  paddingY: number;
  boxShadow: string;
  hoverBackgroundColor: string;
  hoverTextColor: string;
  hoverBorderColor: string;
  hoverScale: number;
  transitionMs: number;
  letterSpacing: string;
  textTransform: NonNullable<ButtonAssetStyle['textTransform']>;
  opacity: number;
}

export const resolveButtonAssetStyle = (style?: ButtonAssetStyle): ResolvedButtonAssetStyle => {
  const palette = resolvePalette(style);

  return {
    preset: style?.preset ?? DEFAULT_BUTTON_STYLE.preset,
    variant: style?.variant ?? DEFAULT_BUTTON_STYLE.variant,
    size: style?.size ?? DEFAULT_BUTTON_STYLE.size,
    backgroundColor: palette.backgroundColor,
    textColor: palette.textColor,
    borderColor: palette.borderColor,
    borderStyle: style?.borderStyle ?? DEFAULT_BUTTON_STYLE.borderStyle,
    borderWidth: normalizePx(style?.borderWidth, DEFAULT_BUTTON_STYLE.borderWidth),
    borderRadius: normalizePx(style?.borderRadius, DEFAULT_BUTTON_STYLE.borderRadius),
    fontSize: normalizePx(style?.fontSize, DEFAULT_BUTTON_STYLE.fontSize),
    fontWeight: style?.fontWeight ?? DEFAULT_BUTTON_STYLE.fontWeight,
    paddingX: style?.paddingX ?? DEFAULT_BUTTON_STYLE.paddingX,
    paddingY: style?.paddingY ?? DEFAULT_BUTTON_STYLE.paddingY,
    boxShadow: style?.boxShadow ?? DEFAULT_BUTTON_STYLE.boxShadow,
    hoverBackgroundColor: palette.hoverBackgroundColor,
    hoverTextColor: palette.hoverTextColor,
    hoverBorderColor: palette.hoverBorderColor,
    hoverScale: style?.hoverScale ?? DEFAULT_BUTTON_STYLE.hoverScale,
    transitionMs: style?.transitionMs ?? DEFAULT_BUTTON_STYLE.transitionMs,
    letterSpacing: style?.letterSpacing ?? DEFAULT_BUTTON_STYLE.letterSpacing,
    textTransform: style?.textTransform ?? DEFAULT_BUTTON_STYLE.textTransform,
    opacity: style?.opacity ?? DEFAULT_BUTTON_STYLE.opacity,
  };
};

const alignToTranslateX: Record<ButtonHorizontalAlign, string> = {
  left: '0%',
  center: '-50%',
  right: '-100%',
};

const alignToTranslateY: Record<ButtonVerticalAlign, string> = {
  top: '0%',
  center: '-50%',
  bottom: '-100%',
};

export const resolveButtonPlacement = (
  placement?: Partial<ButtonAssetPlacement>
): ButtonAssetPlacement => ({
  x: clamp(placement?.x ?? DEFAULT_BUTTON_PLACEMENT.x, 0, 100),
  y: clamp(placement?.y ?? DEFAULT_BUTTON_PLACEMENT.y, 0, 100),
  horizontal: placement?.horizontal ?? DEFAULT_BUTTON_PLACEMENT.horizontal,
  vertical: placement?.vertical ?? DEFAULT_BUTTON_PLACEMENT.vertical,
});

export const getChoiceContainerSx = (
  placement?: Partial<ButtonAssetPlacement>
): SxProps<Theme> => {
  const resolved = resolveButtonPlacement(placement);

  return {
    position: 'absolute',
    left: `${resolved.x}%`,
    top: `${resolved.y}%`,
    transform: `translate(${alignToTranslateX[resolved.horizontal]}, ${alignToTranslateY[resolved.vertical]})`,
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
  };
};

export const getChoiceButtonSx = (style?: ButtonAssetStyle): SxProps<Theme> => {
  const resolved = resolveButtonAssetStyle(style);
  const baseBorderWidth = resolved.borderStyle === 'none' ? '0px' : resolved.borderWidth;
  const hoverBorderWidth = resolved.borderStyle === 'none' ? '0px' : resolved.borderWidth;
  const hoverBase = {
    transform: `scale(${resolved.hoverScale})`,
    boxShadow: resolved.boxShadow,
    borderColor: resolved.hoverBorderColor,
    borderWidth: hoverBorderWidth,
  };

  const baseSx: SxProps<Theme> = {
    textTransform: resolved.textTransform,
    fontSize: resolved.fontSize,
    fontWeight: resolved.fontWeight,
    letterSpacing: resolved.letterSpacing,
    borderRadius: resolved.borderRadius,
    px: resolved.paddingX,
    py: resolved.paddingY,
    boxShadow: resolved.boxShadow,
    opacity: resolved.opacity,
    borderStyle: resolved.borderStyle,
    borderWidth: baseBorderWidth,
    borderColor: resolved.borderColor,
    transition: `all ${resolved.transitionMs}ms ease`,
    '&:hover': hoverBase,
  };

  if (resolved.variant === 'contained') {
    return {
      ...baseSx,
      backgroundColor: resolved.backgroundColor,
      color: resolved.textColor,
      '&:hover': {
        ...hoverBase,
        backgroundColor: resolved.hoverBackgroundColor,
        color: resolved.hoverTextColor,
      },
    };
  }

  if (resolved.variant === 'outlined') {
    return {
      ...baseSx,
      backgroundColor: 'transparent',
      color: resolved.textColor,
      '&:hover': {
        ...hoverBase,
        backgroundColor: resolved.hoverBackgroundColor,
        color: resolved.hoverTextColor,
      },
    };
  }

  return {
    ...baseSx,
    backgroundColor: 'transparent',
    color: resolved.textColor,
    boxShadow: 'none',
    borderWidth: '0px',
    '&:hover': {
      ...hoverBase,
      backgroundColor: resolved.hoverBackgroundColor,
      color: resolved.hoverTextColor,
      borderWidth: '0px',
    },
  };
};
