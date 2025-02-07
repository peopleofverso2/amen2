import React from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Paper,
} from '@mui/material';
import { ProjectMetadata } from '../../types/project';

interface ProjectListProps {
  projects: ProjectMetadata[];
  onProjectSelect: (projectId: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onProjectSelect }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (projects.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No scenarios yet. Create your first one!
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <List>
        {projects.map((project) => (
          <ListItem
            key={project.projectId}
            divider
            disablePadding
          >
            <ListItemButton onClick={() => onProjectSelect(project.projectId)}>
              <ListItemText
                primary={project.scenarioTitle}
                secondary={
                  <>
                    {project.description && (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                        sx={{ display: 'block' }}
                      >
                        {project.description}
                      </Typography>
                    )}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      Last modified: {formatDate(project.updatedAt)}
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default ProjectList;
