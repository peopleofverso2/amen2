import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Tooltip,
  Grid,
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
import { ExportService } from '../../services/exportService';
import { Project } from '../../types/project';
import { FullscreenPlayer } from '../Player/FullscreenPlayer';
import { DatabaseService } from '../../services/databaseService'; // Import DatabaseService

interface ProjectLibraryProps {
  onProjectSelect: (projectId: string) => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  onProjectSelect,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectService = ProjectService.getInstance();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const projectsList = await projectService.listProjects();
      console.log('Loaded projects:', projectsList);
      setProjects(projectsList);
    } catch (error) {
      console.error('Error loading projects:', error);
      alert('Erreur lors du chargement des projets');
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const projectId = await projectService.createProject(
        newProjectName,
        newProjectDescription
      );
      setIsCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      await loadProjects();
      onProjectSelect(projectId);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      try {
        await projectService.deleteProject(id);
        setProjects(projects.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const handleUpdateProjectName = async () => {
    if (!editingProject || !editingProject.name.trim()) return;

    try {
      await projectService.updateProjectName(
        editingProject.id,
        editingProject.name
      );
      setEditingProject(null);
      await loadProjects();
    } catch (error) {
      console.error('Error updating project name:', error);
    }
  };

  const handleExport = async (project: Project, includeVideos: boolean = false) => {
    try {
      const exportService = new ExportService();
      const blob = await exportService.exportProject(project, includeVideos);
      
      // Créer un nom de fichier avec la date
      const date = new Date().toISOString().split('T')[0];
      const filename = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${date}${includeVideos ? '_full' : ''}.pov`;
      
      // Télécharger le fichier
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting project:', error);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    try {
      console.log('Starting import for file:', file.name);
      setImporting(true);
      setError(null);

      const exportService = new ExportService();
      const importedProject = await exportService.importProject(file);
      console.log('Project imported successfully:', importedProject);

      // Générer un ID unique en utilisant la Web Crypto API
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      const id = Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
      console.log('Generated new project ID:', id);

      // Créer un nouveau projet avec un nouvel ID
      const newProject: Project = {
        ...importedProject,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: `${importedProject.name || 'Imported Project'} (imported)`
      };
      console.log('Created new project:', newProject);
      
      // Sauvegarder le projet importé
      await projectService.saveProject(newProject);
      console.log('Project saved successfully');
      
      // Rafraîchir la liste des projets
      await loadProjects();

      // Sélectionner le nouveau projet
      if (onProjectSelect) {
        onProjectSelect(newProject.id);
      }
    } catch (error) {
      console.error('Error importing project:', error);
      setError('Failed to import project. Please make sure the file is valid.');
    } finally {
      setImporting(false);
    }
  };

  const handleCleanDatabase = async () => {
    try {
      await DatabaseService.clearDatabase();
      window.location.reload();
    } catch (error) {
      console.error('Error cleaning database:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          component="label"
          startIcon={<UploadIcon />}
        >
          Importer un projet
          <input
            type="file"
            accept=".pov,.json"
            hidden
            onChange={handleImport}
            ref={fileInputRef}
          />
        </Button>
        <Button
          variant="contained"
          startIcon={<GetAppIcon />}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Nouveau projet
        </Button>
      </Box>

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    {project.name}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Tooltip title="Ouvrir">
                      <IconButton
                        size="small"
                        onClick={() => onProjectSelect(project.id)}
                        color="primary"
                      >
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Exporter (sans vidéos)">
                      <IconButton
                        size="small"
                        onClick={() => handleExport(project)}
                      >
                        <GetAppIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Exporter avec vidéos (sauvegarde complète)">
                      <IconButton
                        size="small"
                        onClick={() => handleExport(project, true)}
                      >
                        <CloudDownloadIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Renommer">
                      <IconButton
                        size="small"
                        onClick={() => handleStartRename(project)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Supprimer">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                {project.description && (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {project.description}
                  </Typography>
                )}
                
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Modifié le {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      >
        <DialogTitle>Nouveau projet</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du projet"
            fullWidth
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
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
          <Button onClick={() => setIsCreateDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleCreateProject} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {selectedProject && (
        <FullscreenPlayer
          project={selectedProject}
          open={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}
      {error && (
        <Typography variant="body2" color="error.main">
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default ProjectLibrary;
