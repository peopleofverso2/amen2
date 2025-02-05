import React from 'react';
import { Box } from '@mui/material';

const EmptyVideoState: React.FC = () => {
  return (
    <Box
      sx={{
        width: '100%',
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.200',
        borderRadius: 1,
      }}
    >
      Cliquez pour ajouter une vidéo
    </Box>
  );
};

export default EmptyVideoState;
