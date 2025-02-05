import React, { useState, useCallback, useEffect } from 'react';
import { Box, IconButton, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ReactFlowProvider, ReactFlow } from 'reactflow';
import { VideoNodeData, ButtonNodeData } from '../../types/nodes';
import VideoNode from '../Editor/nodes/VideoNode';
import ButtonNode from '../Editor/nodes/button/ButtonNode';

const nodeTypes = {
  video: VideoNode,
  button: ButtonNode,
};

interface ScenarioPreviewProps {
  nodes: any[];
  edges: any[];
  onClose: () => void;
}

const ScenarioPreview: React.FC<ScenarioPreviewProps> = ({
  nodes,
  edges,
  onClose,
}) => {
  const [showControls, setShowControls] = useState(false);
  const [mouseTimer, setMouseTimer] = useState<NodeJS.Timeout | null>(null);

  // Gestion de la touche Echap
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Gestion du mouvement de la souris
  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    if (mouseTimer) {
      clearTimeout(mouseTimer);
    }

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 2000);

    setMouseTimer(timer);
  }, [mouseTimer]);

  // Nettoyage du timer
  useEffect(() => {
    return () => {
      if (mouseTimer) {
        clearTimeout(mouseTimer);
      }
    };
  }, [mouseTimer]);

  // Préparation des nœuds pour le mode plein écran
  const previewNodes = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      isPlaybackMode: true,
      style: {
        ...node.style,
        width: '100%',
        height: '100%',
      },
    },
  }));

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
      }}
      onMouseMove={handleMouseMove}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={previewNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.5}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={false}
        />
      </ReactFlowProvider>

      <Fade in={showControls}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Fade>
    </Box>
  );
};

export default ScenarioPreview;
