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
}

export default function MediaLibrary({ 
  onSelect,
  multiSelect = true 
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
    loadTags();
  }, [filter]);

  const loadMedia = async () => {
    try {
      const mediaFiles = await mediaLibrary.listMedia({
        ...filter,
        search,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
      setMedia(mediaFiles);
    } catch (error) {
      console.error('Erreur lors du chargement des médias:', error);
      showError('Erreur lors du chargement des médias');
    }
  };

  const loadTags = async () => {
    try {
      const allMedia = await mediaLibrary.listMedia();
      const tags = new Set<string>();
      allMedia.forEach(m => m.metadata.tags.forEach(tag => tags.add(tag)));
      setAvailableTags(Array.from(tags));
    } catch (error) {
      console.error('Erreur lors du chargement des tags:', error);
      showError('Erreur lors du chargement des tags');
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
    <Box sx={{ p: 3 }}>
      {/* Barre d'outils */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              options={availableTags}
              value={selectedTags}
              onChange={(_, newValue) => setSelectedTags(newValue)}
              renderInput={(params) => (
                <TextField {...params} placeholder="Filtrer par tags" />
              )}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => setUploadOpen(true)}
            >
              Upload
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Grille de médias */}
      <Grid container spacing={2}>
        {media.map((mediaFile) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={mediaFile.metadata.id}>
            <MediaCard
              mediaFile={mediaFile}
              onSelect={handleSelect}
              onDelete={handleDelete}
              selected={selectedMedia.has(mediaFile.metadata.id)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Bouton de validation de la sélection */}
      {onSelect && selectedMedia.size > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckIcon />}
            onClick={handleConfirmSelection}
          >
            Valider la sélection ({selectedMedia.size})
          </Button>
        </Box>
      )}

      {/* Dialog d'upload */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        availableTags={availableTags}
      />

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
