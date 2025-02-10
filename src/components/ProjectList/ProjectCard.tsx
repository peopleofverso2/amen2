import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { ProjectMetadata } from '../../types/project';
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
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card sx={{ minWidth: 275, maxWidth: 345, m: 1 }}>
      <CardContent>
        <Typography variant="h5" component="div" gutterBottom>
          {project.scenarioTitle}
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          Created: {formatDate(project.createdAt)}
        </Typography>
        <Typography variant="body2">
          Last modified: {formatDate(project.updatedAt)}
        </Typography>
      </CardContent>
      <CardActions>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Box>
            <Tooltip title="Edit Scenario">
              <IconButton
                size="small"
                onClick={() => onProjectSelect(project.projectId)}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box>
            {onProjectDelete && (
              <Tooltip title="Delete Scenario">
                <IconButton
                  size="small"
                  onClick={() => onProjectDelete(project.projectId)}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </CardActions>
    </Card>
  );
};

export default ProjectCard;
