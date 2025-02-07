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
import debounce from 'lodash.debounce';

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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const projectService = ProjectService.getInstance();

  // Gérer la fin d'une vidéo
  const onVideoEnd = useCallback((nodeId: string) => {
    if (!isPlaybackMode) return;

    const outgoingEdges = edges.filter(edge => edge.source === nodeId);
    if (outgoingEdges.length === 1) {
      // S'il n'y a qu'un seul lien sortant, passer automatiquement au nœud suivant
      const nextNodeId = outgoingEdges[0].target;
      setActiveNodeId(nextNodeId);
      setNodes(nds => nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          isCurrentNode: node.id === nextNodeId,
          isPlaying: node.id === nextNodeId
        }
      })));
    }
  }, [isPlaybackMode, edges, setNodes]);

  // Gérer le choix d'un bouton
  const handleChoiceSelect = useCallback((nodeId: string, choice: any) => {
    if (!isPlaybackMode) return;

    const outgoingEdges = edges.filter(edge => 
      edge.source === nodeId && edge.sourceHandle === `button-handle-${choice.id}`
    );

    if (outgoingEdges.length === 1) {
      const nextNodeId = outgoingEdges[0].target;
      setActiveNodeId(nextNodeId);
      setNodes(nds => nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          isCurrentNode: node.id === nextNodeId,
          isPlaying: node.id === nextNodeId
        }
      })));
    }
  }, [isPlaybackMode, edges, setNodes]);

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
              onDataChange: handleNodeDataChange,
              onVideoEnd,
              onChoiceSelect: handleChoiceSelect,
              getConnectedNodeId: (buttonId: string) => getConnectedNodeId(nodeId, buttonId),
            },
          };
        }
        return node;
      })
    );
  }, [isPlaybackMode, getConnectedNodeId, onVideoEnd, handleChoiceSelect]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const sourceNode = nodes.find(n => n.id === connection.source);
    const sourceHandle = connection.sourceHandle;
    let choiceId = null;

    if (sourceHandle && sourceHandle.startsWith('button-handle-')) {
      choiceId = sourceHandle.replace('button-handle-', '');
    }

    // Créer un lien de choix avec le texte du bouton
    const edge: Edge = {
      ...connection,
      id: `choice-${connection.source}-${connection.target}-${choiceId}`,
      type: 'choice',
      data: {
        choiceId,
        text: sourceNode?.data.choices?.find((c: any) => c.id === choiceId)?.text || ''
      },
      style: { strokeWidth: 2 }
    };

    // Mettre à jour les choix du nœud source
    setNodes(nds => nds.map(node => {
      if (node.id === connection.source) {
        const updatedChoices = (node.data.choices || []).map((choice: any) => {
          if (choice.id === choiceId) {
            return {
              ...choice,
              nextStepId: connection.target
            };
          }
          return choice;
        });
        
        return {
          ...node,
          data: {
            ...node.data,
            choices: updatedChoices
          }
        };
      }
      return node;
    }));

    setEdges(eds => [...eds, edge]);
  }, [nodes]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    // Mettre à jour les choix des nœuds source quand un lien est supprimé
    edgesToDelete.forEach(edge => {
      if (edge.data?.choiceId) {
        setNodes(nds => nds.map(node => {
          if (node.id === edge.source) {
            const updatedChoices = (node.data.choices || []).map((choice: any) => {
              if (choice.id === edge.data.choiceId) {
                return {
                  ...choice,
                  nextStepId: undefined
                };
              }
              return choice;
            });
            
            return {
              ...node,
              data: {
                ...node.data,
                choices: updatedChoices
              }
            };
          }
          return node;
        }));
      }
    });

    setEdges(eds => eds.filter(e => !edgesToDelete.includes(e)));
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId || !project) return;

    setIsSaving(true);
    try {
      console.log('Saving project:', projectId);
      
      // Créer une copie propre des nœuds sans les callbacks
      const cleanNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onDataChange: undefined,
          onVideoEnd: undefined,
          onChoiceSelect: undefined,
          getConnectedNodeId: undefined,
          isPlaybackMode: undefined,
          isCurrentNode: undefined,
          isPlaying: undefined
        }
      }));

      // Mettre à jour le projet avec les derniers changements
      const updatedProject = {
        ...project,
        nodes: cleanNodes,
        edges,
        updatedAt: new Date().toISOString()
      };

      console.log('Saving updated project:', updatedProject);
      await projectService.saveProject(updatedProject);
      setProject(updatedProject);
      console.log('Project saved successfully');
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, project, nodes, edges, projectService]);

  // Démarrer la lecture
  const startPlayback = useCallback(() => {
    setIsPlaybackMode(true);
    // Trouver le premier nœud (sans connexions entrantes)
    const targetNodeIds = new Set(edges.map(edge => edge.target));
    const startNodes = nodes.filter(node => !targetNodeIds.has(node.id));
    if (startNodes.length > 0) {
      setActiveNodeId(startNodes[0].id);
    }
  }, [nodes, edges]);

  // Arrêter la lecture
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

  // Charger le projet au démarrage
  useEffect(() => {
    let isSubscribed = true;

    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        console.log('Loading project:', projectId);
        const loadedProject = await projectService.loadProject(projectId);
        if (loadedProject && isSubscribed) {
          console.log('Project loaded:', loadedProject);
          setProject(loadedProject);
          
          // Mise à jour des nœuds avec les callbacks
          const nodesWithCallbacks = loadedProject.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              onDataChange: handleNodeDataChange,
              onVideoEnd,
              onChoiceSelect: handleChoiceSelect,
              getConnectedNodeId: (buttonId: string) => getConnectedNodeId(node.id, buttonId),
            },
          }));
          
          setNodes(nodesWithCallbacks);
          setEdges(loadedProject.edges);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };

    loadProject();
    return () => {
      isSubscribed = false;
    };
  }, [projectId]); // Ne dépend que de projectId

  // Sauvegarder lors des changements de nœuds ou d'arêtes
  useEffect(() => {
    if (!project) return;
    
    const saveTimeout = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(saveTimeout);
  }, [nodes, edges, handleSave, project]);

  // Mettre à jour les nœuds avec les callbacks quand le mode lecture change
  useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDataChange: handleNodeDataChange,
        onVideoEnd,
        onChoiceSelect: handleChoiceSelect,
        getConnectedNodeId: (buttonId: string) => getConnectedNodeId(node.id, buttonId),
        isPlaybackMode,
        isCurrentNode: node.id === activeNodeId,
        isPlaying: isPlaybackMode && node.id === activeNodeId
      }
    })));
  }, [isPlaybackMode, activeNodeId, handleNodeDataChange, onVideoEnd, getConnectedNodeId, handleChoiceSelect]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
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
