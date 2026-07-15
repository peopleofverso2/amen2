import {
  ContributionSummary,
  ProjectSocial,
  ProjectSocialSummary,
  SceneComment,
  SceneContribution,
  SceneContributionStatus,
  SceneContributionType,
  SceneRating,
  SceneVote,
  SceneVoteValue,
} from '../types/project';

const LOCAL_VOTER_NAME = 'Lecteur local';
const DEFAULT_AUTHOR_NAME = 'Contributeur';
const POPULAR_SCORE_THRESHOLD = 8;

export interface CreateContributionInput {
  targetNodeId: string;
  type: SceneContributionType;
  title: string;
  body: string;
  authorName?: string;
}

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const clampRating = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

const cleanText = (value: unknown, fallback = '') => {
  const text = String(value ?? fallback).trim().replace(/\s+/g, ' ');
  return text || fallback;
};

const isContributionType = (value: unknown): value is SceneContributionType => (
  value === 'insert' || value === 'alternative' || value === 'continuation'
);

const isContributionStatus = (value: unknown): value is SceneContributionStatus => (
  value === 'experimental' || value === 'popular' || value === 'canon' || value === 'archived'
);

export const createEmptyProjectSocial = (): ProjectSocial => ({
  version: 1,
  mode: 'author_decides',
  contributions: [],
});

const normalizeVote = (vote: Partial<SceneVote>): SceneVote | null => {
  const value = vote.value === -1 ? -1 : vote.value === 1 ? 1 : null;
  if (!value) {
    return null;
  }

  const createdAt = String(vote.createdAt || nowIso());
  return {
    id: String(vote.id || createId('vote')),
    voterName: cleanText(vote.voterName, LOCAL_VOTER_NAME),
    value,
    createdAt,
    updatedAt: String(vote.updatedAt || createdAt),
  };
};

const normalizeRating = (rating: Partial<SceneRating>): SceneRating | null => {
  const value = Number(rating.value);
  if (!Number.isFinite(value)) {
    return null;
  }

  const createdAt = String(rating.createdAt || nowIso());
  return {
    id: String(rating.id || createId('rating')),
    voterName: cleanText(rating.voterName, LOCAL_VOTER_NAME),
    value: clampRating(value),
    createdAt,
    updatedAt: String(rating.updatedAt || createdAt),
  };
};

const normalizeComment = (comment: Partial<SceneComment>): SceneComment | null => {
  const body = cleanText(comment.body);
  if (!body) {
    return null;
  }

  const createdAt = String(comment.createdAt || nowIso());
  return {
    id: String(comment.id || createId('comment')),
    authorName: cleanText(comment.authorName, LOCAL_VOTER_NAME),
    body,
    createdAt,
    updatedAt: String(comment.updatedAt || createdAt),
  };
};

const normalizeContribution = (
  contribution: Partial<SceneContribution>
): SceneContribution | null => {
  const targetNodeId = cleanText(contribution.targetNodeId);
  const title = cleanText(contribution.title);
  if (!targetNodeId || !title) {
    return null;
  }

  const createdAt = String(contribution.createdAt || nowIso());
  return {
    id: String(contribution.id || createId('contribution')),
    targetNodeId,
    type: isContributionType(contribution.type) ? contribution.type : 'alternative',
    status: isContributionStatus(contribution.status) ? contribution.status : 'experimental',
    title,
    body: String(contribution.body || '').trim(),
    authorName: cleanText(contribution.authorName, DEFAULT_AUTHOR_NAME),
    votes: Array.isArray(contribution.votes)
      ? contribution.votes.map(normalizeVote).filter((vote): vote is SceneVote => Boolean(vote))
      : [],
    ratings: Array.isArray(contribution.ratings)
      ? contribution.ratings.map(normalizeRating).filter((rating): rating is SceneRating => Boolean(rating))
      : [],
    comments: Array.isArray(contribution.comments)
      ? contribution.comments.map(normalizeComment).filter((comment): comment is SceneComment => Boolean(comment))
      : [],
    createdAt,
    updatedAt: String(contribution.updatedAt || createdAt),
    promotedAt: contribution.promotedAt ? String(contribution.promotedAt) : undefined,
  };
};

export const normalizeProjectSocial = (social?: Partial<ProjectSocial> | null): ProjectSocial => {
  if (!social || typeof social !== 'object') {
    return createEmptyProjectSocial();
  }

  return {
    version: 1,
    mode: 'author_decides',
    contributions: Array.isArray(social.contributions)
      ? social.contributions
          .map(normalizeContribution)
          .filter((contribution): contribution is SceneContribution => Boolean(contribution))
      : [],
  };
};

