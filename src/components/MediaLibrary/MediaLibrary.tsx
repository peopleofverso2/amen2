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
    const loadMedia = async () => {
      try {
        const mediaLibrary = await MediaLibraryService.getInstance();
        const mediaFiles = await mediaLibrary.listMedia(filter);
        setMedia(mediaFiles.filter(file => 
          acceptedTypes.length === 0 || 
          acceptedTypes.some(type => {
            const [category] = type.split('/');
            return file.metadata.type === category || type === '*/*';
          })
        ));
      } catch (error) {
        console.error('Error loading media:', error);
        setSnackbar({
          open: true,
          message: 'Error loading media',
          severity: 'error'
        });
      }
    };

    loadMedia();
  }, [filter, acceptedTypes]);

  const handleUpload = async (files: File[]) => {
    try {
      const mediaLibrary = await MediaLibraryService.getInstance();
      for (const file of files) {
        await mediaLibrary.uploadMedia(file);
      }
      
      // Refresh media list
      const mediaFiles = await mediaLibrary.listMedia(filter);
      setMedia(mediaFiles);
      
      setSnackbar({
        open: true,
        message: 'Upload successful',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      setSnackbar({
        open: true,
        message: 'Error uploading files',
        severity: 'error'
      });
    }
    setUploadOpen(false);
  };

  const handleDelete = async (mediaFile: MediaFile) => {
    try {
      const mediaLibrary = await MediaLibraryService.getInstance();
      await mediaLibrary.deleteMedia(mediaFile.metadata.id);
      setSelectedMedia(prev => {
        const next = new Set(prev);
        next.delete(mediaFile.metadata.id);
        return next;
      });
      const mediaFiles = await mediaLibrary.listMedia(filter);
      setMedia(mediaFiles);
      setSnackbar({
        open: true,
        message: 'Media deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting media',
        severity: 'error'
      });
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
                    await handleDelete(mediaFile);
                  } catch (error) {
                    console.error('Error deleting media:', error);
                    setSnackbar({
                      open: true,
                      message: 'Error deleting media',
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
        onUpload={handleUpload}
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
