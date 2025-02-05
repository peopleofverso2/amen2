import { useState, useCallback, DragEvent, useEffect, useRef } from 'react';
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
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
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
          : type === 'button'
            ? {
                id: newNodeId,
                label: 'Nouveau bouton',
                text: 'Cliquez-moi',
                style: {
                  backgroundColor: '#2196f3',
                  textColor: '#ffffff',
                  borderRadius: '4px',
                  fontSize: '14px',
                  borderStyle: 'none',
                  borderColor: '#000000',
                  borderWidth: '1px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  padding: '8px 16px',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  hoverBackgroundColor: '#1976d2',
                  hoverTextColor: '#ffffff',
                  hoverScale: '1.05'
                },
                variant: 'contained',
                size: 'medium',
                isPlaybackMode: isPlaybackMode,
                onDataChange: (data: any) => handleNodeDataChange(newNodeId, data),
              }
            : {
                label: `Nouveau ${type}`,
              },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [isPlaybackMode, reactFlowInstance]
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
          onOpen={onBackToLibrary}
          isPlayMode={isPlaybackMode}
          onPlayModeToggle={() => setIsPlaybackMode(!isPlaybackMode)}
        />
        <Box 
          ref={reactFlowWrapper}
          sx={{ 
            flex: 1, 
            position: 'relative',
            height: 'calc(100vh - 64px)',
            '& .react-flow__panel': {
              zIndex: 5
            },
            '& .react-flow__minimap': {
              zIndex: 5
            },
            '& .react-flow__controls': {
              zIndex: 5
            },
            '& .react-flow__handle': {
              zIndex: 3
            },
            '& .react-flow__node': {
              zIndex: 2
            },
            '& .react-flow__edge': {
              zIndex: 1
            },
            '& .react-flow__background': {
              zIndex: 0
            }
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onInit={onInit}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Control"
            snapToGrid={true}
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true
            }}
            proOptions={{ hideAttribution: true }}
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
