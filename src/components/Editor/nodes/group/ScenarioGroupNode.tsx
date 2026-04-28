import { memo, useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  AddLink as AddLinkIcon,
  LinkOff as LinkOffIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ScenarioGroupNodeData } from '../../../../types/nodes';

interface ScenarioGroupNodeProps {
  data: ScenarioGroupNodeData;
  isConnectable: boolean;
}

const ScenarioGroupNode = ({ data, isConnectable }: ScenarioGroupNodeProps) => {
  const [label, setLabel] = useState(data.label || 'Nouveau groupe');
  const [description, setDescription] = useState(data.description || '');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const isExpanded = Boolean(data.isExpanded);

  useEffect(() => {
    setLabel(data.label || 'Nouveau groupe');
  }, [data.label]);

  useEffect(() => {
    setDescription(data.description || '');
  }, [data.description]);

  const openEditor = () => {
    setLabel(data.label || 'Nouveau groupe');
    setDescription(data.description || '');
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
  };

  const commitChanges = () => {
    if (!data.onDataChange) {
      setIsEditorOpen(false);
      return;
    }
    data.onDataChange({
      label: label.trim() || 'Nouveau groupe',
      description: description.trim() || undefined,
    });
    setIsEditorOpen(false);
  };

  return (
    <>
      <Box
        onDoubleClick={openEditor}
        sx={{
          width: isExpanded ? 920 : 288,
          minHeight: isExpanded ? 560 : 120,
          bgcolor: isExpanded ? 'transparent' : '#1f2937',
          borderRadius: 1,
          border: isExpanded
            ? '1px dashed rgba(96, 165, 250, 0.7)'
            : '1px solid rgba(59, 130, 246, 0.45)',
          p: 1.5,
          boxShadow: isExpanded ? '0 0 0 1px rgba(59,130,246,0.15) inset' : undefined,
          pointerEvents: isExpanded ? 'none' : 'auto',
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="in-top"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="in-left"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="in-right"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />

        <Box
          className={isExpanded ? 'group-node__drag-handle' : undefined}
          onDoubleClick={openEditor}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: isExpanded ? 0.75 : 0,
            borderRadius: isExpanded ? 1 : 0,
            bgcolor: isExpanded ? 'rgba(15,23,42,0.72)' : 'transparent',
            width: isExpanded ? 'fit-content' : '100%',
            maxWidth: isExpanded ? 'calc(100% - 16px)' : '100%',
            pointerEvents: 'auto',
            cursor: isExpanded ? 'grab' : 'default',
          }}
        >
          <AccountTreeIcon sx={{ color: '#93c5fd' }} fontSize="small" />
          <Typography
            variant="subtitle2"
            sx={{
              color: 'white',
              fontWeight: 700,
              flex: 1,
              minWidth: 0,
            }}
            noWrap
            title={data.label || 'Nouveau groupe'}
          >
            {data.label || 'Nouveau groupe'}
          </Typography>
          <IconButton
            className="nodrag nopan"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleExpanded?.();
            }}
            sx={{ color: '#93c5fd' }}
            title={isExpanded ? 'Fermer le groupe' : 'Ouvrir le groupe'}
          >
            {isExpanded ? <FolderIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
          </IconButton>
          <IconButton
            className="nodrag nopan"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              openEditor();
            }}
            sx={{ color: '#93c5fd' }}
            title="Éditer le groupe"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.75)',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            minHeight: isExpanded ? 20 : 30,
            mt: 0.5,
            mb: isExpanded ? 1.25 : 0.25,
            pointerEvents: 'auto',
            width: isExpanded ? 'fit-content' : '100%',
            maxWidth: isExpanded ? 'calc(100% - 16px)' : '100%',
            bgcolor: isExpanded ? 'rgba(15,23,42,0.72)' : 'transparent',
            px: isExpanded ? 1 : 0,
            py: isExpanded ? 0.5 : 0,
            borderRadius: isExpanded ? 1 : 0,
          }}
        >
          {data.description?.trim() || 'Double-clic pour ouvrir l’édition du groupe.'}
        </Typography>

        {isExpanded && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              width: 'fit-content',
              maxWidth: 'calc(100% - 16px)',
              bgcolor: 'rgba(15,23,42,0.72)',
              borderRadius: 1,
              px: 1,
              py: 0.75,
              pointerEvents: 'auto',
            }}
          >
            <Button
              className="nodrag nopan"
              size="small"
              variant="outlined"
              startIcon={<AddLinkIcon />}
              onClick={(event) => {
                event.stopPropagation();
                data.onAssignSelectedNodes?.();
              }}
              sx={{ color: '#bfdbfe', borderColor: 'rgba(147,197,253,0.5)' }}
            >
              Ajouter sélection
            </Button>
            <Button
              className="nodrag nopan"
              size="small"
              variant="text"
              startIcon={<LinkOffIcon />}
              onClick={(event) => {
                event.stopPropagation();
                data.onDetachChildren?.();
              }}
              sx={{ color: 'rgba(255,255,255,0.8)' }}
              disabled={!data.childCount}
            >
              Détacher
            </Button>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', ml: 'auto' }}>
              {data.childCount || 0} node{(data.childCount || 0) > 1 ? 's' : ''}
            </Typography>
          </Box>
        )}

        {!isExpanded && (
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.62)', pointerEvents: 'auto' }}
          >
            {data.childCount || 0} node{(data.childCount || 0) > 1 ? 's' : ''} intégré
          </Typography>
        )}

        {isExpanded && (
          <Typography
            variant="caption"
            sx={{
              mt: 1,
              display: 'block',
              color: 'rgba(255,255,255,0.62)',
              pointerEvents: 'auto',
              width: 'fit-content',
              maxWidth: 'calc(100% - 16px)',
              bgcolor: 'rgba(15,23,42,0.68)',
              borderRadius: 1,
              px: 1,
              py: 0.5,
            }}
          >
            Groupe ouvert: les nodes intégrés restent éditables à l’intérieur.
          </Typography>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="out-bottom"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="out-left"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="out-right"
          isConnectable={isConnectable}
          style={{ pointerEvents: 'auto' }}
        />
      </Box>

      <Dialog open={isEditorOpen} onClose={closeEditor} maxWidth="sm" fullWidth>
        <DialogTitle>Éditer le groupe</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'grid', gap: 2 }}>
            <TextField
              className="nodrag nopan"
              label="Nom du groupe"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              className="nodrag nopan"
              label="Description (optionnel)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor}>Annuler</Button>
          <Button onClick={commitChanges} variant="contained">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default memo(ScenarioGroupNode);
