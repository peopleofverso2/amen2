import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Button, Icon } from '@mui/material';
import { ButtonNodeData } from '../../../../types/nodes';
import ButtonStyleDialog from './ButtonStyleDialog';

interface ButtonNodeProps {
  data: ButtonNodeData;
  isConnectable: boolean;
}

const defaultStyle = {
  backgroundColor: '#2196f3',
  textColor: '#ffffff',
  borderRadius: '4px',
  fontSize: '14px',
  borderStyle: 'none' as const,
  borderColor: '#000000',
  borderWidth: '1px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  padding: '8px 16px',
  textAlign: 'center' as const,
  transition: 'all 0.3s ease',
  hoverBackgroundColor: '#1976d2',
  hoverTextColor: '#ffffff',
  hoverScale: '1.05',
  positionMode: 'flow' as const,
  positionX: 24,
  positionY: 24,
  horizontalAlign: 'center' as const,
  verticalAlign: 'bottom' as const,
  mobilePositionMode: 'flow' as const,
  mobilePositionX: 16,
  mobilePositionY: 16,
  mobileHorizontalAlign: 'center' as const,
  mobileVerticalAlign: 'bottom' as const,
};

const sizeStylePresets: Record<NonNullable<ButtonNodeData['size']>, { fontSize: string; padding: string; minWidth: string }> = {
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

const ButtonNode: React.FC<ButtonNodeProps> = ({ data, isConnectable }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonSize: NonNullable<ButtonNodeData['size']> = data.size || 'medium';
  const sizePreset = sizeStylePresets[buttonSize];
  const isCustomFontSize = Boolean(
    data.style?.fontSize && data.style.fontSize !== defaultStyle.fontSize
  );
  const isCustomPadding = Boolean(data.style?.padding && data.style.padding !== defaultStyle.padding);

  const handleSave = (newData: Partial<ButtonNodeData>) => {
    if (data.onDataChange) {
      data.onDataChange(newData);
    }
    setIsOpen(false);
  };

  const handleNavigate = () => {
    if (data.isPlaybackMode && data.targetNodeId && data.onNavigate) {
      data.onNavigate(data.targetNodeId);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#2a2a2a',
        borderRadius: 1,
        p: 2,
        minWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      <Box sx={{ p: 1 }}>
        <Button
          variant={data.variant || 'contained'}
          size={buttonSize}
          onClick={() => data.isPlaybackMode ? handleNavigate() : setIsOpen(true)}
          startIcon={data.icon?.position === 'start' && <Icon>{data.icon.name}</Icon>}
          endIcon={data.icon?.position === 'end' && <Icon>{data.icon.name}</Icon>}
          sx={{
            backgroundColor: data.style?.backgroundColor || defaultStyle.backgroundColor,
            color: data.style?.textColor || defaultStyle.textColor,
            borderRadius: data.style?.borderRadius || defaultStyle.borderRadius,
            fontSize: isCustomFontSize
              ? data.style?.fontSize
              : sizePreset.fontSize,
            borderStyle: data.style?.borderStyle || defaultStyle.borderStyle,
            borderColor: data.style?.borderColor || defaultStyle.borderColor,
            borderWidth: data.style?.borderWidth || defaultStyle.borderWidth,
            boxShadow: data.style?.boxShadow || defaultStyle.boxShadow,
            padding: isCustomPadding
              ? data.style?.padding
              : sizePreset.padding,
            textAlign: data.style?.textAlign || defaultStyle.textAlign,
            transition: data.style?.transition || defaultStyle.transition,
            minWidth: sizePreset.minWidth,
            '&:hover': {
              backgroundColor: data.style?.hoverBackgroundColor || defaultStyle.hoverBackgroundColor,
              color: data.style?.hoverTextColor || defaultStyle.hoverTextColor,
              transform: `scale(${data.style?.hoverScale || defaultStyle.hoverScale})`,
            },
          }}
        >
          {data.text || 'Nouveau bouton'}
        </Button>
      </Box>

      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />

      <ButtonStyleDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        data={data}
        onSave={handleSave}
      />
    </Box>
  );
};

export default ButtonNode;
