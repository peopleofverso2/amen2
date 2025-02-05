import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, Typography, Button, Stack } from '@mui/material';
import { BaseNodeData } from '../../../types/nodes';

interface BaseNodeProps {
  data: BaseNodeData;
  isConnectable: boolean;
}

const BaseNode = ({ data, isConnectable }: BaseNodeProps) => {
  return (
    <Card sx={{ minWidth: 250, backgroundColor: '#2a2a2a' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {data.label}
        </Typography>
        
        <Stack spacing={1} mt={2}>
          {data.choices.map((choice, index) => (
            <Button
              key={index}
              variant="outlined"
              size="small"
              sx={{ justifyContent: 'flex-start' }}
            >
              {choice.text}
            </Button>
          ))}
        </Stack>

        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
        />
        
        {[Position.Bottom, Position.Right, Position.Left].map((position, index) => (
          <Handle
            key={position}
            type="source"
            position={position}
            id={`choice-${index}`}
            isConnectable={isConnectable}
            style={{ 
              background: '#1976d2',
              top: position === Position.Right ? '33%' : 'auto',
              bottom: position === Position.Right ? 'auto' : 'auto'
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default memo(BaseNode);
