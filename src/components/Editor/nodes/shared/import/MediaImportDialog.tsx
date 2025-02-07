import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { LocalStorageAdapter } from '../../../../../services/storage/LocalStorageAdapter';

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
  onSave: (mediaId: string, label?: string) => void;
  title?: string;
  urlLabel?: string;
  urlHelperText?: string;
  defaultLabel?: string;
  acceptedTypes?: string[];
}

const MediaImportDialog: React.FC<MediaImportDialogProps> = React.memo(({
  open,
  onClose,
  onSave,
  title = 'Sélectionner un média',
  urlLabel = 'URL du média',
  urlHelperText = 'Collez l\'URL du média',
  defaultLabel = 'Media',
  acceptedTypes = []
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const storageAdapter = useMemo(() => new LocalStorageAdapter(), []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMediaUrl('');
      setTabValue(0);
      setError(null);
    }
  }, [open]);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  }, []);

  const handleMediaSelect = useCallback((selectedMedia: MediaFile[]) => {
    if (selectedMedia.length > 0) {
      const mediaFile = selectedMedia[0];
      
      // Vérifier si le type de fichier est accepté
      if (acceptedTypes.length > 0) {
        const mediaType = mediaFile.metadata.mimeType.split('/')[0];
        const isAccepted = acceptedTypes.some(type => {
          const [baseType] = type.split('/');
          return type === '*' || type === mediaFile.metadata.mimeType || (type.endsWith('/*') && baseType === mediaType);
        });
        
        if (!isAccepted) {
          setError(`Ce type de fichier n'est pas accepté. Types acceptés : ${acceptedTypes.join(', ')}`);
          return;
        }
      }
      
      onSave(mediaFile.id, mediaFile.metadata.name);
      onClose();
    }
  }, [onSave, onClose, acceptedTypes]);

  const handleUrlSave = useCallback(async () => {
    if (!mediaUrl.trim()) {
      setError('Veuillez entrer une URL valide');
      return;
    }
    
    setError(null);
    
    try {
      // Créer un blob à partir de l'URL
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Erreur lors du chargement de l'URL: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const blob = await response.blob();
      
      // Vérifier si le type de fichier est accepté
      if (acceptedTypes.length > 0) {
        const mediaType = contentType.split('/')[0];
        const isAccepted = acceptedTypes.some(type => {
          const [baseType] = type.split('/');
          return type === '*' || type === contentType || (type.endsWith('/*') && baseType === mediaType);
        });
        
        if (!isAccepted) {
          setError(`Ce type de fichier n'est pas accepté. Types acceptés : ${acceptedTypes.join(', ')}`);
          return;
        }
      }
      
      // Extraire le nom du fichier de l'URL ou utiliser un nom par défaut
      const urlParts = mediaUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'media';
      const file = new File([blob], fileName, { type: contentType });
      
      // Sauvegarder le média dans LocalStorageAdapter
      const mediaFile = await storageAdapter.saveMedia(file, {
        name: fileName,
      });
      
      onSave(mediaFile.id, mediaFile.metadata.name || defaultLabel);
      onClose();
    } catch (error) {
      console.error('Error saving media from URL:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors du chargement du média');
    }
  }, [mediaUrl, onSave, onClose, defaultLabel, storageAdapter, acceptedTypes]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaUrl(e.target.value);
    setError(null);
  }, []);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="BIBLIOTHÈQUE" />
          <Tab label="URL" />
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          <MediaLibrary
            onSelect={handleMediaSelect}
            acceptedTypes={acceptedTypes}
          />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label={urlLabel}
              value={mediaUrl}
              onChange={handleUrlChange}
              helperText={error || urlHelperText}
              error={!!error}
            />
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        {tabValue === 1 && (
          <Button onClick={handleUrlSave} disabled={!mediaUrl.trim() || !!error}>
            Valider
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
});

export default MediaImportDialog;
