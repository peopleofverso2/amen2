import React from 'react';

interface VideoButtonProps {
  id: string;
  label: string;
  isSelected: boolean;
  isPlaybackMode: boolean;
  onButtonClick: (buttonId: string) => void;
}

const VideoButton = ({
  id,
  label,
  isSelected,
  isPlaybackMode,
  onButtonClick,
}: VideoButtonProps) => {
  return (
    <div
      onClick={() => onButtonClick(id)}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: isSelected ? '#FF6B6B' : '#333',
        color: '#fff',
        borderRadius: '6px',
        cursor: isPlaybackMode ? 'pointer' : 'default',
        marginBottom: '10px',
        border: `2px solid ${isSelected ? '#FF6B6B' : '#666'}`,
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? '0 0 12px rgba(255, 107, 107, 0.4)' : 'none',
      }}
    >
      <span style={{ fontSize: '14px' }}>{label}</span>
    </div>
  );
};

export default VideoButton;
