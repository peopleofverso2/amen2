import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Button,
  TextField,
  Paper,
  Fade,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MovieIcon from '@mui/icons-material/Movie';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';
import { LocalStorageAdapter } from '../../../services/storage/LocalStorageAdapter';
import { MediaFile } from '../../../types/media';

interface VideoNodeProps {
  id: string;
  data: {
    label: string;
    mediaId?: string;
    onDataChange?: (id: string, data: any) => void;
    isPlaybackMode?: boolean;
    onVideoEnd?: () => void;
    buttons?: Array<{
      id: string;
      label: string;
    }>;
    getConnectedNodeId?: (buttonId: string) => string | null;
  };
  selected?: boolean;
  isConnectable?: boolean;
}

const BUTTON_HANDLE_PREFIX = 'button-handle-';

export default function VideoNode2({
  id,
  data,
  selected,
  isConnectable = true,
}: VideoNodeProps) {
  const [videoUrl, setVideoUrl] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [buttons, setButtons] = useState(data.buttons || []);
  const [isEditingButtons, setIsEditingButtons] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageAdapter = useRef(LocalStorageAdapter.getInstance());

  useEffect(() => {
    setButtons(data.buttons || []);
  }, [data.buttons]);

  const generateButtonId = () => `button-${Math.random().toString(36).substr(2, 9)}`;

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

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    if (data.isPlaybackMode) {
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setShowButtons(false);
        })
        .catch(error => console.error('Error playing video:', error));
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setShowButtons(false);
    }
  }, [data.isPlaybackMode, videoUrl]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      setShowButtons(true);
    }
    if (!buttons.length && data.onVideoEnd) {
      data.onVideoEnd();
    }
  }, [data.onVideoEnd, buttons]);

  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current || data.isPlaybackMode) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play()
        .then(() => {
          setShowButtons(false);
        })
        .catch(error => console.error('Error playing video:', error));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, data.isPlaybackMode]);

  const handleButtonClick = useCallback((buttonId: string) => {
    if (data.getConnectedNodeId) {
      const targetNodeId = data.getConnectedNodeId(buttonId);
      if (targetNodeId) {
        setShowButtons(false);
        setIsPlaying(false);
        if (data.onDataChange) {
          data.onDataChange(id, { nextNodeId: targetNodeId });
        }
      }
    }
  }, [id, data]);

  const handleAddButton = useCallback(() => {
    if (data.onDataChange) {
      const newButton = { 
        id: generateButtonId(),
        label: 'New Button'
      };
      const newButtons = [...buttons, newButton];
      setButtons(newButtons);
      data.onDataChange(id, { buttons: newButtons });
    }
  }, [id, buttons, data.onDataChange]);

  const handleEditButton = useCallback((index: number, changes: Partial<{ label: string }>) => {
    if (data.onDataChange) {
      const newButtons = buttons.map((btn, i) => 
        i === index ? { ...btn, ...changes } : btn
      );
      setButtons(newButtons);
      data.onDataChange(id, { buttons: newButtons });
    }
  }, [id, buttons, data.onDataChange]);

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
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Paper
        elevation={selected ? 8 : isHovered ? 4 : 1}
        sx={{
          width: 280,
          borderRadius: 2,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          border: selected ? '2px solid' : '2px solid transparent',
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: 'background.paper',
          '&:hover': {
            transform: data.isPlaybackMode ? 'none' : 'translateY(-2px)',
          },
        }}
      >
        {!videoUrl ? (
          <Box
            onClick={() => !data.isPlaybackMode && setIsDialogOpen(true)}
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: data.isPlaybackMode ? 'default' : 'pointer',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              m: 2,
              backgroundColor: 'action.hover',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.selected',
              },
            }}
          >
            <MovieIcon sx={{ fontSize: 48, color: 'action.active' }} />
            <Typography variant="body1" color="text.secondary">
              Add Video
            </Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ position: 'relative' }}>
              <video
                ref={videoRef}
                src={videoUrl}
                style={{ 
                  width: '100%',
                  display: 'block',
                  borderRadius: '8px 8px 0 0',
                }}
                onEnded={handleVideoEnded}
                playsInline
              />
              <Fade in={!data.isPlaybackMode || isHovered}>
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
                    bgcolor: 'rgba(0,0,0,0.4)',
                    transition: 'opacity 0.2s',
                    borderRadius: '8px 8px 0 0',
                  }}
                >
                  <IconButton
                    onClick={handlePlayPause}
                    sx={{
                      color: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                </Box>
              </Fade>
              {(showButtons && data.isPlaybackMode) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    p: 2,
                    borderRadius: '8px 8px 0 0',
                  }}
                >
                  {buttons.map((button) => (
                    <Button
                      key={button.id}
                      variant="contained"
                      fullWidth
                      onClick={() => handleButtonClick(button.id)}
                      sx={{ 
                        py: 1,
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 500,
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        borderRadius: 2,
                      }}
                    >
                      {button.label}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
            {!data.isPlaybackMode && (
              <Box sx={{ p: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<EditIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingButtons(true);
                  }}
                  sx={{
                    py: 1,
                    textTransform: 'none',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      bgcolor: 'primary.50',
                    },
                    borderRadius: 2,
                  }}
                >
                  Edit Choices
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Media Library Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
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

      {/* Button Editor Dialog */}
      <Dialog
        open={isEditingButtons}
        onClose={() => setIsEditingButtons(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle>Edit Choice Buttons</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2 }}>
            {buttons.map((button, index) => (
              <Paper
                key={button.id}
                elevation={1}
                sx={{ 
                  p: 2,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <TextField
                  value={button.label}
                  onChange={(e) => handleEditButton(index, { label: e.target.value })}
                  placeholder="Button Label"
                  size="small"
                  fullWidth
                  variant="outlined"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    }
                  }}
                />
                <IconButton 
                  size="small"
                  onClick={() => {
                    const newButtons = buttons.filter((_, i) => i !== index);
                    setButtons(newButtons);
                    data.onDataChange?.(id, { buttons: newButtons });
                  }}
                  sx={{ 
                    color: 'error.main',
                    '&:hover': {
                      bgcolor: 'error.50',
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Paper>
            ))}
            <Button 
              variant="outlined" 
              onClick={handleAddButton}
              startIcon={<AddIcon />}
              sx={{
                mt: 1,
                py: 1,
                textTransform: 'none',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  bgcolor: 'primary.50',
                },
                borderRadius: 2,
              }}
            >
              Add Choice Button
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Node Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#555',
          width: 10,
          height: 10,
          top: -5,
          zIndex: 1000,
        }}
        isConnectable={isConnectable}
      />

      {!data.isPlaybackMode && (data.buttons || []).map((button, index) => (
        <Handle
          key={button.id}
          type="source"
          position={Position.Bottom}
          id={`${BUTTON_HANDLE_PREFIX}${button.id}`}
          style={{
            left: `${((index + 1) * 100) / ((data.buttons || []).length + 1)}%`,
            background: '#FF6B6B',
            width: 10,
            height: 10,
            bottom: -5,
            zIndex: 1000,
          }}
          isConnectable={isConnectable}
        />
      ))}
    </div>
  );
}
