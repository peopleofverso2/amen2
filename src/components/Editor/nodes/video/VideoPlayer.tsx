import React from 'react';
import { Box } from '@mui/material';
import ReactPlayer from 'react-player';
import ButtonOverlay from '../button/ButtonOverlay';

interface VideoPlayerProps {
  url: string;
  isPlaybackMode?: boolean;
  playing?: boolean;
  onEnded?: () => void;
  onError?: () => void;
  buttons?: Array<{
    id: string;
    label: string;
    targetNodeId?: string;
    onClick: () => void;
  }>;
  showButtons?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  isPlaybackMode,
  playing,
  onEnded,
  onError,
  buttons = [],
  showButtons = false,
}) => {
  return (
    <Box sx={{ position: 'relative', width: '100%', pb: '56.25%' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <ReactPlayer
          url={url}
          width="100%"
          height="100%"
          controls={!isPlaybackMode}
          playing={playing}
          onEnded={onEnded}
          onError={onError}
          config={{
            youtube: {
              playerVars: { showinfo: 1 }
            },
            file: {
              attributes: {
                controlsList: 'nodownload'
              }
            }
          }}
        />
        <ButtonOverlay buttons={buttons} visible={showButtons} />
      </Box>
    </Box>
  );
};

export default VideoPlayer;
