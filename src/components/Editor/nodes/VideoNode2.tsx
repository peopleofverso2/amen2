import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Fade
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';
import { LocalStorageAdapter } from '../../../services/storage/LocalStorageAdapter';
import { MediaFile } from '../../../types/media';

interface VideoNodeProps {
  id: string;
  data: {
    mediaId?: string;
    onDataChange?: (id: string, data: any) => void;
    isPlaybackMode?: boolean;
    onVideoEnd?: (id: string) => void;
    onChoiceSelect?: (id: string, choice: any) => void;
    isCurrentNode?: boolean;
    isPlaying?: boolean;
  };
  selected?: boolean;
}

export default function VideoNode2({ id, data, selected }: VideoNodeProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingChoice, setIsEditingChoice] = useState(false);
  const [editingChoiceId, setEditingChoiceId] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [storageAdapter, setStorageAdapter] = useState<LocalStorageAdapter>();

  // Initialiser le LocalStorageAdapter
  useEffect(() => {
    const initStorage = async () => {
      try {
        const adapter = await LocalStorageAdapter.getInstance();
        setStorageAdapter(adapter);
      } catch (error) {
        console.error('Error initializing storage:', error);
        setError('Failed to initialize media storage');
      }
    };
    initStorage();
  }, []);

  const loadVideo = useCallback(async () => {
    if (!data.mediaId || !storageAdapter) return;

    try {
      setError(undefined);
      const mediaFile = await storageAdapter.getMedia(data.mediaId);
      if (mediaFile && mediaFile.url) {
        setVideoUrl(mediaFile.url);
      } else {
        setError('Video not found');
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setError('Failed to load video');
    }
  }, [data.mediaId, storageAdapter]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const handleVideoEnd = useCallback(() => {
    if (data.onVideoEnd) {
      data.onVideoEnd(id);
    }
  }, [data.onVideoEnd, id]);

  const handleChoiceClick = useCallback((choice: any) => {
    if (data.onChoiceSelect) {
      data.onChoiceSelect(id, choice);
    }
  }, [data.onChoiceSelect, id]);

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

  const handleMediaSelect = useCallback(async (mediaFiles: MediaFile[]) => {
    if (!mediaFiles.length || !data.onDataChange) return;

    try {
      setError(undefined);
      const mediaFile = mediaFiles[0];
      data.onDataChange(id, {
        ...data,
        mediaId: mediaFile.id
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error selecting media:', error);
      setError('Failed to select video');
    }
  }, [id, data, data.onDataChange]);

  const handleAddChoice = useCallback(() => {
    if (data.onDataChange) {
      const newChoice = {
        id: `choice-${Math.random().toString(36).substr(2, 9)}`,
        text: 'New Choice'
      };
      
      data.onDataChange(id, {
        choices: [...(data.choices || []), newChoice]
      });
    }
  }, [id, data.onDataChange, data.choices]);

  const handleEditChoice = useCallback((choice: { id: string; text: string }) => {
    if (data.onDataChange && data.choices) {
      const updatedChoices = data.choices.map(c => 
        c.id === choice.id ? { ...c, text: choice.text } : c
      );
      
      data.onDataChange(id, {
        choices: updatedChoices
      });
    }
  }, [id, data.onDataChange, data.choices]);

  const handleDeleteChoice = useCallback((choiceId: string) => {
    if (data.onDataChange && data.choices) {
      const updatedChoices = data.choices.filter(c => c.id !== choiceId);
      
      data.onDataChange(id, {
        choices: updatedChoices
      });
    }
  }, [id, data.onDataChange, data.choices]);

  useEffect(() => {
    if (data.isPlaying && videoRef.current) {
      videoRef.current.play().catch(error => {
        console.error('Error playing video:', error);
        setError('Failed to play video');
      });
      setIsPlaying(true);
    } else if (!data.isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [data.isPlaying]);

  const renderChoiceButtons = () => {
    if (!data.choices) return null;
    
    return data.choices.map((choice: any, index: number) => (
      <Box key={choice.id} sx={{ mb: 1, position: 'relative' }}>
        <Handle
          type="source"
          position={Position.Right}
          id={`choice-${choice.id}`}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            right: '-15px',
            width: '15px',
            height: '15px',
            background: '#555',
            border: '2px solid #fff',
            zIndex: 1000,
            cursor: 'crosshair',
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={() => handleChoiceClick(choice)}
          sx={{ 
            width: '100%', 
            mb: 1,
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: '-30px',
              bottom: 0,
              width: '30px',
              cursor: 'crosshair',
            }
          }}
        >
          {choice.text || 'Continue'}
        </Button>
      </Box>
    ));
  };

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative' }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#555' }}
      />
      
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
                onEnded={handleVideoEnd}
                controls={!data.isPlaybackMode}
                playsInline
              />
              {!data.isPlaybackMode && (
                <Fade in={isHovered}>
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
              )}
            </Box>

            <Box sx={{ p: 2 }}>
              {!data.isPlaybackMode && (
                <>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<EditIcon />}
                    onClick={() => setIsDialogOpen(true)}
                    sx={{ mb: 2 }}
                  >
                    Change Video
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditingChoice(true)}
                    sx={{ mb: 2 }}
                  >
                    Edit Choices
                  </Button>
                </>
              )}
              {renderChoiceButtons()}
            </Box>
          </Box>
        )}
      </Paper>

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

      <Dialog
        open={isEditingChoice}
        onClose={() => setIsEditingChoice(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Choices</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            {data.choices?.map((choice) => (
              <Box key={choice.id} sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  value={choice.text}
                  onChange={(e) => handleEditChoice({ id: choice.id, text: e.target.value })}
                />
                <IconButton
                  color="error"
                  onClick={() => handleDeleteChoice(choice.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddChoice}
              sx={{ mt: 2 }}
              fullWidth
            >
              Add Choice
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {error && (
        <Box sx={{ mt: 2, color: 'error.main' }}>
          {error}
        </Box>
      )}
    </div>
  );
}
