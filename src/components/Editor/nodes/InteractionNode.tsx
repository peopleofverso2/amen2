import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Collapse,
  Tooltip
} from '@mui/material';
import { ChromePicker } from 'react-color';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { InteractionNodeData, InteractionButton } from '../../../types/nodes';
import Draggable from 'react-draggable';

interface InteractionNodeProps {
  data: InteractionNodeData;
  isConnectable: boolean;
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
      <DialogTitle>Configurer le bouton</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            label="Texte du bouton"
            value={editedButton.label}
            onChange={(e) => setEditedButton({ ...editedButton, label: e.target.value })}
            fullWidth
          />

          <Box>
            <Typography gutterBottom>Position horizontale (%)</Typography>
            <Slider
              value={editedButton.position?.x || 50}
              onChange={(_, value) => setEditedButton({
                ...editedButton,
                position: {
                  ...(editedButton.position || { y: 50 }),
                  x: value as number
                }
              })}
              min={0}
              max={100}
            />
          </Box>

          <Box>
            <Typography gutterBottom>Position verticale (%)</Typography>
            <Slider
              value={editedButton.position?.y || 50}
              onChange={(_, value) => setEditedButton({
                ...editedButton,
                position: {
                  ...(editedButton.position || { x: 50 }),
                  y: value as number
                }
              })}
              min={0}
              max={100}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>Alignement horizontal</InputLabel>
            <Select
              value={editedButton.alignment?.horizontal || 'center'}
              onChange={(e) => setEditedButton({
                ...editedButton,
                alignment: {
                  ...(editedButton.alignment || { vertical: 'center' }),
                  horizontal: e.target.value as 'left' | 'center' | 'right'
                }
              })}
            >
              <MenuItem value="left">Gauche</MenuItem>
              <MenuItem value="center">Centre</MenuItem>
              <MenuItem value="right">Droite</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Alignement vertical</InputLabel>
            <Select
              value={editedButton.alignment?.vertical || 'center'}
              onChange={(e) => setEditedButton({
                ...editedButton,
                alignment: {
                  ...(editedButton.alignment || { horizontal: 'center' }),
                  vertical: e.target.value as 'top' | 'center' | 'bottom'
                }
              })}
            >
              <MenuItem value="top">Haut</MenuItem>
              <MenuItem value="center">Centre</MenuItem>
              <MenuItem value="bottom">Bas</MenuItem>
            </Select>
          </FormControl>

          <Box>
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
              max={32}
            />
          </Box>

          <Box>
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
          </Box>

          <Box>
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
          </Box>

          <Box>
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
          </Box>
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

const InteractionNode = memo(({ data, isConnectable }: InteractionNodeProps) => {
  const [editingButton, setEditingButton] = useState<InteractionButton | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTimingSettings, setShowTimingSettings] = useState(false);

  const handleAddButton = () => {
    const newButton: InteractionButton = {
      id: `button-${Date.now()}`,
      label: 'Nouveau bouton',
      position: { x: 50, y: 50 },
      alignment: { horizontal: 'center', vertical: 'center' },
      style: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderRadius: '4px',
        fontSize: '14px'
      }
    };
    data.buttons = [...(data.buttons || []), newButton];
  };

  const handleSaveButton = (editedButton: InteractionButton) => {
    data.buttons = data.buttons.map(button =>
      button.id === editedButton.id ? editedButton : button
    );
    setEditingButton(null);
  };

  const handleDeleteButton = (buttonId: string) => {
    data.buttons = data.buttons.filter(button => button.id !== buttonId);
  };

  return (
    <>
      <Card sx={{ width: 350, backgroundColor: '#2a2a2a' }}>
        <CardContent>
          <Stack spacing={2}>
            {/* En-tête avec titre et contrôles */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" color="white">
                {data.label}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Paramètres de timing">
                  <IconButton 
                    size="small" 
                    onClick={() => setShowTimingSettings(!showTimingSettings)}
                    sx={{ color: 'white' }}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Prévisualisation">
                  <IconButton 
                    size="small" 
                    onClick={() => setShowPreview(!showPreview)}
                    sx={{ color: 'white' }}
                  >
                    <PreviewIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Paramètres de timing */}
            <Collapse in={showTimingSettings}>
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="white">
                    Paramètres d'apparition
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={data.timing.showAtEnd}
                        onChange={(e) => {
                          data.timing.showAtEnd = e.target.checked;
                          if (e.target.checked) {
                            data.timing.showAtTime = undefined;
                          }
                        }}
                        color="primary"
                      />
                    }
                    label="Afficher à la fin de la vidéo"
                    sx={{ color: 'white' }}
                  />

                  {!data.timing.showAtEnd && (
                    <TextField
                      label="Afficher à (secondes)"
                      type="number"
                      value={data.timing.showAtTime || 0}
                      onChange={(e) => {
                        data.timing.showAtTime = Number(e.target.value);
                      }}
                      variant="outlined"
                      size="small"
                      sx={{ input: { color: 'white' }, label: { color: 'white' } }}
                    />
                  )}

                  <TextField
                    label="Durée d'affichage (secondes)"
                    type="number"
                    value={data.timing.duration || ''}
                    onChange={(e) => {
                      data.timing.duration = Number(e.target.value);
                    }}
                    variant="outlined"
                    size="small"
                    sx={{ input: { color: 'white' }, label: { color: 'white' } }}
                  />
                </Stack>
              </Card>
            </Collapse>

            {/* Zone de prévisualisation */}
            <Box 
              sx={{ 
                position: 'relative',
                width: '100%',
                height: 200,
                border: '1px dashed #666',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: showPreview ? 'rgba(0,0,0,0.5)' : 'transparent'
              }}
            >
              {data.buttons?.map((button) => (
                <Box
                  key={button.id}
                  sx={{
                    position: 'absolute',
                    left: `${button.position?.x}%`,
                    top: `${button.position?.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
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
                  {!showPreview && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setEditingButton(button)}
                        sx={{ color: 'white' }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteButton(button.id)}
                        sx={{ color: 'white' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  )}
                  <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`button-${button.id}`}
                    style={{ bottom: -20 }}
                    isConnectable={isConnectable}
                  />
                </Box>
              ))}
            </Box>

            {/* Bouton d'ajout */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <IconButton 
                onClick={handleAddButton}
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}
              >
                <AddIcon />
              </IconButton>
            </Box>

            {/* Informations de timing */}
            <Typography variant="body2" color="gray" align="center">
              {data.timing.showAtEnd 
                ? "Apparaît à la fin de la vidéo" 
                : `Apparaît à ${data.timing.showAtTime}s`}
              {data.timing.duration && ` pendant ${data.timing.duration}s`}
            </Typography>
          </Stack>
        </CardContent>

        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
        />
      </Card>

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

export default InteractionNode;
