import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Chip,
  Typography,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { ProjectMetadata } from '../../types/project';

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
        {project.socialSummary && project.socialSummary.contributionCount > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 2 }}>
            <Chip
              size="small"
              label={`${project.socialSummary.contributionCount} propositions`}
              color="primary"
              variant="outlined"
            />
            {project.socialSummary.canonCount > 0 && (
              <Chip
                size="small"
                label={`${project.socialSummary.canonCount} canon`}
                color="success"
                variant="outlined"
              />
            )}
            {project.socialSummary.popularCount > 0 && (
              <Chip
                size="small"
                label={`${project.socialSummary.popularCount} populaires`}
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
        )}
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
