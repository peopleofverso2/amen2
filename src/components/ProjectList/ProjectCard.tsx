import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  Tooltip,
  Dialog,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { ProjectMetadata } from '../../types/project';
import PovPlayer from '../Player/PovPlayer';
import { PovExportService } from '../../services/PovExportService';
import { ProjectService } from '../../services/projectService';

interface ProjectCardProps {
  project: ProjectMetadata;
  onProjectSelect: (projectId: string) => void;
  onProjectDelete?: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onProjectSelect,
  onProjectDelete,
}) => {
  const [isPlayDialogOpen, setIsPlayDialogOpen] = useState(false);
  const [povScenario, setPovScenario] = useState<any>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePlayClick = async () => {
    try {
      const projectService = ProjectService.getInstance();
      const fullProject = await projectService.getProject(project.projectId);
      const povExportService = PovExportService.getInstance();
      const scenario = await povExportService.exportScenario(
        fullProject.nodes,
        fullProject.edges,
        fullProject.scenario.title
      );
      setPovScenario(scenario);
      setIsPlayDialogOpen(true);
    } catch (error) {
      console.error('Error exporting scenario:', error);
    }
  };

  return (
    <>
      <Card 
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" gutterBottom>
            {project.scenarioTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created: {formatDate(project.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last modified: {formatDate(project.updatedAt)}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
          <Tooltip title="Play Scenario">
            <IconButton 
              size="small" 
              color="primary"
              onClick={handlePlayClick}
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Scenario">
            <IconButton 
              size="small" 
              color="primary"
              onClick={() => onProjectSelect(project.projectId)}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {onProjectDelete && (
            <Tooltip title="Delete Scenario">
              <IconButton 
                size="small" 
                color="error"
                onClick={() => onProjectDelete(project.projectId)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      </Card>

      <Dialog
        open={isPlayDialogOpen}
        onClose={() => setIsPlayDialogOpen(false)}
        fullScreen
      >
        {povScenario && (
          <PovPlayer
            scenario={povScenario}
            onClose={() => setIsPlayDialogOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
};

export default ProjectCard;
