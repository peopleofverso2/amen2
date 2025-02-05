import { useState, useCallback } from 'react';

interface UseVideoNodeProps {
  id: string;
  initialUrl: string;
  isPlaybackMode?: boolean;
  onDataChange?: (data: any) => void;
  onNavigate?: (targetNodeId: string) => void;
}

export const useVideoNode = ({
  initialUrl,
  isPlaybackMode,
  onDataChange,
  onNavigate,
}: UseVideoNodeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [editUrl, setEditUrl] = useState(initialUrl || '');

  const handleOpen = useCallback(() => {
    if (!isPlaybackMode) {
      setIsOpen(true);
    }
  }, [isPlaybackMode]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSave = useCallback((url: string, label?: string) => {
    if (onDataChange) {
      onDataChange({ videoUrl: url, ...(label && { label }) });
    }
    setEditUrl(url);
    handleClose();
  }, [onDataChange, handleClose]);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    setShowButtons(true);
    if (onNavigate) {
      // En mode automatique, on navigue directement
      // Sinon on attend que l'utilisateur clique sur un bouton
      if (!isPlaybackMode) {
        onNavigate('next');
      }
    }
  }, [onNavigate, isPlaybackMode]);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    setShowButtons(false);
  }, []);

  const handleButtonClick = useCallback((targetNodeId: string) => {
    if (onNavigate) {
      onNavigate(targetNodeId);
    }
  }, [onNavigate]);

  return {
    isOpen,
    editUrl,
    isPlaying,
    showButtons,
    handleOpen,
    handleClose,
    handleSave,
    handleVideoEnd,
    handleError,
    handleButtonClick,
    setEditUrl,
  };
};

export default useVideoNode;
