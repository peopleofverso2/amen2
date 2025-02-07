import React, { useState, useCallback, useEffect, useRef, DragEvent, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  Background,
  Controls,
  MiniMap,
  NodeChange,
  EdgeChange,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
} from 'reactflow';
import { Box } from '@mui/material';
import VideoNode2 from './nodes/VideoNode2';
import ChoiceEdge from './edges/ChoiceEdge';
import { ProjectService } from '../../services/projectService';
import { Project } from '../../types/project';
import Sidebar from './controls/Sidebar';
import 'reactflow/dist/style.css';

const nodeTypes: NodeTypes = {
  videoNode2: VideoNode2,
};

const edgeTypes: EdgeTypes = {
  'choice-link': ChoiceEdge,
};

function getId(): string {
  return `node-${Math.random().toString(36).substr(2, 9)}`;
}

interface ScenarioEditorProps {
  projectId?: string;
  onBackToLibrary?: () => void;
}

function ScenarioEditorContent({ projectId, onBackToLibrary }: ScenarioEditorProps) {
  const [nodes, setNodes, onNodesChange] = useState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useState<Edge[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const projectService = ProjectService.getInstance();

  const onNodesChangeCallback = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChangeCallback = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const getConnectedNodeId = useCallback((nodeId: string, buttonId: string) => {
    const edge = edges.find(e => 
      e.source === nodeId && 
      e.sourceHandle === `button-handle-${buttonId}`
    );
    return edge ? edge.target : null;
  }, [edges]);

  const handleNodeDataChange = useCallback((nodeId: string, newData: any) => {
    // Si on a un nextNodeId en mode lecture, activer le nœud suivant
    if (newData.nextNodeId && isPlaybackMode) {
      setActiveNodeId(newData.nextNodeId);
      return;
    }

    // Mise à jour normale des données du nœud
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
              // Ajouter la fonction pour obtenir le nœud connecté
              getConnectedNodeId: (buttonId: string) => 
                getConnectedNodeId(nodeId, buttonId),
            },
          };
        }
        return node;
      })
    );
  }, [setNodes, isPlaybackMode, getConnectedNodeId]);

  const onConnect = useCallback(
    (params: Connection) => {
      // Créer un lien de choix si c'est depuis un bouton
      if (params.sourceHandle?.startsWith('button-handle-')) {
        const edge: Edge = {
          ...params,
          id: `choice-${params.source}-${params.target}-${params.sourceHandle}`,
          type: 'choice-link',
          style: { strokeWidth: 3 },
        };
        setEdges((eds) => [...eds, edge]);
      } else {
        // Lien normal
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [setEdges]
  );

  const onVideoEnd = useCallback((nodeId: string) => {
    if (isPlaybackMode) {
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      if (outgoingEdges.length > 0) {
        setActiveNodeId(outgoingEdges[0].target);
      } else {
        setIsPlaybackMode(false);
        setActiveNodeId(null);
      }
    }
  }, [isPlaybackMode, edges]);

  const handleSave = useCallback(async () => {
    if (!projectId || !project) return;

    setIsSaving(true);
    try {
      console.log('Saving project:', projectId);
      const updatedProject = {
        ...project,
        nodes: nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            onDataChange: undefined,
            onVideoEnd: undefined
          }
        })),
        edges,
        updatedAt: new Date().toISOString()
      };
      await projectService.saveProject(updatedProject);
      console.log('Project saved successfully');
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, project, nodes, edges, projectService]);

  const startPlayback = useCallback(() => {
    setIsPlaybackMode(true);
    // Trouver le premier nœud (sans connexions entrantes)
    const targetNodeIds = new Set(edges.map(edge => edge.target));
    const startNodes = nodes.filter(node => !targetNodeIds.has(node.id));
    if (startNodes.length > 0) {
      setActiveNodeId(startNodes[0].id);
    }
  }, [nodes, edges]);

  const stopPlayback = useCallback(() => {
    setIsPlaybackMode(false);
    setActiveNodeId(null);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { 
          label: `${type} node`,
          onDataChange: handleNodeDataChange,
          mediaId: undefined,
          isPlaybackMode: false,
          getConnectedNodeId: (buttonId: string) => getConnectedNodeId(getId(), buttonId),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, handleNodeDataChange, getConnectedNodeId]
  );

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        console.log('Loading project:', projectId);
        const loadedProject = await projectService.loadProject(projectId);
        console.log('Loaded project:', loadedProject);
        
        if (loadedProject) {
          setProject(loadedProject);
          
          // Charger les nœuds avec les callbacks de base
          if (loadedProject.nodes) {
            const nodesWithCallbacks = loadedProject.nodes.map(node => ({
              ...node,
              data: {
                ...node.data,
                onDataChange: handleNodeDataChange,
                onVideoEnd: () => onVideoEnd(node.id),
                isPlaybackMode: false,
              }
            }));
            setNodes(nodesWithCallbacks);
          }
          
          if (loadedProject.edges) {
            setEdges(loadedProject.edges);
          }
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };

    loadProject();
  }, [projectId]);  // Ne dépend que de projectId

  useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDataChange: handleNodeDataChange,
        getConnectedNodeId: (buttonId: string) => getConnectedNodeId(node.id, buttonId),
      }
    })));
  }, [handleNodeDataChange, getConnectedNodeId]);

  useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isPlaybackMode: isPlaybackMode && node.id === activeNodeId,
      }
    })));
  }, [isPlaybackMode, activeNodeId]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeCallback}
          onEdgesChange={onEdgesChangeCallback}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'videoNode2':
                  return '#00ff00';
                default:
                  return '#eee';
              }
            }}
          />
        </ReactFlow>
      </div>
      <Sidebar
        onSave={handleSave}
        isSaving={isSaving}
        onBackToLibrary={onBackToLibrary}
        isPlaybackMode={isPlaybackMode}
        onStartPlayback={startPlayback}
        onStopPlayback={stopPlayback}
      />
    </Box>
  );
}

function ScenarioEditor(props: ScenarioEditorProps) {
  return (
    <ReactFlowProvider>
      <ScenarioEditorContent {...props} />
    </ReactFlowProvider>
  );
}

export default ScenarioEditor;
