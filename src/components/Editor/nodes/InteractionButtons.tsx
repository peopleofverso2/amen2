import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Stack,
  Slider,
  Typography,
} from '@mui/material';
import { ChromePicker } from 'react-color';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { InteractionButton } from '../../../types/nodes';
import Draggable from 'react-draggable';
import './InteractionButtons.css';

interface InteractionButtonsProps {
  buttons: InteractionButton[];
  onChange: (buttons: InteractionButton[]) => void;
  containerWidth: number;
  containerHeight: number;
  isEditing?: boolean;
}

interface ButtonEditorProps {
  button: InteractionButton;
  onSave: (button: InteractionButton) => void;
  onClose: () => void;
}

const ButtonEditor = ({ button, onSave, onClose }: ButtonEditorProps) => {
  const [editedButton, setEditedButton] = useState<InteractionButton>({ ...button });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Éditer le bouton</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Texte du bouton"
            value={editedButton.label}
            onChange={(e) => setEditedButton({ ...editedButton, label: e.target.value })}
            fullWidth
          />
          
          <Typography gutterBottom>Couleur de fond</Typography>
          <ChromePicker
            color={editedButton.style?.backgroundColor || '#ffffff'}
            onChange={(color) => setEditedButton({
              ...editedButton,
              style: {
                ...editedButton.style,
                backgroundColor: color.hex
              }
            })}
          />

          <Typography gutterBottom>Couleur du texte</Typography>
          <ChromePicker
            color={editedButton.style?.textColor || '#000000'}
            onChange={(color) => setEditedButton({
              ...editedButton,
              style: {
                ...editedButton.style,
                textColor: color.hex
              }
            })}
          />

          <Typography gutterBottom>Rayon des bords (px)</Typography>
          <Slider
            value={parseInt(editedButton.style?.borderRadius || '4')}
            onChange={(_, value) => setEditedButton({
              ...editedButton,
              style: {
                ...editedButton.style,
                borderRadius: `${value}px`
              }
            })}
            min={0}
            max={20}
          />

          <Typography gutterBottom>Taille du texte (px)</Typography>
          <Slider
            value={parseInt(editedButton.style?.fontSize || '14')}
            onChange={(_, value) => setEditedButton({
              ...editedButton,
              style: {
                ...editedButton.style,
                fontSize: `${value}px`
              }
            })}
            min={12}
            max={24}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={() => onSave(editedButton)} variant="contained">
          Sauvegarder
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const InteractionButtons = memo(({ buttons, onChange, containerWidth, containerHeight, isEditing = false }: InteractionButtonsProps) => {
  const [editingButton, setEditingButton] = useState<InteractionButton | null>(null);

  const handleAddButton = () => {
    const newButton: InteractionButton = {
      id: `button-${Date.now()}`,
      label: 'Nouveau bouton',
      style: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderRadius: '4px',
        fontSize: '14px'
      },
      position: {
        x: containerWidth / 2,
        y: containerHeight - 50
      }
    };
    onChange([...buttons, newButton]);
  };

  const handleDeleteButton = (id: string) => {
    onChange(buttons.filter(button => button.id !== id));
  };

  const handleDrag = (id: string, position: { x: number; y: number }) => {
    onChange(buttons.map(button => 
      button.id === id
        ? { ...button, position }
        : button
    ));
  };

  const handleSaveButton = (editedButton: InteractionButton) => {
    onChange(buttons.map(button =>
      button.id === editedButton.id
        ? editedButton
        : button
    ));
    setEditingButton(null);
  };

  return (
    <>
      {buttons.map((button) => (
        <Draggable
          key={button.id}
          position={button.position || { x: 0, y: 0 }}
          onDrag={(e, data) => handleDrag(button.id, { x: data.x, y: data.y })}
          disabled={!isEditing}
          bounds="parent"
        >
          <Box sx={{ position: 'absolute', display: 'inline-flex', alignItems: 'center' }}>
            <Button
              variant="contained"
              style={{
                backgroundColor: button.style?.backgroundColor,
                color: button.style?.textColor,
                borderRadius: button.style?.borderRadius,
                fontSize: button.style?.fontSize,
              }}
            >
              {button.label}
            </Button>

            {isEditing && (
              <Stack direction="row" sx={{ ml: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setEditingButton(button)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteButton(button.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            )}

            <Handle
              type="source"
              position={Position.Bottom}
              id={`button-${button.id}`}
              style={{ bottom: -10 }}
            />
          </Box>
        </Draggable>
      ))}

      {isEditing && (
        <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
          <IconButton
            color="primary"
            onClick={handleAddButton}
            sx={{ backgroundColor: 'background.paper' }}
          >
            <AddIcon />
          </IconButton>
        </Box>
      )}

      {editingButton && (
        <ButtonEditor
          button={editingButton}
          onSave={handleSaveButton}
          onClose={() => setEditingButton(null)}
        />
      )}
    </>
  );
});

export default InteractionButtons;
