import { useMemo, useState } from 'react';
import { Node } from 'reactflow';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  AccountTree as BranchIcon,
  CheckCircle as CanonIcon,
  Forum as CommentIcon,
  ThumbDown as DownvoteIcon,
  ThumbUp as UpvoteIcon,
} from '@mui/icons-material';
import {
  ProjectSocial,
  SceneContribution,
  SceneContributionStatus,
  SceneContributionType,
  SceneVoteValue,
} from '../../../types/project';
import {
  CreateContributionInput,
  getContributionSummary,
  sortContributionsByScore,
} from '../../../services/socialService';

interface SocialScenePanelProps {
  nodes: Node[];
  selectedNodeId: string | null;
  social: ProjectSocial;
  onSelectNode: (nodeId: string) => void;
  onAddContribution: (input: CreateContributionInput) => void;
  onVoteContribution: (contributionId: string, value: SceneVoteValue) => void;
  onRateContribution: (contributionId: string, value: number) => void;
  onCommentContribution: (contributionId: string, body: string) => void;
  onSetContributionStatus: (contributionId: string, status: SceneContributionStatus) => void;
  onPromoteContribution: (contribution: SceneContribution) => void;
}

const CONTRIBUTION_TYPE_LABELS: Record<SceneContributionType, string> = {
  insert: 'Intercaler apres',
  alternative: 'Alternative',
  continuation: 'Continuation',
};

const STATUS_LABELS: Record<SceneContributionStatus, string> = {
  experimental: 'Experimental',
  popular: 'Populaire',
  canon: 'Canon',
  archived: 'Archive',
};

const STATUS_COLORS: Record<SceneContributionStatus, 'default' | 'primary' | 'success' | 'warning'> = {
  experimental: 'default',
  popular: 'primary',
  canon: 'success',
  archived: 'warning',
};

const getNodeTitle = (node?: Node) => {
  const data = node?.data as {
    label?: string;
    sceneTitle?: string;
    content?: { title?: string; text?: string };
  } | undefined;

  return data?.content?.title || data?.sceneTitle || data?.label || (node ? `Scene ${node.id.slice(0, 6)}` : '');
};

const formatScore = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  });
};

