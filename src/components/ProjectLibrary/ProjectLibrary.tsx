import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
  GetApp as GetAppIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { ProjectService } from '../../services/projectService';
import { ProjectMetadata } from '../../types/project';
import ProjectList from '../ProjectList/ProjectList';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

interface ProjectLibraryProps {
  onProjectSelect: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
}

const ProjectLibrary: React.FC<ProjectLibraryProps> = ({ onProjectSelect, onProjectDelete }) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const projectService = ProjectService.getInstance();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      console.log('Loading projects...');
      const projectList = await projectService.getProjectList();
      console.log('Projects loaded:', projectList);
      setProjects(projectList);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load projects');
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) {
      setError('Title is required');
      return;
    }

    try {
      console.log('Creating project with title:', newProjectTitle);
      const projectId = await projectService.createProject(
        newProjectTitle,
        newProjectDescription
      );
      console.log('Project created with ID:', projectId);
      
      setIsCreateDialogOpen(false);
      setNewProjectTitle('');
      setNewProjectDescription('');
      
      console.log('Reloading projects...');
      await loadProjects();
      
      console.log('Selecting new project...');
      onProjectSelect(projectId);
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCreateProject();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Scenario Library
        </Typography>
        <Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsCreateDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Create New Scenario
          </Button>
        </Box>
      </Box>

      <ProjectList 
        projects={projects} 
        onProjectSelect={onProjectSelect} 
        onProjectDelete={handleDeleteProject}
      />

      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Scenario</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            onKeyPress={handleKeyPress}
            error={error === 'Title is required'}
            helperText={error === 'Title is required' ? 'Title is required' : ''}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateProject} 
            variant="contained" 
            color="primary"
            disabled={!newProjectTitle.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectLibrary;
