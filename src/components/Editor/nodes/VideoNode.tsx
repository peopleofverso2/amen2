import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  IconButton,
  Typography,
  Slider,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  FullscreenRounded as FullscreenIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { VideoNodeData, MediaFile } from '../../../types';
import { LocalStorageAdapter } from '../../../services/storage';
import MediaLibrary from '../../../components/MediaLibrary/MediaLibrary.tsx';
import EmptyVideoState from './video/EmptyVideoState';

interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  isConnectable?: boolean;
  onCreateInteraction?: (nodeId: string) => void;
  onDataChange?: (nodeId: string, data: VideoNodeData) => void;
}

const VideoNode: React.FC<VideoNodeProps> = React.memo(({ id, data, isConnectable, onCreateInteraction, onDataChange }) => {
  // États de base
  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États pour le menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const storageAdapter = React.useMemo(() => new LocalStorageAdapter(), []);

  // Chargement de la vidéo
  useEffect(() => {
    const loadVideo = async () => {
      try {
        setError(null);
        if (data.mediaId) {
          const mediaFile = await storageAdapter.getMedia(data.mediaId);
          setVideoUrl(mediaFile.url);
        }
      } catch (error) {
        console.error('Error loading video:', error);
        setError('Erreur lors du chargement de la vidéo');
      }
    };
    loadVideo();
  }, [data.mediaId, storageAdapter]);

  // Gestionnaires d'événements vidéo
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Contrôles vidéo
  const togglePlayPause = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
      setIsMuted(value === 0);
    }
  }, []);

  const toggleMute = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  }, [isMuted]);

  const handleSeek = useCallback((event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const toggleFullscreen = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, []);

  // Gestion du menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Import de vidéo
  const handleVideoImport = useCallback(async (mediaFiles: MediaFile[]) => {
    if (mediaFiles.length > 0 && onDataChange) {
      const mediaFile = mediaFiles[0];
      onDataChange(id, {
        ...data,
        mediaId: mediaFile.metadata.id,
        label: mediaFile.metadata.name || data.label,
        videoUrl: null, // On ne stocke plus l'URL directement
      });
    }
    setIsEditing(false);
  }, [data, id, onDataChange]);

  // Création d'interaction
  const handleCreateInteraction = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (onCreateInteraction) {
      onCreateInteraction(id);
    }
  }, [onCreateInteraction, id]);

  // Formatage du temps
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />

      <Box sx={{ p: 2 }}>
        {!data.isPlaybackMode && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <Tooltip title="Ajouter une interaction">
              <IconButton
                onClick={handleCreateInteraction}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Paramètres">
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Box
          ref={containerRef}
          onClick={!data.isPlaybackMode ? () => setIsEditing(true) : undefined}
          sx={{
            cursor: data.isPlaybackMode ? 'default' : 'pointer',
            position: 'relative',
            minWidth: 200,
            minHeight: 150,
            bgcolor: 'black',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {videoUrl ? (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <video
                ref={videoRef}
                src={videoUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnd}
                onClick={data.isPlaybackMode ? togglePlayPause : undefined}
              />
              
              {/* Contrôles en mode lecture */}
              {data.isPlaybackMode && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                    p: 1,
                    transition: 'opacity 0.3s',
                    opacity: 1,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <IconButton
                      size="small"
                      onClick={togglePlayPause}
                      sx={{ color: 'white', mr: 1 }}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>

                    <Typography variant="caption" sx={{ color: 'white', mr: 1 }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>

                    <Box sx={{ position: 'relative', mr: 1 }}>
                      <IconButton
                        size="small"
                        onClick={toggleMute}
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        onMouseLeave={() => setShowVolumeSlider(false)}
                        sx={{ color: 'white' }}
                      >
                        {isMuted ? <MuteIcon /> : <VolumeIcon />}
                      </IconButton>
                      {showVolumeSlider && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 100,
                            p: 1,
                            bgcolor: 'rgba(0, 0, 0, 0.9)',
                            borderRadius: 1,
                          }}
                          onMouseEnter={() => setShowVolumeSlider(true)}
                          onMouseLeave={() => setShowVolumeSlider(false)}
                        >
                          <Slider
                            value={volume}
                            onChange={handleVolumeChange}
                            min={0}
                            max={1}
                            step={0.1}
                            orientation="vertical"
                            sx={{ height: 100 }}
                          />
                        </Box>
                      )}
                    </Box>

                    <IconButton
                      size="small"
                      onClick={toggleFullscreen}
                      sx={{ color: 'white' }}
                    >
                      <FullscreenIcon />
                    </IconButton>
                  </Box>

                  <Slider
                    value={currentTime}
                    onChange={handleSeek}
                    min={0}
                    max={duration}
                    step={0.1}
                    sx={{
                      color: 'primary.main',
                      '& .MuiSlider-thumb': {
                        width: 12,
                        height: 12,
                      },
                    }}
                  />
                </Box>
              )}

              {/* Bouton d'édition en mode édition */}
              {!data.isPlaybackMode && (
                <IconButton
                  onClick={() => setIsEditing(true)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    },
                  }}
                >
                  <EditIcon />
                </IconButton>
              )}
            </Box>
          ) : (
            <EmptyVideoState error={error} />
          )}
        </Box>
      </Box>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />

      {/* Menu des paramètres */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { setIsEditing(true); handleMenuClose(); }}>
          Changer la vidéo
        </MenuItem>
        {/* Ajoutez d'autres options de menu ici */}
      </Menu>

      {/* Dialog de la Media Library */}
      <Dialog
        open={isEditing}
        onClose={() => setIsEditing(false)}
        maxWidth="lg"
        fullWidth
      >
        <MediaLibrary
          onSelect={handleVideoImport}
          multiSelect={false}
          acceptedTypes={['video/*']}
        />
      </Dialog>
    </Box>
  );
});

export default VideoNode;
