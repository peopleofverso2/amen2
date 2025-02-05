import React, { useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Typography, Stack, IconButton } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import VideoPlayer from './video/VideoPlayer';
import VideoImportDialog from './video/VideoImportDialog';
import EmptyVideoState from './video/EmptyVideoState';
import useVideoNode from './video/useVideoNode';

interface VideoNodeData {
  id: string;
  videoUrl: string;
  label: string;
  buttons?: Array<{
    id: string;
    label: string;
    buttonText: string;
    targetNodeId?: string;
  }>;
  onDataChange?: (data: any) => void;
  onNavigate?: (targetNodeId: string) => void;
  isPlaybackMode?: boolean;
}

interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  isConnectable: boolean;
  onCreateInteraction?: (sourceNodeId: string) => void;
}

const VideoNode: React.FC<VideoNodeProps> = React.memo(({ id, data, isConnectable, onCreateInteraction }) => {
  const handleDataChange = useCallback((updates: any) => {
    if (data.onDataChange) {
      data.onDataChange({ ...updates, id });
    }
  }, [data.onDataChange, id]);

  const {
    isOpen,
    isPlaying,
    showButtons,
    handleOpen,
    handleClose,
    handleSave,
    handleVideoEnd,
    handleError,
    handleButtonClick,
  } = useVideoNode({
    id,
    initialUrl: data.videoUrl,
    isPlaybackMode: data.isPlaybackMode,
    onDataChange: handleDataChange,
    onNavigate: data.onNavigate,
  });

  const handleCreateInteraction = useCallback(() => {
    if (onCreateInteraction) {
      onCreateInteraction(id);
    }
  }, [onCreateInteraction, id]);

  return (
    <Box sx={{ width: 350 }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      
      <Box
        sx={{
          bgcolor: '#2a2a2a',
          borderRadius: 1,
          p: 2,
          '&:hover': {
            '& .add-interaction': {
              opacity: 1,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: 'white' }}>
            {data.label || 'Nœud Vidéo'}
          </Typography>
          {!data.isPlaybackMode && (
            <Stack direction="row" spacing={1}>
              <IconButton 
                className="add-interaction"
                onClick={handleCreateInteraction}
                sx={{ 
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
                title="Ajouter des interactions"
              >
                <AddIcon />
              </IconButton>
            </Stack>
          )}
        </Box>

        <Box
          onClick={!data.isPlaybackMode ? handleOpen : undefined}
          sx={{
            cursor: data.isPlaybackMode ? 'default' : 'pointer',
            position: 'relative',
          }}
        >
          {data.videoUrl ? (
            <VideoPlayer
              url={data.videoUrl}
              isPlaybackMode={data.isPlaybackMode}
              playing={isPlaying}
              onEnded={handleVideoEnd}
              onError={handleError}
              buttons={data.buttons?.map(button => ({
                ...button,
                onClick: () => handleButtonClick(button.targetNodeId || ''),
              })) || []}
              showButtons={showButtons}
            />
          ) : (
            <EmptyVideoState />
          )}
        </Box>
      </Box>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />

      <VideoImportDialog
        open={isOpen}
        onClose={handleClose}
        onSave={handleSave}
      />
    </Box>
  );
});

export default VideoNode;
