import React from 'react';
import MediaImportDialog from '../shared/import/MediaImportDialog';

interface VideoImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (url: string, label?: string) => void;
}

const VideoImportDialog: React.FC<VideoImportDialogProps> = React.memo(({
  open,
  onClose,
  onSave,
}) => {
  return (
    <MediaImportDialog
      open={open}
      onClose={onClose}
      onSave={onSave}
      title="Sélectionner une vidéo"
      urlLabel="URL de la vidéo"
      urlHelperText="Collez l'URL YouTube ou une autre URL vidéo valide"
      defaultLabel="Vidéo YouTube"
    />
  );
});

export default VideoImportDialog;
