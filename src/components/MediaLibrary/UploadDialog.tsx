import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  acceptedTypes?: string[];
}

export default function UploadDialog({
  open,
  onClose,
  onUpload,
  acceptedTypes = [],
}: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (acceptedTypes.length === 0) return true;

    const mediaType = file.type.split('/')[0];
    return acceptedTypes.some(type => {
      const [baseType] = type.split('/');
      return type === '*' || type === file.type || (type.endsWith('/*') && baseType === mediaType);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    setError(null);
    
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach(file => {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Types de fichiers non acceptés : ${invalidFiles.join(', ')}\nTypes acceptés : ${acceptedTypes.join(', ')}`);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      await onUpload(selectedFiles);
      handleClose();
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setError(null);
    setUploading(false);
    onClose();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Uploader des médias</DialogTitle>
      <DialogContent>
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
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            multiple
            accept={acceptedTypes.join(',')}
          />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Glissez-déposez vos fichiers ici
          </Typography>
          <Typography color="textSecondary">
            ou cliquez pour sélectionner
          </Typography>
          {acceptedTypes.length > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Types acceptés : {acceptedTypes.join(', ')}
            </Typography>
          )}
        </Box>

        {selectedFiles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Fichiers sélectionnés :
            </Typography>
            {selectedFiles.map((file, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  mb: 1,
                }}
              >
                <Typography noWrap sx={{ flex: 1 }}>
                  {file.name}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  Supprimer
                </Button>
              </Box>
            ))}
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        {uploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Annuler
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={selectedFiles.length === 0 || uploading}
        >
          {uploading ? 'Upload en cours...' : 'Uploader'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
