import { useState, useCallback, useEffect } from 'react';

interface UseVideoNodeProps {
  id: string;
  initialUrl: string;
  isPlaybackMode?: boolean;
  onDataChange?: (data: Record<string, unknown>) => void;
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

  useEffect(() => {
    if (isPlaybackMode && (initialUrl || editUrl)) {
      setIsPlaying(true);
      setShowButtons(false);
      return;
    }

    setIsPlaying(false);
    setShowButtons(false);
  }, [isPlaybackMode, initialUrl, editUrl]);

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
    if (isPlaybackMode) {
      setIsPlaying(true);
      setShowButtons(false);
    }
    handleClose();
  }, [onDataChange, handleClose, isPlaybackMode]);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    setShowButtons(true);
    if (onNavigate) {
      // Navigation automatique uniquement en mode lecture
      if (isPlaybackMode) {
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
