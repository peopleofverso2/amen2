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
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
} from '@mui/icons-material';
import { ProjectService } from '../../services/projectService';
import { ExportService } from '../../services/exportService';
import { Project } from '../../types/project';

interface ProjectLibraryProps {
  onProjectSelect: (projectId: string) => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  onProjectSelect,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectService = ProjectService.getInstance();
  const exportService = ExportService.getInstance();

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
      // Charger le projet complet avec ses nœuds
      const fullProject = await projectService.loadProject(project.id);
      
      const exportData = await exportService.exportProject(
        fullProject,
        fullProject.nodes,
        fullProject.edges
      );
      
      // Convertir en blob
      const blob = new Blob([JSON.stringify(exportData)], {
        type: 'application/json',
      });
      
      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.pov`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting project:', error);
      alert('Erreur lors de l\'export du projet');
    }
  };

  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('No data');
          
          const importData = await exportService.importProject(data as ArrayBuffer);
          
          // Créer un nouveau projet avec un nouvel ID
          const newProject = {
            ...importData.project,
            id: crypto.randomUUID(), // Générer un nouvel ID
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Sauvegarder le projet
          await projectService.saveProject(newProject);
          
          // Rafraîchir la liste
          await loadProjects();
          
          // Sélectionner le nouveau projet
          onProjectSelect(newProject.id);
          
          alert('Projet importé avec succès !');
        } catch (error) {
          console.error('Error importing project:', error);
          alert('Erreur lors de l\'import du projet');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Erreur lors de la lecture du fichier');
    }
    
    // Réinitialiser l'input file pour permettre de réimporter le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            onChange={handleImportProject}
          />
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
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
                          <FileDownloadIcon />
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
    </Box>
  );
};

export default ProjectLibrary;
