export type ButtonPreset = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonVariant = 'contained' | 'outlined' | 'text';

export type ButtonSize = 'small' | 'medium' | 'large';

export type ButtonBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';

export type ButtonHorizontalAlign = 'left' | 'center' | 'right';

export type ButtonVerticalAlign = 'top' | 'center' | 'bottom';

export interface ButtonAssetStyle {
  preset?: ButtonPreset;
  variant?: ButtonVariant;
  size?: ButtonSize;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderStyle?: ButtonBorderStyle;
  borderWidth?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: number;
  paddingX?: number;
  paddingY?: number;
  boxShadow?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
  hoverBorderColor?: string;
  hoverScale?: number;
  transitionMs?: number;
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  opacity?: number;
}

export interface ButtonAssetPlacement {
  x: number;
  y: number;
  horizontal: ButtonHorizontalAlign;
  vertical: ButtonVerticalAlign;
}
