import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  TextField,
  Button,
  Autocomplete,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { MediaFile, MediaFilter } from '../../types/media';
import { MediaLibraryService } from '../../services/MediaLibraryService';
import MediaCard from './MediaCard';
import UploadDialog from './UploadDialog';

const mediaLibrary = new MediaLibraryService();

interface MediaLibraryProps {
  onSelect?: (mediaFiles: MediaFile[]) => void;
  multiSelect?: boolean;
  acceptedTypes?: string[];
}

export default function MediaLibrary({ 
  onSelect,
  multiSelect = true,
  acceptedTypes = []
}: MediaLibraryProps) {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [filter, setFilter] = useState<MediaFilter>({});
  const [search, setSearch] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    loadMedia();
  }, [filter, search, selectedTags]);

  const loadMedia = async () => {
    try {
      const mediaFiles = await mediaLibrary.listMedia({
        ...filter,
        search,
        tags: selectedTags,
      });

      // Filtrer les médias par type si nécessaire
      const filteredMedia = acceptedTypes.length > 0
        ? mediaFiles.filter(file => {
            const mediaType = file.metadata.mimeType.split('/')[0];
            return acceptedTypes.some(type => {
              const [baseType] = type.split('/');
              return type === '*' || type === file.metadata.mimeType || (type.endsWith('/*') && baseType === mediaType);
            });
          })
        : mediaFiles;

      setMedia(filteredMedia);
      
      // Mettre à jour les tags disponibles
      const tags = new Set<string>();
      filteredMedia.forEach(file => {
        file.metadata.tags?.forEach(tag => tags.add(tag));
      });
      setAvailableTags(Array.from(tags));
    } catch (error) {
      console.error('Error loading media:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du chargement des médias',
        severity: 'error'
      });
    }
  };

  const handleUpload = async (file: File, tags: string[]) => {
    try {
      await mediaLibrary.uploadMedia(file, { tags });
      loadMedia();
      loadTags();
      setUploadOpen(false);
      showSuccess('Média uploadé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      showError('Erreur lors de l\'upload du média');
    }
  };

  const handleDelete = async (mediaFile: MediaFile) => {
    try {
      await mediaLibrary.deleteMedia(mediaFile.metadata.id);
      setSelectedMedia(prev => {
        const next = new Set(prev);
        next.delete(mediaFile.metadata.id);
        return next;
      });
      loadMedia();
      loadTags();
      showSuccess('Média supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression du média');
    }
  };

  const handleSelect = (mediaFile: MediaFile) => {
    setSelectedMedia(prev => {
      const next = new Set(prev);
      if (next.has(mediaFile.metadata.id)) {
        next.delete(mediaFile.metadata.id);
      } else {
        if (!multiSelect) {
          next.clear();
        }
        next.add(mediaFile.metadata.id);
      }
      return next;
    });
  };

  const handleConfirmSelection = () => {
    if (onSelect) {
      const selectedFiles = media.filter(m => selectedMedia.has(m.metadata.id));
      onSelect(selectedFiles);
    }
  };

  const showSuccess = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: 'success'
    });
  };

  const showError = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: 'error'
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ flexGrow: 1 }}
        />
        
        <Autocomplete
          multiple
          size="small"
          options={availableTags}
          value={selectedTags}
          onChange={(_, newValue) => setSelectedTags(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Tags"
              sx={{ minWidth: 200 }}
            />
          )}
          sx={{ flexGrow: 1 }}
        />
        
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => setUploadOpen(true)}
        >
          Upload
        </Button>
        
        {selectedMedia.size > 0 && onSelect && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckIcon />}
            onClick={() => {
              const selectedFiles = media.filter(m => selectedMedia.has(m.metadata.id));
              onSelect(selectedFiles);
            }}
          >
            Valider ({selectedMedia.size})
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Grid container spacing={2}>
          {media.map((mediaFile) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={mediaFile.metadata.id}>
              <MediaCard
                mediaFile={mediaFile}
                selected={selectedMedia.has(mediaFile.metadata.id)}
                onSelect={() => {
                  if (!onSelect) return;
                  
                  const newSelection = new Set(selectedMedia);
                  if (multiSelect) {
                    if (newSelection.has(mediaFile.metadata.id)) {
                      newSelection.delete(mediaFile.metadata.id);
                    } else {
                      newSelection.add(mediaFile.metadata.id);
                    }
                  } else {
                    newSelection.clear();
                    newSelection.add(mediaFile.metadata.id);
                  }
                  setSelectedMedia(newSelection);
                }}
                onDelete={async () => {
                  try {
                    await mediaLibrary.deleteMedia(mediaFile.metadata.id);
                    loadMedia();
                    setSnackbar({
                      open: true,
                      message: 'Média supprimé avec succès',
                      severity: 'success'
                    });
                  } catch (error) {
                    console.error('Error deleting media:', error);
                    setSnackbar({
                      open: true,
                      message: 'Erreur lors de la suppression du média',
                      severity: 'error'
                    });
                  }
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={async (files) => {
          try {
            const uploadPromises = files.map(async (file) => {
              const mediaFile = await mediaLibrary.uploadMedia(file);
              return mediaFile;
            });
            
            await Promise.all(uploadPromises);
            loadMedia();
            setUploadOpen(false);
            setSnackbar({
              open: true,
              message: 'Upload réussi',
              severity: 'success'
            });
          } catch (error) {
            console.error('Error uploading files:', error);
            setSnackbar({
              open: true,
              message: error instanceof Error ? error.message : 'Erreur lors de l\'upload',
              severity: 'error'
            });
          }
        }}
        acceptedTypes={acceptedTypes}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
