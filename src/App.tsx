import React, { useState } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import ScenarioEditor from './components/Editor/ScenarioEditor';
import ProjectLibrary from './components/ProjectLibrary/ProjectLibrary';
import { ProjectService } from './services/projectService';
import { Project } from './types/project';

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const projectService = ProjectService.getInstance();

  const handleProjectSelect = async (projectId: string) => {
    try {
      const project = await projectService.loadProject(projectId);
      setSelectedProject(project);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const handleBackToLibrary = () => {
    setSelectedProject(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {selectedProject ? (
          <ScenarioEditor 
            projectId={selectedProject.id} 
            onBackToLibrary={handleBackToLibrary} 
          />
        ) : (
          <ProjectLibrary onProjectSelect={handleProjectSelect} />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
