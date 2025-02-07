import React from 'react';
import { EdgeProps, BaseEdge, getStraightPath } from 'reactflow';

export default function ChoiceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: '#555',
        }}
      />
      {data?.text && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 10}
          textAnchor="middle"
          style={{ 
            fill: '#555',
            fontSize: '12px',
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: 'white',
            padding: '2px 4px',
          }}
        >
          <tspan dx="0" dy="0" style={{ backgroundColor: 'white' }}>
            {data.text}
          </tspan>
        </text>
      )}
    </>
  );
}
