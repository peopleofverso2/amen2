export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

interface AuthPayload {
  authenticated: boolean;
  user: AuthUser | null;
  error?: string;
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface RegisterPayload extends AuthCredentials {
  name?: string;
}

const AUTH_API_BASE = '/api/auth';

const parseJson = async (response: Response): Promise<AuthPayload> => {
  try {
    return (await response.json()) as AuthPayload;
  } catch {
    return {
      authenticated: false,
      user: null,
      error: `HTTP ${response.status}`,
    };
  }
};

const postAuth = async (
  endpoint: string,
  payload?: unknown
): Promise<AuthPayload> => {
  const response = await fetch(`${AUTH_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const data = await parseJson(response);
  if (!response.ok || !data.authenticated || !data.user) {
    throw new Error(data.error || 'Authentification impossible');
  }

  return data;
};

export const authService = {
  async me(): Promise<AuthUser | null> {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      credentials: 'include',
    });

    const data = await parseJson(response);
    if (!response.ok || !data.authenticated || !data.user) {
      return null;
    }

    return data.user;
  },

  async login(credentials: AuthCredentials): Promise<AuthUser> {
    const data = await postAuth('/login', credentials);
    return data.user as AuthUser;
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    const data = await postAuth('/register', payload);
    return data.user as AuthUser;
  },

  async loginWithFirebaseIdToken(idToken: string): Promise<AuthUser> {
    const token = idToken.trim();
    if (!token) {
      throw new Error('Token Firebase manquant');
    }

    const data = await postAuth('/firebase/session', { idToken: token });
    return data.user as AuthUser;
  },

  async logout(): Promise<void> {
    await fetch(`${AUTH_API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};
