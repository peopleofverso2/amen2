const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const DEFAULT_SOCIAL = {
  version: 1,
  mode: 'author_decides',
  contributions: [],
};

const toIso = (value) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
};

const cloneJson = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
};

const normalizeScenario = (project) => {
  const scenario = project?.scenario && typeof project.scenario === 'object' ? project.scenario : {};
  return {
    scenarioTitle: String(scenario.scenarioTitle || project?.scenarioTitle || project?.title || 'Nouveau scenario'),
    description: String(scenario.description || project?.description || ''),
    steps: Array.isArray(scenario.steps) ? scenario.steps : [],
  };
};

const normalizeSocial = (social) => {
  if (!social || typeof social !== 'object') return cloneJson(DEFAULT_SOCIAL, DEFAULT_SOCIAL);
  return {
    version: 1,
    mode: 'author_decides',
    contributions: Array.isArray(social.contributions) ? social.contributions : [],
  };
};

const contributionSummary = (contribution) => {
  const votes = Array.isArray(contribution?.votes) ? contribution.votes : [];
  const ratings = Array.isArray(contribution?.ratings) ? contribution.ratings : [];
  const upvotes = votes.filter((vote) => vote.value === 1).length;
  const downvotes = votes.filter((vote) => vote.value === -1).length;
  const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + Number(rating.value || 0), 0) / ratings.length
    : 0;

  return {
    upvotes,
    downvotes,
    averageRating,
    ratingCount: ratings.length,
  };
};

const socialSummary = (social) => {
  const normalized = normalizeSocial(social);
  const summaries = normalized.contributions.map(contributionSummary);
  const rated = summaries.filter((summary) => summary.ratingCount > 0);
  const ratingTotal = rated.reduce((total, summary) => total + summary.averageRating, 0);

  return {
    contributionCount: normalized.contributions.length,
    canonCount: normalized.contributions.filter((contribution) => contribution.status === 'canon').length,
    popularCount: normalized.contributions.filter((contribution) => contribution.status === 'popular').length,
    averageRating: rated.length ? ratingTotal / rated.length : 0,
  };
};

const normalizeProject = (project) => {
  const now = new Date().toISOString();
  const scenario = normalizeScenario(project);

  return {
    projectId: String(project?.projectId || project?.project_id || randomUUID()),
    scenario,
    nodes: Array.isArray(project?.nodes) ? project.nodes : [],
    edges: Array.isArray(project?.edges) ? project.edges : [],
    social: normalizeSocial(project?.social),
    createdAt: toIso(project?.createdAt || project?.created_at || now),
    updatedAt: toIso(project?.updatedAt || project?.updated_at || now),
  };
};

const metadataFromProject = (project) => ({
  projectId: project.projectId,
  scenarioTitle: project.scenario.scenarioTitle,
  description: project.scenario.description,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  socialSummary: socialSummary(project.social),
});

const postgresConfigFromEnv = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }

  const cloudSqlConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  const host = cloudSqlConnectionName ? `/cloudsql/${cloudSqlConnectionName}` : process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    user,
    password: process.env.PGPASSWORD || undefined,
    database,
    port: Number(process.env.PGPORT || 5432),
    max: Number(process.env.PGPOOL_MAX || 8),
  };
};

const projectFromRow = (row) => normalizeProject({
  projectId: row.project_id,
  scenario: row.scenario,
  nodes: row.nodes,
  edges: row.edges,
  social: row.social,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createFileStore = (filePath) => {
  const ensureFile = () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({ projects: [] }, null, 2), 'utf8');
    }
  };

  const readState = () => {
    ensureFile();
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  };

  const writeState = (state) => {
    ensureFile();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  };

  return {
    async init() {
      ensureFile();
    },

    async listProjects() {
      const state = readState();
      return state.projects.map(normalizeProject).sort((left, right) => (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ));
    },

    async getProject(projectId) {
      const state = readState();
      const project = state.projects.find((item) => item.projectId === projectId);
      return project ? normalizeProject(project) : null;
    },

    async saveProject(project) {
      const normalized = normalizeProject(project);
      const state = readState();
      const existingIndex = state.projects.findIndex((item) => item.projectId === normalized.projectId);
      if (existingIndex >= 0) {
        state.projects[existingIndex] = normalized;
      } else {
        state.projects.push(normalized);
      }
      writeState(state);
      return normalized;
    },

    async deleteProject(projectId) {
      const state = readState();
      const nextProjects = state.projects.filter((item) => item.projectId !== projectId);
      const deleted = nextProjects.length !== state.projects.length;
      writeState({ projects: nextProjects });
      return deleted;
    },
  };
};

