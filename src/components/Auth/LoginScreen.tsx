import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface LoginScreenProps {
  loading: boolean;
  authError: string | null;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { name?: string; email: string; password: string }) => Promise<void>;
  onGoogleLogin?: () => Promise<void>;
  onBackToPublic?: () => void;
}

const LoginScreen = ({
  loading,
  authError,
  onLogin,
  onRegister,
  onGoogleLogin,
  onBackToPublic,
}: LoginScreenProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false;
    }
    if (mode === 'register' && password.trim().length < 8) {
      return false;
    }
    return true;
  }, [email, password, mode]);

  const handleSubmit = async () => {
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Email et mot de passe requis');
      return;
    }

    if (mode === 'register') {
      if (password.trim().length < 8) {
        setLocalError('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }
      await onRegister({
        name: name.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
      });
      return;
    }

    await onLogin({
      email: email.trim(),
      password: password.trim(),
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={700}>
              {mode === 'login' ? 'Connexion Studio' : 'Créer un compte'}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {mode === 'login'
                ? 'Connecte-toi pour accéder à l’authoring interactif.'
                : 'Crée ton compte pour publier des scénarios interactifs.'}
            </Typography>

            {mode === 'login' && onGoogleLogin && (
              <>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    void onGoogleLogin();
                  }}
                  disabled={loading}
                >
                  Continuer avec Google
                </Button>
                <Divider>ou</Divider>
              </>
            )}

            {mode === 'register' && (
              <TextField
                label="Nom"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading}
                autoComplete="name"
              />
            )}

            <TextField
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              autoComplete="email"
              type="email"
            />

            <TextField
              label="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              type="password"
              helperText={mode === 'register' ? '8 caractères minimum' : undefined}
            />

            {(localError || authError) && (
              <Alert severity="error">{localError || authError}</Alert>
            )}

            <Button
              variant="contained"
              size="large"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!canSubmit || loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {loading
                ? 'Patiente...'
                : mode === 'login'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
            </Button>

            <Button
              variant="text"
              onClick={() => {
                setMode((currentMode) =>
                  currentMode === 'login' ? 'register' : 'login'
                );
                setLocalError(null);
              }}
              disabled={loading}
            >
              {mode === 'login'
                ? 'Pas encore de compte ? Créer un compte'
                : 'Déjà un compte ? Se connecter'}
            </Button>

            {onBackToPublic && (
              <Button
                variant="text"
                color="inherit"
                onClick={onBackToPublic}
                disabled={loading}
              >
                Retour à l’exploration publique
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginScreen;