export const createSceneContribution = (input: CreateContributionInput): SceneContribution => {
  const timestamp = nowIso();
  return {
    id: createId('contribution'),
    targetNodeId: input.targetNodeId,
    type: input.type,
    status: 'experimental',
    title: cleanText(input.title, 'Scene alternative'),
    body: input.body.trim(),
    authorName: cleanText(input.authorName, DEFAULT_AUTHOR_NAME),
    votes: [],
    ratings: [],
    comments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const getContributionSummary = (contribution: SceneContribution): ContributionSummary => {
  const upvotes = contribution.votes.filter((vote) => vote.value === 1).length;
  const downvotes = contribution.votes.filter((vote) => vote.value === -1).length;
  const ratingCount = contribution.ratings.length;
  const ratingTotal = contribution.ratings.reduce((total, rating) => total + rating.value, 0);
  const averageRating = ratingCount ? ratingTotal / ratingCount : 0;
  const bayesianRating = ratingCount ? ((averageRating * ratingCount) + (3.5 * 5)) / (ratingCount + 5) : 0;
  const statusBonus = contribution.status === 'canon' ? 6 : contribution.status === 'popular' ? 3 : 0;

  return {
    upvotes,
    downvotes,
    averageRating,
    ratingCount,
    commentCount: contribution.comments.length,
    score: Number((bayesianRating + upvotes - downvotes + contribution.comments.length * 0.2 + statusBonus).toFixed(2)),
  };
};

export const getProjectSocialSummary = (social: ProjectSocial): ProjectSocialSummary => {
  const summaries = social.contributions.map(getContributionSummary);
  const rated = summaries.filter((summary) => summary.ratingCount > 0);
  const ratingTotal = rated.reduce((total, summary) => total + summary.averageRating, 0);

  return {
    contributionCount: social.contributions.length,
    canonCount: social.contributions.filter((contribution) => contribution.status === 'canon').length,
    popularCount: social.contributions.filter((contribution) => contribution.status === 'popular').length,
    averageRating: rated.length ? ratingTotal / rated.length : 0,
  };
};

export const sortContributionsByScore = (contributions: SceneContribution[]) => (
  [...contributions].sort((left, right) => {
    const scoreDelta = getContributionSummary(right).score - getContributionSummary(left).score;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })
);

const updateContribution = (
  social: ProjectSocial,
  contributionId: string,
  updater: (contribution: SceneContribution) => SceneContribution
): ProjectSocial => ({
  ...social,
  contributions: social.contributions.map((contribution) => (
    contribution.id === contributionId ? updater(contribution) : contribution
  )),
});

export const addContribution = (social: ProjectSocial, contribution: SceneContribution): ProjectSocial => ({
  ...social,
  contributions: [contribution, ...social.contributions],
});

export const recordContributionVote = (
  social: ProjectSocial,
  contributionId: string,
  value: SceneVoteValue,
  voterName = LOCAL_VOTER_NAME
): ProjectSocial => updateContribution(social, contributionId, (contribution) => {
  const timestamp = nowIso();
  const normalizedVoter = cleanText(voterName, LOCAL_VOTER_NAME);
  const existing = contribution.votes.find((vote) => vote.voterName === normalizedVoter);
  const votes = existing
    ? contribution.votes
        .map((vote) => (
          vote.voterName === normalizedVoter
            ? { ...vote, value, updatedAt: timestamp }
            : vote
        ))
        .filter((vote) => !(existing.value === value && vote.voterName === normalizedVoter))
    : [
        ...contribution.votes,
        {
          id: createId('vote'),
          voterName: normalizedVoter,
          value,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ];

  return {
    ...contribution,
    votes,
    updatedAt: timestamp,
  };
});

export const recordContributionRating = (
  social: ProjectSocial,
  contributionId: string,
  value: number,
  voterName = LOCAL_VOTER_NAME
): ProjectSocial => updateContribution(social, contributionId, (contribution) => {
  const timestamp = nowIso();
  const normalizedVoter = cleanText(voterName, LOCAL_VOTER_NAME);
  const ratingValue = clampRating(value);
  const existing = contribution.ratings.find((rating) => rating.voterName === normalizedVoter);
  const ratings = existing
    ? contribution.ratings.map((rating) => (
        rating.voterName === normalizedVoter
          ? { ...rating, value: ratingValue, updatedAt: timestamp }
          : rating
      ))
    : [
        ...contribution.ratings,
        {
          id: createId('rating'),
          voterName: normalizedVoter,
          value: ratingValue,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ];

  return {
    ...contribution,
    ratings,
    updatedAt: timestamp,
  };
});

export const addContributionComment = (
  social: ProjectSocial,
  contributionId: string,
  body: string,
  authorName = LOCAL_VOTER_NAME
): ProjectSocial => {
  const commentBody = body.trim();
  if (!commentBody) {
    return social;
  }

  return updateContribution(social, contributionId, (contribution) => {
    const timestamp = nowIso();
    return {
      ...contribution,
      comments: [
        ...contribution.comments,
        {
          id: createId('comment'),
          authorName: cleanText(authorName, LOCAL_VOTER_NAME),
          body: commentBody,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      updatedAt: timestamp,
    };
  });
};

export const updateContributionStatus = (
  social: ProjectSocial,
  contributionId: string,
  status: SceneContributionStatus
): ProjectSocial => updateContribution(social, contributionId, (contribution) => {
  const timestamp = nowIso();
  return {
    ...contribution,
    status,
    promotedAt: status === 'canon' || status === 'popular' ? timestamp : contribution.promotedAt,
    updatedAt: timestamp,
  };
});

export const refreshPopularStatuses = (social: ProjectSocial): ProjectSocial => ({
  ...social,
  contributions: social.contributions.map((contribution) => {
    if (contribution.status !== 'experimental') {
      return contribution;
    }

    const summary = getContributionSummary(contribution);
    if (summary.score < POPULAR_SCORE_THRESHOLD || summary.ratingCount < 2) {
      return contribution;
    }

    return {
      ...contribution,
      status: 'popular',
      promotedAt: nowIso(),
      updatedAt: nowIso(),
    };
  }),
});
