import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Autocomplete,
  TextField,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, tags: string[]) => Promise<void>;
  availableTags: string[];
}

export default function UploadDialog({
  open,
  onClose,
  onUpload,
  availableTags,
}: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Créer une URL de prévisualisation
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (selectedFile) {
      setUploading(true);
      try {
        await onUpload(selectedFile, selectedTags);
        handleClose();
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSelectedTags([]);
    setPreviewUrl('');
    setUploading(false);
    onClose();
  };

  const isVideo = selectedFile?.type.startsWith('video/');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Uploader un média</DialogTitle>
      <DialogContent>
        {/* Zone de drop */}
        <Box
          sx={{
            border: '2px dashed #ccc',
            borderRadius: 2,
            p: 3,
            mb: 2,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="video/*,image/*"
          />
          
          {selectedFile ? (
            <Box sx={{ width: '100%', maxHeight: 300, overflow: 'hidden' }}>
              {isVideo ? (
                <video
                  src={previewUrl}
                  style={{ width: '100%', height: 'auto' }}
                  controls
                />
              ) : (
                <img
                  src={previewUrl}
                  style={{ width: '100%', height: 'auto' }}
                  alt="Prévisualisation"
                />
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedFile.name}
              </Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
              <Typography>
                Glissez un fichier ici ou cliquez pour sélectionner
              </Typography>
            </>
          )}
        </Box>

        {/* Sélection des tags */}
        <Autocomplete
          multiple
          freeSolo
          options={availableTags}
          value={selectedTags}
          onChange={(_, newValue) => setSelectedTags(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              label="Tags"
              placeholder="Ajouter des tags"
              fullWidth
            />
          )}
        />

        {uploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>Annuler</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!selectedFile || uploading}
        >
          Uploader
        </Button>
      </DialogActions>
    </Dialog>
  );
}
