import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Add as AddIcon,
} from '@mui/icons-material';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';
import { LocalStorageAdapter } from '../../../services/storage/LocalStorageAdapter';
import { MediaFile } from '../../../types/media';

interface VideoNodeProps {
  id: string;
  data: {
    label: string;
    mediaId?: string;
    onDataChange?: (id: string, data: any) => void;
  };
  selected?: boolean;
  isConnectable?: boolean;
}

export default function VideoNode2({
  id,
  data,
  selected,
  isConnectable = true,
}: VideoNodeProps) {
  const [videoUrl, setVideoUrl] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageAdapter = useRef(LocalStorageAdapter.getInstance());

  const loadVideo = useCallback(async () => {
    if (!data.mediaId) return;

    try {
      console.log('Loading video with mediaId:', data.mediaId);
      const mediaFile = await storageAdapter.current.getMedia(data.mediaId);
      console.log('Loaded media file:', mediaFile);
      if (mediaFile && mediaFile.url) {
        setVideoUrl(mediaFile.url);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    }
  }, [data.mediaId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, []);

  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleMediaSelect = useCallback((mediaFiles: MediaFile[]) => {
    if (!mediaFiles.length || !data.onDataChange) return;

    const mediaFile = mediaFiles[0];
    console.log('Selected media file:', mediaFile);

    data.onDataChange(id, {
      mediaId: mediaFile.id,
      label: mediaFile.metadata?.name || 'Video'
    });

    setIsDialogOpen(false);
  }, [id, data.onDataChange]);

  return (
    <div style={{ position: 'relative' }}>
      <Box
        sx={{
          width: 200,
          bgcolor: 'background.paper',
          borderRadius: 1,
          p: 2,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => setIsDialogOpen(true)}
      >
        {!videoUrl ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              p: 2,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <AddIcon />
            <Typography>Add Video</Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              style={{ width: '100%', borderRadius: 4 }}
              onEnded={handleVideoEnded}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.3)',
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 1,
                },
                borderRadius: 1,
              }}
            >
              <IconButton
                onClick={handlePlayPause}
                sx={{ color: 'white' }}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select Video</DialogTitle>
        <DialogContent>
          <MediaLibrary
            onSelect={handleMediaSelect}
            multiSelect={false}
            acceptedTypes={['video/*']}
          />
        </DialogContent>
      </Dialog>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#555' }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555' }}
        isConnectable={isConnectable}
      />
    </div>
  );
}
