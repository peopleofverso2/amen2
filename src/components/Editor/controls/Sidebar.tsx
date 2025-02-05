import React from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  FolderOpen as OpenIcon,
  VideoCall as VideoIcon,
  SmartButton as ButtonIcon,
} from '@mui/icons-material';

interface SidebarProps {
  onSave?: () => void;
  onOpen?: () => void;
  isPlayMode?: boolean;
  onPlayModeToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onSave,
  onOpen,
  isPlayMode,
  onPlayModeToggle,
}) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box
      sx={{
        width: 240,
        height: 'calc(100vh - 64px)',
        backgroundColor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflow: 'auto',
        position: 'relative',
        zIndex: 2, // S'assurer que la sidebar est au-dessus de ReactFlow
      }}
    >
      <Typography variant="h6" gutterBottom>
        Contrôles
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={onSave}
          fullWidth
        >
          Sauvegarder
        </Button>
        <Button
          variant="outlined"
          startIcon={<OpenIcon />}
          onClick={onOpen}
          fullWidth
        >
          Ouvrir
        </Button>
        <Button
          variant="outlined"
          startIcon={<PlayIcon />}
          onClick={onPlayModeToggle}
          color={isPlayMode ? 'secondary' : 'primary'}
          fullWidth
        >
          {isPlayMode ? 'Mode édition' : 'Mode lecture'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" gutterBottom>
        Éléments
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          startIcon={<VideoIcon />}
          onDragStart={(event) => onDragStart(event, 'video')}
          draggable
          fullWidth
        >
          Vidéo
        </Button>
        <Button
          variant="outlined"
          startIcon={<ButtonIcon />}
          onDragStart={(event) => onDragStart(event, 'button')}
          draggable
          fullWidth
        >
          Bouton
        </Button>
      </Box>
    </Box>
  );
};

export default Sidebar;
