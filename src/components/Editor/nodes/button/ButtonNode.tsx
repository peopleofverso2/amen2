import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Button, Icon } from '@mui/material';
import ButtonStyleDialog from './ButtonStyleDialog';

interface ButtonNodeData {
  text: string;
  style: {
    backgroundColor: string;
    textColor: string;
    borderRadius: string;
    fontSize: string;
    borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
    borderColor: string;
    borderWidth: string;
    boxShadow: string;
    padding: string;
    textAlign: 'left' | 'center' | 'right';
    transition: string;
    hoverBackgroundColor: string;
    hoverTextColor: string;
    hoverScale: string;
  };
  variant: 'contained' | 'outlined' | 'text';
  size: 'small' | 'medium' | 'large';
  icon?: {
    name: string;
    position: 'start' | 'end';
  };
  targetNodeId?: string;
  onDataChange?: (data: Partial<ButtonNodeData>) => void;
  onNavigate?: (targetNodeId: string) => void;
  isPlaybackMode?: boolean;
}

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
  hoverScale: '1.05'
};

const ButtonNode: React.FC<ButtonNodeProps> = ({ data, isConnectable }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (newData: ButtonNodeData) => {
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
          size={data.size || 'medium'}
          onClick={() => data.isPlaybackMode ? handleNavigate() : setIsOpen(true)}
          startIcon={data.icon?.position === 'start' && <Icon>{data.icon.name}</Icon>}
          endIcon={data.icon?.position === 'end' && <Icon>{data.icon.name}</Icon>}
          sx={{
            backgroundColor: data.style?.backgroundColor || defaultStyle.backgroundColor,
            color: data.style?.textColor || defaultStyle.textColor,
            borderRadius: data.style?.borderRadius || defaultStyle.borderRadius,
            fontSize: data.style?.fontSize || defaultStyle.fontSize,
            borderStyle: data.style?.borderStyle || defaultStyle.borderStyle,
            borderColor: data.style?.borderColor || defaultStyle.borderColor,
            borderWidth: data.style?.borderWidth || defaultStyle.borderWidth,
            boxShadow: data.style?.boxShadow || defaultStyle.boxShadow,
            padding: data.style?.padding || defaultStyle.padding,
            textAlign: data.style?.textAlign || defaultStyle.textAlign,
            transition: data.style?.transition || defaultStyle.transition,
            minWidth: '120px',
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
