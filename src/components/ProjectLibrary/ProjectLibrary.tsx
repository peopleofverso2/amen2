import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { ProjectService } from '../../services/projectService';
import { ExportService } from '../../services/exportService';
import { Project } from '../../types/project';
import { FullscreenPlayer } from '../Player/FullscreenPlayer';

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

  const handleExportProject = async (project: Project) => {
    try {
      setExporting(true);
      
      // Charger le projet complet avec ses nœuds
      const fullProject = await projectService.loadProject(project.id);
      if (!fullProject) {
        throw new Error('Project not found');
      }

      const exportService = new ExportService();
      const blob = await exportService.exportProject(fullProject);
      
      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'project'}.pov`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting project:', error);
      setError('Failed to export project');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);

      const exportService = new ExportService();
      const importedProject = await exportService.importProject(file);

      // Générer un ID unique en utilisant la Web Crypto API
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      const id = Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');

      // Créer un nouveau projet avec un nouvel ID
      const newProject: Project = {
        ...importedProject,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: `${importedProject.name || 'Imported Project'} (imported)`
      };
      
      // Sauvegarder le projet importé
      await projectService.saveProject(newProject);
      
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
      // Réinitialiser l'input file
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Bibliothèque de projets</Typography>
        <Box>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pov"
            onChange={handleImport}
          />
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ mr: 1 }}
          >
            Importer
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Nouveau projet
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {projects.map((project, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                {editingProject?.id === project.id ? (
                  <TextField
                    fullWidth
                    value={editingProject.name}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        name: e.target.value,
                      })
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateProjectName();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="h6" component="div">
                      {project.name}
                    </Typography>
                    <Box>
                      <Tooltip title="Exporter">
                        <IconButton
                          size="small"
                          onClick={() => handleExportProject(project)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Renommer">
                        <IconButton
                          size="small"
                          onClick={() =>
                            setEditingProject({
                              id: project.id,
                              name: project.name,
                            })
                          }
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
                      <Tooltip title="Lecture">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedProject(project);
                            setIsPlayerOpen(true);
                          }}
                        >
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                )}
                {project.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {project.description}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  Modifié le{' '}
                  {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => onProjectSelect(project.id)}
                >
                  Ouvrir
                </Button>
              </CardActions>
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
