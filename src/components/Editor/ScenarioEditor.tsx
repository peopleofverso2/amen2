import { useState, useCallback, DragEvent, useEffect, useRef, KeyboardEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeProps,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import { Box, AppBar, Toolbar, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import 'reactflow/dist/style.css';

import { CustomNode, CustomEdge } from '../../types/nodes';
import { Project } from '../../types/project';
import { ProjectService } from '../../services/projectService';
import Sidebar from './controls/Sidebar';
import BaseNode from './nodes/BaseNode';
import VideoNode from './nodes/VideoNode';
import ButtonNode from './nodes/button/ButtonNode';

const nodeTypes = {
  base: BaseNode,
  video: VideoNode,
  button: ButtonNode,
};

let id = 0;
const getId = () => `node_${id++}`;

interface ScenarioEditorProps {
  projectId?: string;
  onBackToLibrary: () => void;
}

const Flow: React.FC<ScenarioEditorProps> = ({ projectId, onBackToLibrary }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge[]>([]);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const projectService = ProjectService.getInstance();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [history, setHistory] = useState<{ nodes: CustomNode[]; edges: CustomEdge[] }[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);

  const onInit = useCallback((instance: any) => {
    setReactFlowInstance(instance);
  }, []);

  // Charger le projet au démarrage
  useEffect(() => {
    const loadProject = async () => {
      if (projectId) {
        try {
          const project = await projectService.loadProject(projectId);
          setNodes(project.nodes);
          setEdges(project.edges);
        } catch (error) {
          console.error('Error loading project:', error);
        }
      }
    };
    loadProject();
  }, [projectId]);

  const handleNodeDataChange = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = getId();
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: type === 'video' 
          ? { 
              id: newNodeId,
              label: 'Nouvelle vidéo',
              videoUrl: '',
              buttons: [],
              isPlaybackMode: isPlaybackMode,
              onDataChange: (data: any) => handleNodeDataChange(newNodeId, data),
            }
          : {
              id: newNodeId,
              label: 'Nouveau bouton',
              text: 'Cliquez-moi',
              isPlaybackMode: isPlaybackMode,
              onDataChange: (data: any) => handleNodeDataChange(newNodeId, data),
            },
      };

      setNodes((nds) => nds.concat(newNode));
      addToHistory({ nodes: [...nodes, newNode], edges });
    },
    [reactFlowInstance, nodes, edges, isPlaybackMode]
  );

  const handleSave = async () => {
    if (!projectId) return;
    
    setIsSaving(true);
    try {
      const project = await projectService.loadProject(projectId);
      const updatedProject: Project = {
        ...project,
        nodes,
        edges,
        updatedAt: new Date().toISOString()
      };
      await projectService.saveProject(updatedProject);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setNodes((nds) => nds.filter((node) => !deleted.find((del) => del.id === node.id)));
    },
    []
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      setEdges((eds) => eds.filter((edge) => !deleted.find((del) => del.id === edge.id)));
    },
    []
  );

  // Initialiser l'historique avec l'état initial
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setHistory([{ nodes, edges }]);
      setCurrentHistoryIndex(0);
    }
  }, []); // Ne s'exécute qu'une fois au montage

  // Sauvegarder l'état dans l'historique lorsque les nœuds ou les liens changent
  useEffect(() => {
    if (!isUndoRedo && (nodes.length > 0 || edges.length > 0)) {
      const newState = { nodes, edges };
      setHistory(prev => {
        // Ne pas ajouter si l'état est identique au dernier
        if (currentHistoryIndex >= 0 && 
            JSON.stringify(prev[currentHistoryIndex]) === JSON.stringify(newState)) {
          return prev;
        }
        const newHistory = prev.slice(0, currentHistoryIndex + 1);
        return [...newHistory, newState];
      });
      setCurrentHistoryIndex(prev => prev + 1);
    }
    setIsUndoRedo(false);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      setIsUndoRedo(true);
      const previousState = history[currentHistoryIndex - 1];
      if (previousState) {
        setNodes(previousState.nodes);
        setEdges(previousState.edges);
        setCurrentHistoryIndex(prev => prev - 1);
      }
    }
  }, [currentHistoryIndex, history]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      setIsUndoRedo(true);
      const nextState = history[currentHistoryIndex + 1];
      if (nextState) {
        setNodes(nextState.nodes);
        setEdges(nextState.edges);
        setCurrentHistoryIndex(prev => prev + 1);
      }
    }
  }, [currentHistoryIndex, history]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedNodes = nodes.filter(node => node.selected);
      const selectedEdges = edges.filter(edge => edge.selected);
      
      if (selectedNodes.length > 0) {
        onNodesDelete(selectedNodes);
      }
      if (selectedEdges.length > 0) {
        onEdgesDelete(selectedEdges);
      }
    }

    // Gérer Ctrl+Z pour annuler
    if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleUndo();
    }

    // Gérer Ctrl+Y pour rétablir
    if (event.key === 'y' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleRedo();
    }
  }, [nodes, edges, onNodesDelete, onEdgesDelete, handleUndo, handleRedo]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onBackToLibrary}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            Éditeur de scénario
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar 
          onSave={handleSave}
          isPlayMode={isPlaybackMode}
          onPlayModeToggle={() => setIsPlaybackMode(!isPlaybackMode)}
        />
        <Box 
          ref={reactFlowWrapper}
          sx={{ 
            flex: 1, 
            position: 'relative',
            height: 'calc(100vh - 64px)',
            '& .react-flow__node': {
              '&.selected': {
                boxShadow: '0 0 0 2px #1976d2',
              }
            },
            '& .react-flow__handle': {
              background: '#1976d2',
              width: 8,
              height: 8,
            },
            '& .react-flow__edge': {
              '&.selected': {
                stroke: '#1976d2',
                strokeWidth: 3,
              }
            }
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </Box>
      </Box>
    </Box>
  );
};

const ScenarioEditor: React.FC<ScenarioEditorProps> = (props) => (
  <ReactFlowProvider>
    <Flow {...props} />
  </ReactFlowProvider>
);

export default ScenarioEditor;
