import React from 'react';
import { AppBar, Toolbar as MuiToolbar, IconButton } from '@mui/material';
import { Slideshow as SlideshowIcon, Stop as StopIcon } from '@mui/icons-material';

interface ToolbarProps {
  onPlayClick: () => void;
  onStopClick: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onPlayClick, onStopClick }) => {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <MuiToolbar variant="dense" sx={{ justifyContent: 'flex-end' }}>
        <IconButton onClick={onPlayClick}>
          <SlideshowIcon />
        </IconButton>
        <IconButton onClick={onStopClick}>
          <StopIcon />
        </IconButton>
      </MuiToolbar>
    </AppBar>
  );
};

export default Toolbar;
