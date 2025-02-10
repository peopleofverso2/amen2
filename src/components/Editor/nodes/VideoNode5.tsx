import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Fade,
  Paper,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MovieIcon from '@mui/icons-material/Movie';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MediaLibrary from '../../MediaLibrary/MediaLibrary';
import { v4 as uuidv4 } from 'uuid';
import { MediaLibraryService } from '../../../services/MediaLibraryService';

interface Choice {
  id: string;
  text: string;
}

interface VideoNodeProps {
  id: string;
  data: {
    mediaId?: string;
    onDataChange?: (id: string, data: any) => void;
    isPlaybackMode?: boolean;
    onVideoEnd?: (id: string) => void;
    onChoiceSelect?: (id: string, choice: Choice) => void;
    isCurrentNode?: boolean;
    isPlaying?: boolean;
    onVideoSelect?: (mediaId: string) => void;
    onChoicesChange?: (choices: Choice[]) => void;
    choices?: Choice[];
  };
  selected?: boolean;
}

export default function VideoNode5({ id, data, selected }: VideoNodeProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [choices, setChoices] = useState<Choice[]>(data.choices || []);
  const [videoUrl, setVideoUrl] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const mediaLibrary = useRef(MediaLibraryService.getInstance());

  const loadVideo = useCallback(async () => {
    if (!data.mediaId) {
      setVideoUrl(undefined);
      return;
    }

    if (typeof data.mediaId !== 'string') {
      console.error('Invalid mediaId type:', typeof data.mediaId);
      return;
    }

    try {
      const media = await mediaLibrary.current.getMedia(data.mediaId);
      if (!media) {
        console.error('Media not found');
        return;
      }

      setVideoUrl(media.url);
    } catch (error) {
      console.error('Error loading video:', error);
    }
  }, [data.mediaId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  useEffect(() => {
    if (videoRef.current) {
      if (data.isCurrentNode && data.isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [data.isCurrentNode, data.isPlaying]);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    if (data.onVideoEnd) {
      data.onVideoEnd(id);
    }
  }, [data.onVideoEnd, id]);

  const handleVideoSelect = useCallback((mediaFile: MediaFile) => {
    if (data.onDataChange) {
      data.onDataChange(id, { ...data, mediaId: mediaFile.id });
    }
    setIsDialogOpen(false);
  }, [data, id]);

  const handleAddChoice = useCallback(() => {
    const newChoice = { id: uuidv4(), text: 'Nouveau choix' };
    const updatedChoices = [...choices, newChoice];
    setChoices(updatedChoices);
    if (data.onChoicesChange) {
      data.onChoicesChange(updatedChoices);
    }
  }, [choices, data.onChoicesChange]);

  const handleChoiceTextChange = useCallback((choiceId: string, text: string) => {
    const updatedChoices = choices.map(choice =>
      choice.id === choiceId ? { ...choice, text } : choice
    );
    setChoices(updatedChoices);
    if (data.onChoicesChange) {
      data.onChoicesChange(updatedChoices);
    }
  }, [choices, data.onChoicesChange]);

  const handleDeleteChoice = useCallback((choiceId: string) => {
    const updatedChoices = choices.filter(choice => choice.id !== choiceId);
    setChoices(updatedChoices);
    if (data.onChoicesChange) {
      data.onChoicesChange(updatedChoices);
    }
  }, [choices, data.onChoicesChange]);

  const handleChoiceSelect = useCallback((choice: Choice) => {
    if (data.onChoiceSelect) {
      data.onChoiceSelect(id, choice);
    }
  }, [data.onChoiceSelect, id]);

  return (
    <Box
      ref={nodeRef}
      onMouseEnter={() => !data.isPlaybackMode && setIsHovered(true)}
      onMouseLeave={() => !data.isPlaybackMode && setIsHovered(false)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setIsDragging(true);
        }
      }}
      onMouseUp={() => setIsDragging(false)}
      sx={{
        width: 320,
        height: 240,
        position: 'relative',
        backgroundColor: 'black',
        borderRadius: 1,
        border: selected ? '2px solid #1976d2' : '2px solid transparent',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : data.isPlaybackMode ? 'default' : 'pointer',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={!data.isPlaybackMode}
        style={{ 
          zIndex: 10,
          width: '12px',
          height: '12px',
          background: '#1976d2',
          border: '2px solid white'
        }}
      />

      {!data.mediaId ? (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          <MovieIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          {!data.isPlaybackMode && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsDialogOpen(true)}
              sx={{
                mt: 1,
                textTransform: 'none',
                borderRadius: 2,
                bgcolor: 'grey.500',
                '&:hover': {
                  bgcolor: 'grey.600',
                }
              }}
            >
              Ajouter une vidéo
            </Button>
          )}
        </Box>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              pointerEvents: isDragging ? 'none' : 'auto',
            }}
            onEnded={handleVideoEnd}
          />
          
          {!data.isPlaybackMode && isHovered && (
            <Fade in={true}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: isDragging ? 'none' : 'auto',
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setIsDialogOpen(true)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                  }}
                >
                  Changer la vidéo
                </Button>
              </Box>
            </Fade>
          )}
        </>
      )}

      {!data.isPlaybackMode && (
        <Paper
          elevation={0}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            p: 1,
            zIndex: 3,
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddChoice}
              sx={{ flex: 1 }}
            >
              Ajouter un choix
            </Button>
          </Box>

          {choices.map((choice) => (
            <Box
              key={choice.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1,
                position: 'relative',
              }}
            >
              <TextField
                size="small"
                value={choice.text}
                onChange={(e) => handleChoiceTextChange(choice.id, e.target.value)}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteChoice(choice.id)}
                color="error"
                sx={{
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'error.dark',
                  }
                }}
              >
                <DeleteIcon />
              </IconButton>
              <Handle
                type="source"
                position={Position.Right}
                id={`choice-${choice.id}`}
                style={{
                  top: '50%',
                  zIndex: 10,
                  width: '12px',
                  height: '12px',
                  background: '#1976d2',
                  border: '2px solid white'
                }}
                isConnectable={!data.isPlaybackMode}
              />
            </Box>
          ))}
        </Paper>
      )}

      {data.isPlaybackMode && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            zIndex: 3,
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          {choices.map((choice) => (
            <Box
              key={choice.id}
              sx={{
                position: 'relative',
              }}
            >
              <Button
                variant="contained"
                fullWidth
                onClick={() => handleChoiceSelect(choice)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                }}
              >
                {choice.text}
              </Button>
              <Handle
                type="source"
                position={Position.Right}
                id={`choice-${choice.id}`}
                style={{
                  top: '50%',
                  zIndex: 10,
                  width: '12px',
                  height: '12px',
                  background: '#1976d2',
                  border: '2px solid white'
                }}
                isConnectable={!data.isPlaybackMode}
              />
            </Box>
          ))}
        </Box>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={!data.isPlaybackMode}
        style={{ 
          zIndex: 10,
          width: '12px',
          height: '12px',
          background: '#1976d2',
          border: '2px solid white'
        }}
      />

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Sélectionner une vidéo</DialogTitle>
        <DialogContent>
          <MediaLibrary onSelect={handleVideoSelect} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
