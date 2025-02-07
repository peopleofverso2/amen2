import React, { useState } from 'react';
import { Container, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import ScenarioEditor from './components/Editor/ScenarioEditor';
import ProjectLibrary from './components/ProjectLibrary/ProjectLibrary';
import { ProjectService } from './services/projectService';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectService] = useState(() => ProjectService.getInstance());

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleBackToLibrary = () => {
    setSelectedProjectId(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} disableGutters sx={{ height: '100vh', overflow: 'hidden' }}>
        {selectedProjectId ? (
          <ScenarioEditor
            projectId={selectedProjectId}
            onBackToLibrary={handleBackToLibrary}
          />
        ) : (
          <ProjectLibrary onProjectSelect={handleProjectSelect} />
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
