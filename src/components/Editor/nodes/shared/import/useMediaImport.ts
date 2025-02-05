import { useState, useCallback } from 'react';
import { MediaFile } from '../../../../../types/media';

interface UseMediaImportProps {
  onSave: (url: string, label?: string) => void;
  onClose: () => void;
}

export const useMediaImport = ({ onSave, onClose }: UseMediaImportProps) => {
  const [tabValue, setTabValue] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');

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
    const label = urlParts[urlParts.length - 1] || 'Media';
    onSave(mediaUrl.trim(), label);
    onClose();
  }, [mediaUrl, onSave, onClose]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaUrl(e.target.value);
  }, []);

  const resetState = useCallback(() => {
    setMediaUrl('');
    setTabValue(0);
  }, []);

  return {
    tabValue,
    mediaUrl,
    handleTabChange,
    handleMediaSelect,
    handleUrlSave,
    handleUrlChange,
    resetState,
  };
};
