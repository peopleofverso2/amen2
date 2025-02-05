import React from 'react';
import { Box, Button } from '@mui/material';

interface ButtonOverlayProps {
  buttons: Array<{
    id: string;
    label: string;
    targetNodeId?: string;
    onClick: () => void;
  }>;
  visible: boolean;
}

const ButtonOverlay: React.FC<ButtonOverlayProps> = React.memo(({ buttons, visible }) => {
  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 2,
        p: 2,
        background: 'rgba(0, 0, 0, 0.7)',
        transition: 'opacity 0.3s ease-in-out',
        opacity: visible ? 1 : 0,
      }}
    >
      {buttons.map((button) => (
        <Button
          key={button.id}
          variant="contained"
          color="primary"
          onClick={button.onClick}
          sx={{
            minWidth: 120,
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          {button.label}
        </Button>
      ))}
    </Box>
  );
});

export default ButtonOverlay;