const createPostgresStore = (config) => {
  const pool = new Pool(config);

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          project_id TEXT PRIMARY KEY,
          scenario JSONB NOT NULL,
          nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
          edges JSONB NOT NULL DEFAULT '[]'::jsonb,
          social JSONB NOT NULL DEFAULT '{"version":1,"mode":"author_decides","contributions":[]}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (updated_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS projects_social_gin_idx ON projects USING GIN (social)');
    },

    async listProjects() {
      const result = await pool.query(`
        SELECT project_id, scenario, nodes, edges, social, created_at, updated_at
        FROM projects
        ORDER BY updated_at DESC
      `);
      return result.rows.map(projectFromRow);
    },

    async getProject(projectId) {
      const result = await pool.query(`
        SELECT project_id, scenario, nodes, edges, social, created_at, updated_at
        FROM projects
        WHERE project_id = $1
      `, [projectId]);
      return result.rows[0] ? projectFromRow(result.rows[0]) : null;
    },

    async saveProject(project) {
      const normalized = normalizeProject(project);
      await pool.query(`
        INSERT INTO projects (project_id, scenario, nodes, edges, social, created_at, updated_at)
        VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
        ON CONFLICT (project_id)
        DO UPDATE SET
          scenario = EXCLUDED.scenario,
          nodes = EXCLUDED.nodes,
          edges = EXCLUDED.edges,
          social = EXCLUDED.social,
          updated_at = EXCLUDED.updated_at
      `, [
        normalized.projectId,
        JSON.stringify(normalized.scenario),
        JSON.stringify(normalized.nodes),
        JSON.stringify(normalized.edges),
        JSON.stringify(normalized.social),
        normalized.createdAt,
        normalized.updatedAt,
      ]);
      return normalized;
    },

    async deleteProject(projectId) {
      const result = await pool.query('DELETE FROM projects WHERE project_id = $1', [projectId]);
      return result.rowCount > 0;
    },
  };
};

const createProjectStore = (options = {}) => {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const postgresConfig = postgresConfigFromEnv();
  const backend = postgresConfig ? 'cloud-sql-postgres' : 'file';
  const store = postgresConfig
    ? createPostgresStore(postgresConfig)
    : createFileStore(path.join(rootDir, 'data', 'projects-db.json'));

  let initPromise = null;

  const ensureInit = async () => {
    if (!initPromise) {
      initPromise = store.init();
    }
    await initPromise;
  };

  return {
    backend,

    async health() {
      await ensureInit();
      return { backend };
    },

    async createProject(title, description = '') {
      await ensureInit();
      const now = new Date().toISOString();
      const project = normalizeProject({
        projectId: randomUUID(),
        scenario: {
          scenarioTitle: title,
          description,
          steps: [],
        },
        nodes: [],
        edges: [],
        social: DEFAULT_SOCIAL,
        createdAt: now,
        updatedAt: now,
      });
      return store.saveProject(project);
    },

    async listMetadata() {
      await ensureInit();
      const projects = await store.listProjects();
      return projects.map(metadataFromProject);
    },

    async listProjects() {
      await ensureInit();
      return store.listProjects();
    },

    async getProject(projectId) {
      await ensureInit();
      return store.getProject(projectId);
    },

    async saveProject(project) {
      await ensureInit();
      return store.saveProject({
        ...project,
        updatedAt: new Date().toISOString(),
      });
    },

    async patchProject(projectId, updates) {
      await ensureInit();
      const project = await store.getProject(projectId);
      if (!project) {
        return null;
      }

      return store.saveProject({
        ...project,
        ...updates,
        scenario: {
          ...project.scenario,
          ...(updates.scenario || {}),
        },
        social: updates.social ? normalizeSocial(updates.social) : project.social,
        projectId,
        updatedAt: new Date().toISOString(),
      });
    },

    async deleteProject(projectId) {
      await ensureInit();
      return store.deleteProject(projectId);
    },

    async importProjects(projects) {
      await ensureInit();
      const imported = [];
      for (const project of projects) {
        imported.push(await store.saveProject(normalizeProject(project)));
      }
      return imported;
    },
  };
};

module.exports = {
  createProjectStore,
  normalizeProject,
  normalizeSocial,
  socialSummary,
};
