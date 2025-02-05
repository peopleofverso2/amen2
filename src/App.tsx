import React, { useState } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import ScenarioEditor from './components/Editor/ScenarioEditor';
import ProjectLibrary from './components/ProjectLibrary/ProjectLibrary';
import { ProjectService } from './services/projectService';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const projectService = ProjectService.getInstance();

  const handleProjectSelect = async (projectId: string) => {
    try {
      const project = await projectService.loadProject(projectId);
      setSelectedProjectId(projectId);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const handleBackToLibrary = () => {
    setSelectedProjectId(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {selectedProjectId ? (
          <ScenarioEditor 
            projectId={selectedProjectId} 
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
