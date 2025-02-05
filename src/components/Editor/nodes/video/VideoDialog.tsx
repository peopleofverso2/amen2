import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tabs,
  Tab,
  Box,
} from '@mui/material';
import { MediaFile } from '../../../../types/media';
import MediaLibrary from '../../../MediaLibrary/MediaLibrary';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface VideoDialogProps {
  open: boolean;
  url: string;
  onClose: () => void;
  onSave: () => void;
  onUrlChange: (url: string) => void;
}

export const VideoDialog: React.FC<VideoDialogProps> = ({
  open,
  url,
  onClose,
  onSave,
  onUrlChange,
}) => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMediaSelect = (selectedMedia: MediaFile[]) => {
    console.log('Media selected:', selectedMedia);
    if (selectedMedia.length > 0) {
      const mediaFile = selectedMedia[0];
      console.log('Setting URL to:', mediaFile.url);
      onUrlChange(mediaFile.url);
      onSave();
    }
  };

  const handleUrlSave = () => {
    console.log('Saving URL:', url);
    onSave();
  };

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch (err) {
      return false;
    }
  };

  const isYoutubeUrl = (urlString: string) => {
    return urlString.includes('youtube.com') || urlString.includes('youtu.be');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Sélectionner une vidéo</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="YouTube / URL" />
          <Tab label="Bibliothèque" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TextField
            autoFocus
            margin="dense"
            label="URL de la vidéo"
            type="url"
            fullWidth
            variant="outlined"
            value={url}
            onChange={(e) => {
              console.log('URL changed to:', e.target.value);
              onUrlChange(e.target.value);
            }}
            helperText={
              url && !isValidUrl(url)
                ? 'URL invalide'
                : isYoutubeUrl(url)
                ? 'URL YouTube valide'
                : 'Collez l\'URL YouTube ou une autre URL vidéo valide'
            }
            error={url !== '' && !isValidUrl(url)}
          />
          <DialogActions>
            <Button onClick={onClose}>Annuler</Button>
            <Button
              onClick={handleUrlSave}
              variant="contained"
              disabled={!isValidUrl(url)}
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
};

export default VideoDialog;
