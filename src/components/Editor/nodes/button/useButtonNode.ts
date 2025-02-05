import { useCallback } from 'react';

interface UseButtonNodeProps {
  id: string;
  targetNodeId?: string;
  isPlaybackMode?: boolean;
  onNavigate?: (targetNodeId: string) => void;
}

export const useButtonNode = ({
  targetNodeId,
  isPlaybackMode,
  onNavigate,
}: UseButtonNodeProps) => {
  const handleClick = useCallback(() => {
    if (isPlaybackMode && targetNodeId && onNavigate) {
      onNavigate(targetNodeId);
    }
  }, [isPlaybackMode, targetNodeId, onNavigate]);

  return {
    handleClick,
  };
};

export default useButtonNode;
