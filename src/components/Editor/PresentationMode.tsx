import React, { useState, useCallback, useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Node, Edge } from 'reactflow';
import VideoNode from './nodes/VideoNode';
import ButtonNode from './nodes/button/ButtonNode';

interface PresentationModeProps {
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
}

const nodeTypes = {
  videoNode: VideoNode,
  buttonNode: ButtonNode,
};

const PresentationMode: React.FC<PresentationModeProps> = ({ nodes, edges, onClose }) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

  const findStartNode = useCallback(() => {
    const nodeWithNoIncoming = nodes.find(node => 
      !edges.some(edge => edge.target === node.id)
    );
    return nodeWithNoIncoming?.id;
  }, [nodes, edges]);

  const findNextNode = useCallback((nodeId: string) => {
    const outgoingEdge = edges.find(edge => edge.source === nodeId);
    return outgoingEdge?.target;
  }, [edges]);

  const handleNodeComplete = useCallback((nodeId: string) => {
    const nextNodeId = findNextNode(nodeId);
    if (nextNodeId) {
      setCurrentNodeId(nextNodeId);
    } else {
      onClose();
    }
  }, [findNextNode, onClose]);

  useEffect(() => {
    const startNodeId = findStartNode();
    if (startNodeId) {
      setCurrentNodeId(startNodeId);
    }
  }, [findStartNode]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose]);

  const currentNode = nodes.find(node => node.id === currentNodeId);
  if (!currentNode) return null;

  const NodeComponent = nodeTypes[currentNode.type as keyof typeof nodeTypes];
  if (!NodeComponent) return null;

  const nodeStyles = {
    videoNode: {
      width: '80vw',
      height: '80vh',
      '& video': {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      },
    },
    buttonNode: {
      '& .MuiButton-root': {
        fontSize: '2rem',
        padding: '1rem 2rem',
      },
    },
  };

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

      <Box 
        sx={{ 
          maxWidth: '90vw', 
          maxHeight: '90vh',
          ...(currentNode.type === 'videoNode' ? nodeStyles.videoNode : {}),
          ...(currentNode.type === 'buttonNode' ? nodeStyles.buttonNode : {}),
        }}
      >
        <NodeComponent
          id={currentNode.id}
          data={{
            ...currentNode.data,
            isPlaybackMode: true,
            isCurrentNode: true,
            onNodeComplete: () => handleNodeComplete(currentNode.id),
          }}
          type={currentNode.type}
          isConnectable={false}
          draggable={false}
          position={currentNode.position}
        />
      </Box>
    </Box>
  );
};

export default PresentationMode;
