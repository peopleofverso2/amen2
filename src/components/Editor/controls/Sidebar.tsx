import React from 'react';
import { Box, Button, IconButton, Typography, Divider } from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  VideoCall as VideoIcon,
  SmartButton as ButtonIcon,
} from '@mui/icons-material';

interface SidebarProps {
  onSave: () => void;
  isPlayMode?: boolean;
  onPlayModeToggle?: () => void;
  onPlay?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onSave,
  isPlayMode,
  onPlayModeToggle,
  onPlay,
}) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box
      sx={{
        width: '200px',
        padding: '8px',
        backgroundColor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton onClick={onSave} color="primary" size="small">
          <SaveIcon />
        </IconButton>

        {onPlay && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayIcon />}
            onClick={onPlay}
            sx={{ height: '30px' }}
          >
            Play
          </Button>
        )}

        <IconButton 
          onClick={onPlayModeToggle} 
          color={isPlayMode ? "error" : "primary"}
          size="small"
        >
          {isPlayMode ? <StopIcon /> : <PlayIcon />}
        </IconButton>
      </Box>

      <Divider />

      <Typography variant="subtitle2" sx={{ pl: 1 }}>
        Éléments
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          px: 1,
        }}
      >
        <div
          draggable
          onDragStart={(event) => onDragStart(event, 'video')}
          style={{ cursor: 'grab' }}
        >
          <Button
            variant="outlined"
            startIcon={<VideoIcon />}
            fullWidth
          >
            Vidéo
          </Button>
        </div>

        <div
          draggable
          onDragStart={(event) => onDragStart(event, 'button')}
          style={{ cursor: 'grab' }}
        >
          <Button
            variant="outlined"
            startIcon={<ButtonIcon />}
            fullWidth
          >
            Bouton
          </Button>
        </div>
      </Box>
    </Box>
  );
};

export default Sidebar;
