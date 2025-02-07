import React from 'react';
import { Box, Typography } from '@mui/material';
import { Movie as MovieIcon } from '@mui/icons-material';

interface EmptyVideoStateProps {
  error?: string | null;
}

const EmptyVideoState: React.FC<EmptyVideoStateProps> = ({ error }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 150,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: 1,
      }}
    >
      <MovieIcon sx={{ fontSize: 48, color: error ? 'error.main' : 'action.active', mb: 1 }} />
      <Typography
        variant="body2"
        align="center"
        color={error ? 'error' : 'textSecondary'}
      >
        {error || 'Cliquez pour ajouter une vidéo'}
      </Typography>
    </Box>
  );
};

export default EmptyVideoState;
