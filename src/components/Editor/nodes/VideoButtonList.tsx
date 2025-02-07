import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  IconButton,
  TextField,
  Box,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VideoButton from './VideoButton';

interface Button {
  id: string;
  label: string;
}

interface VideoButtonListProps {
  buttons: Button[];
  selectedButtonId: string | null;
  isPlaybackMode: boolean;
  onButtonClick: (buttonId: string) => void;
  onButtonsChange: (buttons: Button[]) => void;
}

const VideoButtonList = ({
  buttons,
  selectedButtonId,
  isPlaybackMode,
  onButtonClick,
  onButtonsChange,
}: VideoButtonListProps) => {
  const [isEditingButtons, setIsEditingButtons] = useState(false);
  const [editedButtons, setEditedButtons] = useState<Button[]>(buttons);

  const handleEditButton = (index: number, newLabel: string) => {
    const newButtons = [...editedButtons];
    newButtons[index] = { ...newButtons[index], label: newLabel };
    setEditedButtons(newButtons);
  };

  const handleDeleteButton = (index: number) => {
    const newButtons = editedButtons.filter((_, i) => i !== index);
    setEditedButtons(newButtons);
  };

  const handleAddButton = () => {
    const newButton = {
      id: `button-${Math.random().toString(36).substr(2, 9)}`,
      label: 'New Button',
    };
    setEditedButtons([...editedButtons, newButton]);
  };

  const handleSaveButtons = () => {
    onButtonsChange(editedButtons);
    setIsEditingButtons(false);
  };

  return (
    <div style={{ width: '200px', padding: '10px' }}>
      {!isPlaybackMode && (
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setIsEditingButtons(true)}
          fullWidth
          style={{ marginBottom: '10px' }}
        >
          Edit Buttons
        </Button>
      )}

      {buttons.map((button) => (
        <VideoButton
          key={button.id}
          id={button.id}
          label={button.label}
          isSelected={selectedButtonId === button.id}
          isPlaybackMode={isPlaybackMode}
          onButtonClick={onButtonClick}
        />
      ))}

      <Dialog
        open={isEditingButtons}
        onClose={() => setIsEditingButtons(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Buttons</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2 }}>
            {editedButtons.map((button, index) => (
              <Box
                key={button.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <TextField
                  value={button.label}
                  onChange={(e) => handleEditButton(index, e.target.value)}
                  size="small"
                  fullWidth
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteButton(index)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddButton}
              variant="outlined"
              fullWidth
            >
              Add Button
            </Button>
            <Button
              onClick={handleSaveButtons}
              variant="contained"
              color="primary"
              fullWidth
            >
              Save Changes
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoButtonList;
