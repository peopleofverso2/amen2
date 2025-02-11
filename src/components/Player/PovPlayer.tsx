import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, Button, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LocalStorageAdapter } from '../../services/storage/LocalStorageAdapter';
import { MediaLibraryService } from '../../services/MediaLibraryService';
import { MediaFile } from '../../types/media';

interface PovPlayerProps {
  scenario: {
    nodes: {
      id: string;
      data: {
        mediaId?: string;
        content?: {
          videoUrl?: string;
          video?: {
            url?: string;
            name?: string;
          };
          choices?: {
            id: string;
            text: string;
          }[];
        };
      };
    }[];
    edges: {
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      data?: {
        label?: string;
      };
    }[];
    media?: Record<string, MediaFile>;
  };
  onClose: () => void;
}

const PovPlayer: React.FC<PovPlayerProps> = ({ scenario, onClose }) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [choices, setChoices] = useState<{ id: string; text: string; targetId: string }[]>([]);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaLibrary = useRef(MediaLibraryService.getInstance());

  // Trouver le premier nœud
  useEffect(() => {
    if (!scenario || !scenario.nodes || !Array.isArray(scenario.nodes)) {
      console.error('Invalid scenario structure:', scenario);
      return;
    }

    if (scenario.nodes.length > 0) {
      const startNode = scenario.nodes[0];
      setCurrentNodeId(startNode.id);
    }
  }, [scenario]);

  // Charger la vidéo du nœud actuel
  useEffect(() => {
    const loadVideo = async () => {
      if (!currentNodeId || !scenario || !scenario.nodes || !mediaLibrary.current) return;

      const node = scenario.nodes.find(n => n.id === currentNodeId);
      if (!node || !node.data) return;

      setVideoEnded(false);

      // Récupérer l'URL de la vidéo
      let url = null;
      if (node.data.mediaId && scenario.media?.[node.data.mediaId]) {
        const mediaFile = scenario.media[node.data.mediaId];
        if (mediaFile.url) {
          url = mediaFile.url;
        }
      } else if (node.data.content?.videoUrl) {
        url = node.data.content.videoUrl;
      } else if (node.data.content?.video?.url) {
        url = node.data.content.video.url;
      }

      setVideoUrl(url);

      // Trouver les choix disponibles
      const nodeChoices = node.data.content?.choices || [];
      const edges = scenario.edges?.filter(e => e.source === currentNodeId) || [];
      
      const availableChoices = nodeChoices.map(choice => {
        const edge = edges.find(e => e.sourceHandle === `button-handle-${choice.id}`);
        return {
          id: choice.id,
          text: choice.text,
          targetId: edge?.target || ''
        };
      }).filter(choice => choice.targetId);

      // Si pas de choix mais un lien simple, créer un choix "Continuer"
      if (availableChoices.length === 0 && edges.length === 1) {
        availableChoices.push({
          id: 'continue',
          text: 'Continuer',
          targetId: edges[0].target
        });
      }

      setChoices(availableChoices);
    };

    loadVideo();

    // Nettoyer l'URL du blob
    return () => {
      if (videoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [currentNodeId, scenario]);

  // Gérer la fin de la vidéo
  const handleVideoEnd = useCallback(() => {
    console.log('Video ended');
    setVideoEnded(true);
  }, []);

  // Gérer le choix de l'utilisateur
  const handleChoice = useCallback((targetId: string) => {
    console.log('Choice selected:', targetId);
    setVideoEnded(false);
    setCurrentNodeId(targetId);
  }, []);

  // Gérer la fermeture
  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        onClose();
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err);
        onClose();
      });
    } else {
      onClose();
    }
  }, [onClose]);

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        bgcolor: 'black',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      {/* Bouton Fermer */}
      <IconButton
        onClick={handleClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          zIndex: 10000
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* Lecteur vidéo */}
      {videoUrl && (
        <Box sx={{ width: '100%', maxWidth: '1280px', aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            controls
            style={{ width: '100%', height: '100%' }}
            onEnded={handleVideoEnd}
          />
        </Box>
      )}

      {/* Boutons de choix */}
      {choices.length > 0 && (videoEnded || !videoUrl) && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            left: 0,
            right: 0,
            display: 'flex',
            gap: 3,
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '0 32px',
            zIndex: 10000
          }}
        >
          {choices.map(choice => (
            <Button
              key={choice.id}
              variant="contained"
              onClick={() => handleChoice(choice.targetId)}
              sx={{
                minWidth: '280px',
                height: '64px',
                fontSize: '1.2rem',
                fontWeight: 500,
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '32px',
                textTransform: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  transform: 'scale(1.02)'
                },
                '&:active': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                  transform: 'scale(0.98)'
                }
              }}
            >
              {choice.text}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PovPlayer;
