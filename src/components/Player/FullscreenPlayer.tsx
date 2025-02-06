import React from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { VideoPlayer } from '../Editor/nodes/video/VideoPlayer';

interface FullscreenPlayerProps {
  url: string;
  onClose: () => void;
}

export const FullscreenPlayer: React.FC<FullscreenPlayerProps> = ({ url, onClose }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'black',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
        }}
      >
        <CloseIcon />
      </IconButton>
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <VideoPlayer
          url={url}
          controls={true}
          playing={true}
          loop={false}
          muted={false}
          width="auto"
          height="90%"
        />
      </Box>
    </Box>
  );
};
