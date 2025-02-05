import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
} from '@mui/material';
import { MediaFile } from '../../../../../types/media';
import MediaLibrary from '../../../../MediaLibrary/MediaLibrary';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = React.memo(({ children, value, index, ...other }) => {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
});

interface MediaImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (url: string, label?: string) => void;
  title?: string;
  urlLabel?: string;
  urlHelperText?: string;
  defaultLabel?: string;
}

const MediaImportDialog: React.FC<MediaImportDialogProps> = React.memo(({
  open,
  onClose,
  onSave,
  title = 'Sélectionner un média',
  urlLabel = 'URL du média',
  urlHelperText = 'Collez l\'URL du média',
  defaultLabel = 'Media'
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMediaUrl('');
      setTabValue(0);
    }
  }, [open]);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

  const handleMediaSelect = useCallback((selectedMedia: MediaFile[]) => {
    if (selectedMedia.length > 0) {
      const mediaFile = selectedMedia[0];
      onSave(mediaFile.url, mediaFile.metadata.name);
      onClose();
    }
  }, [onSave, onClose]);

  const handleUrlSave = useCallback(() => {
    if (!mediaUrl.trim()) return;
    
    // Si pas de label, utiliser la dernière partie de l'URL
    const urlParts = mediaUrl.split('/');
    const label = urlParts[urlParts.length - 1] || defaultLabel;
    onSave(mediaUrl.trim(), label);
    onClose();
  }, [mediaUrl, onSave, onClose, defaultLabel]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaUrl(e.target.value);
  }, []);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: tabValue === 1 ? '80vh' : 'auto' }
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="URL" />
          <Tab label="Bibliothèque" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TextField
            autoFocus
            margin="dense"
            label={urlLabel}
            type="url"
            fullWidth
            variant="outlined"
            value={mediaUrl}
            onChange={handleUrlChange}
            helperText={urlHelperText}
          />
          <DialogActions>
            <Button onClick={onClose}>Annuler</Button>
            <Button 
              onClick={handleUrlSave} 
              variant="contained"
              disabled={!mediaUrl.trim()}
            >
              Sélectionner
            </Button>
          </DialogActions>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ height: '60vh' }}>
            <MediaLibrary onSelect={handleMediaSelect} multiSelect={false} />
          </Box>
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
});

export default MediaImportDialog;
