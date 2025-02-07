import React, { useCallback, useState } from 'react';
import { Box, Button, TextField, IconButton } from '@mui/material';
import { Handle, Position } from 'reactflow';
import { Edit as EditIcon } from '@mui/icons-material';

interface ButtonNodeProps {
  id: string;
  data: {
    label: string;
    text: string;
    isPlaybackMode?: boolean;
    targetNodeId?: string;
  };
  onDataChange?: (id: string, data: any) => void;
  isConnectable?: boolean;
  selected?: boolean;
}

export default function ButtonNode({ 
  id, 
  data, 
  onDataChange,
  isConnectable = true,
  selected,
}: ButtonNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || 'Click me');

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (onDataChange) {
      onDataChange(id, {
        ...data,
        text,
      });
    }
    setIsEditing(false);
  }, [id, data, text, onDataChange]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  const handleClick = useCallback(() => {
    if (data.targetNodeId && onDataChange) {
      onDataChange(id, {
        ...data,
        clicked: true,
      });
    }
  }, [data, id, onDataChange]);

  return (
    <Box
      sx={{
        padding: 1,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: selected ? '2px solid #1976d2' : '1px solid #ccc',
        minWidth: 120,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />

      {isEditing && !data.isPlaybackMode ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            value={text}
            onChange={handleTextChange}
            onKeyPress={handleKeyPress}
            onBlur={handleTextSubmit}
            autoFocus
            fullWidth
          />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => !data.isPlaybackMode ? setIsEditing(true) : handleClick()}
            sx={{ 
              flexGrow: 1,
              pointerEvents: data.isPlaybackMode ? 'auto' : 'none',
            }}
          >
            {text}
          </Button>
          {!data.isPlaybackMode && (
            <IconButton
              size="small"
              onClick={() => setIsEditing(true)}
              sx={{ padding: 0.5 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </Box>
  );
}
