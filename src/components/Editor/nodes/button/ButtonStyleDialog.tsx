import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Slider,
  Box,
  Typography,
} from '@mui/material';

interface ButtonNodeData {
  text: string;
  style?: {
    backgroundColor: string;
    textColor: string;
    borderRadius: string;
    fontSize: string;
    borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
    borderColor: string;
    borderWidth: string;
    boxShadow: string;
    padding: string;
    textAlign: 'left' | 'center' | 'right';
    transition: string;
    hoverBackgroundColor: string;
    hoverTextColor: string;
    hoverScale: string;
  };
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: {
    name: string;
    position: 'start' | 'end';
  };
  targetNodeId?: string;
  onDataChange?: (data: Partial<ButtonNodeData>) => void;
  onNavigate?: (targetNodeId: string) => void;
  isPlaybackMode?: boolean;
}

const defaultStyle = {
  backgroundColor: '#2196f3',
  textColor: '#ffffff',
  borderRadius: '4px',
  fontSize: '14px',
  borderStyle: 'none' as const,
  borderColor: '#000000',
  borderWidth: '1px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  padding: '8px 16px',
  textAlign: 'center' as const,
  transition: 'all 0.3s ease',
  hoverBackgroundColor: '#1976d2',
  hoverTextColor: '#ffffff',
  hoverScale: '1.05'
};

interface ButtonStyleDialogProps {
  open: boolean;
  onClose: () => void;
  data: ButtonNodeData;
  onSave: (data: ButtonNodeData) => void;
}

const ButtonStyleDialog: React.FC<ButtonStyleDialogProps> = ({
  open,
  onClose,
  data,
  onSave,
}) => {
  const [editData, setEditData] = React.useState<ButtonNodeData>({
    text: data.text || 'Nouveau bouton',
    style: {
      ...defaultStyle,
      ...(data.style || {})
    },
    variant: data.variant || 'contained',
    size: data.size || 'medium',
    icon: data.icon,
    targetNodeId: data.targetNodeId
  });

  const handleStyleChange = (field: keyof ButtonNodeData['style'], value: string) => {
    setEditData((prev) => ({
      ...prev,
      style: {
        ...(prev.style || defaultStyle),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Personnaliser le bouton</DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Texte du bouton */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Texte du bouton"
              value={editData.text}
              onChange={(e) => setEditData({ ...editData, text: e.target.value })}
            />
          </Grid>

          {/* Style du bouton */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Variante</InputLabel>
              <Select
                value={editData.variant || 'contained'}
                onChange={(e) => setEditData({ ...editData, variant: e.target.value as any })}
                label="Variante"
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Taille</InputLabel>
              <Select
                value={editData.size || 'medium'}
                onChange={(e) => setEditData({ ...editData, size: e.target.value as any })}
                label="Taille"
              >
                <MenuItem value="small">Petit</MenuItem>
                <MenuItem value="medium">Moyen</MenuItem>
                <MenuItem value="large">Grand</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Couleurs */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Couleur de fond</Typography>
              <input
                type="color"
                value={editData.style?.backgroundColor || defaultStyle.backgroundColor}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                style={{ width: '100%', height: '40px' }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Couleur du texte</Typography>
              <input
                type="color"
                value={editData.style?.textColor || defaultStyle.textColor}
                onChange={(e) => handleStyleChange('textColor', e.target.value)}
                style={{ width: '100%', height: '40px' }}
              />
            </Box>
          </Grid>

          {/* Bordure */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Style de bordure</InputLabel>
              <Select
                value={editData.style?.borderStyle || defaultStyle.borderStyle}
                onChange={(e) => handleStyleChange('borderStyle', e.target.value as any)}
                label="Style de bordure"
              >
                <MenuItem value="none">Aucune</MenuItem>
                <MenuItem value="solid">Pleine</MenuItem>
                <MenuItem value="dashed">Pointillés</MenuItem>
                <MenuItem value="dotted">Points</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Rayon de bordure"
              value={editData.style?.borderRadius || defaultStyle.borderRadius}
              onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
              placeholder="ex: 4px"
            />
          </Grid>

          {/* Effets */}
          <Grid item xs={12}>
            <Typography gutterBottom>Effet de survol (scale)</Typography>
            <Slider
              value={parseFloat(editData.style?.hoverScale || defaultStyle.hoverScale)}
              onChange={(_, value) => handleStyleChange('hoverScale', value.toString())}
              min={1}
              max={1.2}
              step={0.01}
              marks
              valueLabelDisplay="auto"
            />
          </Grid>

          {/* Couleurs au survol */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Couleur de fond au survol</Typography>
              <input
                type="color"
                value={editData.style?.hoverBackgroundColor || defaultStyle.hoverBackgroundColor}
                onChange={(e) => handleStyleChange('hoverBackgroundColor', e.target.value)}
                style={{ width: '100%', height: '40px' }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Couleur du texte au survol</Typography>
              <input
                type="color"
                value={editData.style?.hoverTextColor || defaultStyle.hoverTextColor}
                onChange={(e) => handleStyleChange('hoverTextColor', e.target.value)}
                style={{ width: '100%', height: '40px' }}
              />
            </Box>
          </Grid>

          {/* Autres styles */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Padding"
              value={editData.style?.padding || defaultStyle.padding}
              onChange={(e) => handleStyleChange('padding', e.target.value)}
              placeholder="ex: 8px 16px"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Taille de police"
              value={editData.style?.fontSize || defaultStyle.fontSize}
              onChange={(e) => handleStyleChange('fontSize', e.target.value)}
              placeholder="ex: 14px"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ButtonStyleDialog;
