import { useState, useRef, useEffect, useCallback } from 'react';
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
  onUpload: (files: File[], tags: string[]) => Promise<void>;
  availableTags: string[];
}

export default function UploadDialog({
  open,
  onClose,
  onUpload,
  availableTags,
}: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPreviews = useCallback(() => {
    setPreviewUrls((previousUrls) => {
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
  }, []);

  useEffect(() => () => clearPreviews(), [clearPreviews]);

  const setFilesFromSelection = useCallback(
    (fileList: FileList | null | undefined) => {
      const files = fileList ? Array.from(fileList) : [];
      if (files.length === 0) {
        return;
      }

      clearPreviews();
      setSelectedFiles(files);
      setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    },
    [clearPreviews]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilesFromSelection(event.target.files);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setFilesFromSelection(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (selectedFiles.length > 0) {
      setUploading(true);
      try {
        await onUpload(selectedFiles, selectedTags);
        handleClose();
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setSelectedTags([]);
    clearPreviews();
    setUploading(false);
    onClose();
  };

  const primarySelectedFile = selectedFiles[0] || null;
  const isSingleSelection = selectedFiles.length === 1;
  const isVideo = primarySelectedFile?.type.startsWith('video/');
  const primaryPreviewUrl = previewUrls[0] || '';

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
            multiple
          />
          
          {selectedFiles.length > 0 ? (
            <Box sx={{ width: '100%', maxHeight: 300, overflow: 'hidden' }}>
              {isSingleSelection ? (
                <>
                  {isVideo ? (
                    <video
                      src={primaryPreviewUrl}
                      style={{ width: '100%', height: 'auto' }}
                      controls
                    />
                  ) : (
                    <img
                      src={primaryPreviewUrl}
                      style={{ width: '100%', height: 'auto' }}
                      alt="Prévisualisation"
                    />
                  )}
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {primarySelectedFile?.name}
                  </Typography>
                </>
              ) : (
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    {selectedFiles.length} fichiers sélectionnés
                  </Typography>
                  <Box
                    sx={{
                      maxHeight: 180,
                      overflowY: 'auto',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    {selectedFiles.map((file) => (
                      <Typography
                        key={`${file.name}-${file.lastModified}-${file.size}`}
                        variant="body2"
                        sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        • {file.name}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
              <Typography>
                Glissez des fichiers ici ou cliquez pour sélectionner
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
          disabled={selectedFiles.length === 0 || uploading}
        >
          Uploader {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
