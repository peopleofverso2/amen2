import React, { useState, useCallback, DragEvent, useEffect, useRef, memo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
  addEdge,
  NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import VideoNode from './nodes/VideoNode2';
import { Box } from '@mui/material';
import 'reactflow/dist/style.css';
import { ProjectService } from '../../services/projectService';
import { Project } from '../../types/project';
import Sidebar from './controls/Sidebar';

// Créer un composant mémorisé pour le nœud vidéo
const MemoizedVideoNode = memo((props: any) => <VideoNode {...props} />);

// Définir les types de nœuds en dehors du composant
const nodeTypes: NodeTypes = {
  video: MemoizedVideoNode,
};

let id = 0;
const getId = () => `node_${id++}`;

interface ScenarioEditorProps {
  projectId: string;
  onBackToLibrary?: () => void;
}

function ScenarioEditorContent({ projectId, onBackToLibrary }: ScenarioEditorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleNodeDataChange = useCallback((nodeId: string, newData: any) => {
    console.log('Updating node data:', nodeId, newData);
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          console.log('Found node to update:', node);
          const updatedNode = {
            ...node,
            data: { 
              ...node.data, 
              ...newData,
              onDataChange: handleNodeDataChange 
            },
          };
          console.log('Updated node:', updatedNode);
          return updatedNode;
        }
        return node;
      })
    );
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      console.log('Dropped node type:', type);
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
        },
      };

      console.log('Creating new node:', newNode);
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, handleNodeDataChange]
  );

  const handleSave = useCallback(async () => {
    if (!projectId || !project) return;

    setIsSaving(true);
    try {
      console.log('Saving project:', projectId);
      const projectService = new ProjectService();
      const updatedProject = {
        ...project,
        nodes: nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            onDataChange: undefined
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
  }, [projectId, project, nodes, edges]);

  const startPlayback = useCallback(() => {
    setIsPlaybackMode(true);
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: { 
        ...node.data, 
        isPlaybackMode: true,
      }
    })));
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaybackMode(false);
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: { 
        ...node.data, 
        isPlaybackMode: false,
      }
    })));
  }, []);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        console.log('Loading project:', projectId);
        const projectService = new ProjectService();
        const loadedProject = await projectService.getProject(projectId);
        console.log('Loaded project:', loadedProject);
        
        if (loadedProject) {
          setProject(loadedProject);
          if (loadedProject.nodes) {
            setNodes(loadedProject.nodes.map(node => ({
              ...node,
              data: { 
                ...node.data, 
                onDataChange: handleNodeDataChange,
                mediaId: node.data.mediaId,
                isPlaybackMode: false,
              }
            })));
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
  }, [projectId, handleNodeDataChange]);

  // Save project data when nodes or edges change
  useEffect(() => {
    const saveProject = async () => {
      if (!projectId || !project) return;

      try {
        console.log('Saving project:', projectId);
        const projectService = new ProjectService();
        const updatedProject = {
          ...project,
          nodes: nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              onDataChange: undefined
            }
          })),
          edges,
          updatedAt: new Date().toISOString()
        };
        await projectService.saveProject(updatedProject);
        console.log('Project saved successfully');
      } catch (error) {
        console.error('Error saving project:', error);
      }
    };

    const debounceTimeout = setTimeout(saveProject, 1000);
    return () => clearTimeout(debounceTimeout);
  }, [projectId, project, nodes, edges]);

  return (
    <Box
      ref={reactFlowWrapper}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
      }}
    >
      <Box sx={{ flexGrow: 1, height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            setNodes((nds) => {
              const newNodes = [...nds];
              changes.forEach((change) => {
                const nodeIndex = newNodes.findIndex((n) => n.id === change.id);
                if (nodeIndex !== -1) {
                  if (change.type === 'position') {
                    newNodes[nodeIndex] = {
                      ...newNodes[nodeIndex],
                      position: change.position || newNodes[nodeIndex].position,
                    };
                  }
                }
              });
              return newNodes;
            });
          }}
          onEdgesChange={(changes) => {
            setEdges((eds) => {
              const newEdges = [...eds];
              changes.forEach((change) => {
                const edgeIndex = newEdges.findIndex((e) => e.id === change.id);
                if (edgeIndex !== -1) {
                  if (change.type === 'remove') {
                    newEdges.splice(edgeIndex, 1);
                  }
                }
              });
              return newEdges;
            });
          }}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Box>
      <Sidebar 
        onSave={handleSave}
        onPlay={startPlayback}
        isPlaybackMode={isPlaybackMode}
        onPlayModeToggle={isPlaybackMode ? stopPlayback : startPlayback}
        onBackToLibrary={onBackToLibrary}
        isSaving={isSaving}
      />
    </Box>
  );
}

export default function ScenarioEditor(props: ScenarioEditorProps) {
  return (
    <ReactFlowProvider>
      <ScenarioEditorContent {...props} />
    </ReactFlowProvider>
  );
}
