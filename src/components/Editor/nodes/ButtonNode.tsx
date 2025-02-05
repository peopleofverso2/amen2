import React from 'react';
import { NodeProps } from 'reactflow';
import { Box, Button } from '@mui/material';
import { ButtonNodeData } from '../../../types/nodes';
import BaseNode from './BaseNode';

const ButtonNode: React.FC<NodeProps<ButtonNodeData>> = ({ data }) => {
  const { label, text, isPlaybackMode, onDataChange, onButtonClick } = data;

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
            pointerEvents: isPlaybackMode ? 'auto' : 'none'
          }}
        >
          {text || 'Cliquez ici'}
        </Button>
      </Box>
    </BaseNode>
  );
};

export default ButtonNode;
