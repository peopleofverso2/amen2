import React from 'react';
import { NodeProps } from 'reactflow';
import { Box, Button } from '@mui/material';
import { ButtonNodeData } from '../../../types/nodes';
import BaseNode from './BaseNode';

const ButtonNode: React.FC<NodeProps<ButtonNodeData>> = ({ data }) => {
  const { label, text, isPlaybackMode, onDataChange, onButtonClick, style } = data;

  const defaultStyle = {
    backgroundColor: '#2196f3',
    textColor: '#ffffff',
    borderRadius: '4px',
    fontSize: '14px',
    borderStyle: 'none',
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

  const buttonStyle = style || defaultStyle;

  return (
    <BaseNode 
      label={label}
      isPlaybackMode={isPlaybackMode}
      onLabelChange={isPlaybackMode ? undefined : (newLabel) => onDataChange?.({ label: newLabel })}
    >
      <Box sx={{ 
        width: '100%',
        minWidth: 200,
        display: 'flex',
        justifyContent: 'center',
        p: 2
      }}>
        <Button
          variant="contained"
          color="primary"
          disabled={!isPlaybackMode}
          onClick={isPlaybackMode ? onButtonClick : undefined}
          sx={{
            opacity: isPlaybackMode ? 1 : 0.7,
            pointerEvents: isPlaybackMode ? 'auto' : 'none',
            backgroundColor: buttonStyle.backgroundColor,
            color: buttonStyle.textColor,
            borderRadius: buttonStyle.borderRadius,
            fontSize: buttonStyle.fontSize,
            borderStyle: buttonStyle.borderStyle,
            borderColor: buttonStyle.borderColor,
            borderWidth: buttonStyle.borderWidth,
            boxShadow: buttonStyle.boxShadow,
            padding: buttonStyle.padding,
            textAlign: buttonStyle.textAlign,
            transition: buttonStyle.transition,
            '&:hover': {
              backgroundColor: buttonStyle.hoverBackgroundColor,
              color: buttonStyle.hoverTextColor,
              transform: `scale(${buttonStyle.hoverScale})`
            }
          }}
        >
          {text || 'Cliquez ici'}
        </Button>
      </Box>
    </BaseNode>
  );
};

export default ButtonNode;