export default function SocialScenePanel({
  nodes,
  selectedNodeId,
  social,
  onSelectNode,
  onAddContribution,
  onVoteContribution,
  onRateContribution,
  onCommentContribution,
  onSetContributionStatus,
  onPromoteContribution,
}: SocialScenePanelProps) {
  const [type, setType] = useState<SceneContributionType>('alternative');
  const [authorName, setAuthorName] = useState('Contributeur');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const activeNodeId = selectedNodeId || nodes[0]?.id || '';
  const activeNode = nodes.find((node) => node.id === activeNodeId);
  const selectedContributions = useMemo(
    () => sortContributionsByScore(
      social.contributions.filter((contribution) => contribution.targetNodeId === activeNodeId)
    ),
    [activeNodeId, social.contributions]
  );
  const allContributions = social.contributions.length;

  const handleSubmit = () => {
    if (!activeNodeId || !title.trim()) {
      return;
    }

    onAddContribution({
      targetNodeId: activeNodeId,
      type,
      title,
      body,
      authorName,
    });
    setTitle('');
    setBody('');
  };

  const handleCommentSubmit = (contributionId: string) => {
    const draft = commentDrafts[contributionId]?.trim();
    if (!draft) {
      return;
    }

    onCommentContribution(contributionId, draft);
    setCommentDrafts((current) => ({
      ...current,
      [contributionId]: '',
    }));
  };

  return (
    <Paper
      elevation={8}
      sx={(theme) => ({
        position: 'absolute',
        top: theme.spacing(2),
        left: theme.spacing(2),
        zIndex: 1000,
        width: 360,
        maxHeight: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        border: `1px solid ${alpha(theme.palette.divider, 0.14)}`,
        borderRadius: 2,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      })}
    >
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BranchIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
              Social scenes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {allContributions} proposition{allContributions > 1 ? 's' : ''} sur ce projet
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ p: 2, overflowY: 'auto' }}>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="social-scene-select-label">Scene cible</InputLabel>
            <Select
              labelId="social-scene-select-label"
              label="Scene cible"
              value={activeNodeId}
              onChange={(event) => onSelectNode(event.target.value)}
              disabled={!nodes.length}
            >
              {nodes.map((node) => (
                <MenuItem key={node.id} value={node.id}>
                  {getNodeTitle(node)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Proposer une scene
            </Typography>
            <Stack spacing={1.25}>
              <FormControl size="small" fullWidth>
                <InputLabel id="contribution-type-label">Type</InputLabel>
                <Select
                  labelId="contribution-type-label"
                  label="Type"
                  value={type}
                  onChange={(event) => setType(event.target.value as SceneContributionType)}
                >
                  {Object.entries(CONTRIBUTION_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Auteur"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
              />
              <TextField
                size="small"
                label="Titre de la scene"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <TextField
                size="small"
                label="Intention / contenu"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                multiline
                minRows={3}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleSubmit}
                disabled={!activeNodeId || !title.trim()}
              >
                Ajouter la proposition
              </Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Variantes et votes
            </Typography>

            {!nodes.length && (
              <Typography variant="body2" color="text.secondary">
                Ajoute une scene au canevas pour ouvrir les propositions sociales.
              </Typography>
            )}

            {nodes.length > 0 && !selectedContributions.length && (
              <Typography variant="body2" color="text.secondary">
                Aucune proposition pour {getNodeTitle(activeNode)}.
              </Typography>
            )}

            <Stack spacing={1.5}>
              {selectedContributions.map((contribution) => {
                const summary = getContributionSummary(contribution);
                const commentDraft = commentDrafts[contribution.id] || '';

                return (
                  <Box
                    key={contribution.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {contribution.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CONTRIBUTION_TYPE_LABELS[contribution.type]} - {contribution.authorName}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={STATUS_LABELS[contribution.status]}
                          color={STATUS_COLORS[contribution.status]}
                        />
                      </Stack>

                      {contribution.body && (
                        <Typography variant="body2" color="text.secondary">
                          {contribution.body}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Tooltip title="Vote positif">
                          <IconButton size="small" onClick={() => onVoteContribution(contribution.id, 1)}>
                            <UpvoteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Typography variant="caption">{summary.upvotes}</Typography>

                        <Tooltip title="Vote negatif">
                          <IconButton size="small" onClick={() => onVoteContribution(contribution.id, -1)}>
                            <DownvoteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Typography variant="caption">{summary.downvotes}</Typography>

                        <Rating
                          size="small"
                          value={summary.averageRating || null}
                          precision={1}
                          onChange={(_, value) => {
                            if (value) onRateContribution(contribution.id, value);
                          }}
                        />
                        <Typography variant="caption">
                          {summary.ratingCount ? formatScore(summary.averageRating) : '-'} - score {formatScore(summary.score)}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CanonIcon />}
                          onClick={() => onSetContributionStatus(contribution.id, 'canon')}
                        >
                          Canon
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onSetContributionStatus(contribution.id, 'popular')}
                        >
                          Populaire
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => onPromoteContribution(contribution)}
                        >
                          Integrer
                        </Button>
                      </Stack>

                      {!!contribution.comments.length && (
                        <Stack spacing={0.75}>
                          {contribution.comments.slice(-2).map((comment) => (
                            <Box key={comment.id} sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" color="text.secondary">
                                {comment.authorName}
                              </Typography>
                              <Typography variant="body2">{comment.body}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          label="Commentaire"
                          value={commentDraft}
                          onChange={(event) => setCommentDrafts((current) => ({
                            ...current,
                            [contribution.id]: event.target.value,
                          }))}
                          fullWidth
                        />
                        <Tooltip title="Publier">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleCommentSubmit(contribution.id)}
                              disabled={!commentDraft.trim()}
                            >
                              <CommentIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}
