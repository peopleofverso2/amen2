import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { theme } from './theme';
import { ProjectService } from './services/projectService';
import LoginScreen from './components/Auth/LoginScreen';
import { AuthUser, authService } from './services/auth/authService';
import {
  isFirebaseGoogleLoginEnabled,
  loginWithGooglePopup,
} from './services/auth/firebaseAuthClient';

const ScenarioEditor = lazy(() => import('./components/Editor/ScenarioEditor'));
const ProjectLibrary = lazy(() => import('./components/ProjectLibrary/ProjectLibrary'));

type AppView = 'public' | 'studio';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('public');
  const [watchProjectId, setWatchProjectId] = useState<string | null>(null);
  const [pendingStudioProjectId, setPendingStudioProjectId] = useState<string | null>(null);
  const [isTopDockCompact, setIsTopDockCompact] = useState(false);
  const projectService = ProjectService.getInstance();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setWatchProjectId(params.get('watch'));
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      setIsAuthLoading(true);
      try {
        const currentUser = await authService.me();
        setAuthUser(currentUser);
      } catch (error) {
        console.error('Error checking auth session:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (view !== 'studio' || !authUser || !pendingStudioProjectId) {
      return;
    }

    setSelectedProjectId(pendingStudioProjectId);
    setPendingStudioProjectId(null);
  }, [view, authUser, pendingStudioProjectId]);

  const handleLogin = async (input: { email: string; password: string }) => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      const user = await authService.login(input);
      setAuthUser(user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleRegister = async (input: {
    name?: string;
    email: string;
    password: string;
  }) => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      const user = await authService.register(input);
      setAuthUser(user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Inscription impossible');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      const firebaseIdToken = await loginWithGooglePopup();
      const user = await authService.loginWithFirebaseIdToken(firebaseIdToken);
      setAuthUser(user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion Google impossible');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      await authService.logout();
      setSelectedProjectId(null);
      setAuthUser(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Déconnexion impossible');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleProjectSelect = async (projectId: string) => {
    try {
      await projectService.loadProject(projectId);
      setSelectedProjectId(projectId);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const handleBackToLibrary = () => {
    setSelectedProjectId(null);
  };

  const openStudioView = () => {
    setView('studio');
  };

  const openPublicView = () => {
    setSelectedProjectId(null);
    setPendingStudioProjectId(null);
    setView('public');
  };

  const openStudioStats = () => {
    setSelectedProjectId(null);
    setView('studio');
  };

  const dockTransition = '220ms cubic-bezier(0.22, 1, 0.36, 1)';
  const showTopDock = !selectedProjectId;
  const contentTopPadding = showTopDock
    ? authUser
      ? isTopDockCompact
        ? { xs: '96px', sm: '76px', md: '70px' }
        : { xs: '124px', sm: '92px', md: '84px' }
      : isTopDockCompact
        ? { xs: '64px', sm: '62px', md: '60px' }
        : { xs: '76px', sm: '76px', md: '72px' }
    : 0;

  useEffect(() => {
    if (typeof window === 'undefined' || !showTopDock) {
      setIsTopDockCompact(false);
      return;
    }

    let rafId = 0;
    const threshold = 40;
    const syncDockState = () => {
      setIsTopDockCompact(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncDockState();
      });
    };

    syncDockState();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [showTopDock]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {showTopDock && (
        <Box
          sx={{
            position: 'fixed',
            top: isTopDockCompact ? 8 : 12,
            left: 12,
            right: 12,
            zIndex: 2100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: isTopDockCompact ? 0.75 : 1,
            flexWrap: 'wrap',
            pointerEvents: 'none',
            transform: `translateY(${isTopDockCompact ? '-1px' : '0'})`,
            transition: `top ${dockTransition}, transform ${dockTransition}`,
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(16,16,16,0.86)',
              border: isTopDockCompact
                ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              p: isTopDockCompact ? 0.35 : 0.5,
              backdropFilter: isTopDockCompact ? 'blur(9px)' : 'blur(6px)',
              boxShadow: isTopDockCompact
                ? '0 10px 24px rgba(0,0,0,0.34)'
                : '0 6px 18px rgba(0,0,0,0.22)',
              transform: `scale(${isTopDockCompact ? 0.985 : 1})`,
              pointerEvents: 'auto',
              transformOrigin: 'top left',
              transition: `padding ${dockTransition}, border-color ${dockTransition}, box-shadow ${dockTransition}, transform ${dockTransition}, backdrop-filter ${dockTransition}`,
            }}
          >
            <Stack direction="row" spacing={isTopDockCompact ? 0.5 : 1}>
              <Button
                size="small"
                variant={view === 'public' ? 'contained' : 'text'}
                onClick={openPublicView}
                sx={{
                  minWidth: 0,
                  px: isTopDockCompact ? 1.1 : 1.4,
                  py: isTopDockCompact ? 0.35 : 0.45,
                  transition: `padding ${dockTransition}, transform ${dockTransition}, background-color ${dockTransition}`,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Public
              </Button>
              <Button
                size="small"
                variant={view === 'studio' ? 'contained' : 'text'}
                onClick={openStudioView}
                sx={{
                  minWidth: 0,
                  px: isTopDockCompact ? 1.1 : 1.4,
                  py: isTopDockCompact ? 0.35 : 0.45,
                  transition: `padding ${dockTransition}, transform ${dockTransition}, background-color ${dockTransition}`,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Studio
              </Button>
            </Stack>
          </Box>

          {authUser && (
            <Box
              sx={{
                bgcolor: 'rgba(16,16,16,0.86)',
                border: isTopDockCompact
                  ? '1px solid rgba(255,255,255,0.18)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                px: isTopDockCompact ? 0.9 : 1.25,
                py: isTopDockCompact ? 0.65 : 1,
                backdropFilter: isTopDockCompact ? 'blur(9px)' : 'blur(6px)',
                boxShadow: isTopDockCompact
                  ? '0 10px 24px rgba(0,0,0,0.32)'
                  : '0 6px 16px rgba(0,0,0,0.2)',
                transform: `scale(${isTopDockCompact ? 0.985 : 1})`,
                pointerEvents: 'auto',
                ml: { xs: 0, sm: 'auto' },
                maxWidth: '100%',
                transformOrigin: 'top right',
                transition: `padding ${dockTransition}, border-color ${dockTransition}, box-shadow ${dockTransition}, transform ${dockTransition}, backdrop-filter ${dockTransition}`,
              }}
            >
              <Stack
                direction={isTopDockCompact ? 'row' : { xs: 'column', sm: 'row' }}
                spacing={isTopDockCompact ? 0.75 : 1}
                alignItems={isTopDockCompact ? 'center' : { xs: 'stretch', sm: 'center' }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    maxWidth: isTopDockCompact
                      ? { xs: 120, sm: 140, md: 180 }
                      : { xs: 220, sm: 200, md: 260 },
                    display: isTopDockCompact ? { xs: 'none', sm: 'block' } : 'block',
                  }}
                  noWrap
                >
                  {authUser.name || authUser.email}
                </Typography>
                <Stack direction="row" spacing={isTopDockCompact ? 0.5 : 1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={openStudioStats}
                    sx={{
                      minWidth: 0,
                      px: isTopDockCompact ? 1 : 1.2,
                      py: isTopDockCompact ? 0.3 : 0.45,
                      transition: `padding ${dockTransition}, transform ${dockTransition}`,
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Stats
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      void handleLogout();
                    }}
                    disabled={isAuthActionLoading}
                    sx={{
                      minWidth: 0,
                      px: isTopDockCompact ? 1 : 1.2,
                      py: isTopDockCompact ? 0.3 : 0.45,
                      transition: `padding ${dockTransition}, transform ${dockTransition}`,
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Logout
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ pt: contentTopPadding }}>
        {view === 'public' ? (
          <Suspense
            fallback={
              <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            }
          >
            <ProjectLibrary
              onProjectSelect={(projectId) => {
                setPendingStudioProjectId(projectId);
                if (authUser) {
                  setSelectedProjectId(projectId);
                }
                setView('studio');
              }}
              mode="public"
              autoOpenProjectId={watchProjectId}
              canAccessAnalytics={Boolean(authUser)}
            />
          </Suspense>
        ) : isAuthLoading && !authUser ? (
          <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : !authUser ? (
          <LoginScreen
            loading={isAuthActionLoading}
            authError={authError}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGoogleLogin={isFirebaseGoogleLoginEnabled ? handleGoogleLogin : undefined}
            onBackToPublic={openPublicView}
          />
        ) : (
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Suspense
              fallback={
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={32} />
                </Box>
              }
            >
              {selectedProjectId ? (
                <ScenarioEditor
                  projectId={selectedProjectId}
                  onBackToLibrary={handleBackToLibrary}
                />
              ) : (
                <ProjectLibrary
                  onProjectSelect={handleProjectSelect}
                  mode="authoring"
                  canAccessAnalytics
                />
              )}
            </Suspense>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
