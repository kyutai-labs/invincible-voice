import { useRouter } from 'next/navigation';
import {
  FC,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Cookies from 'universal-cookie';
import { addAuthHeaders } from './authUtils';

export const AUTH_STATUSES = {
  LOGGED: 'LOGGED',
  NOT_CHECKED: 'NOT_CHECKED',
  NOT_LOGGED: 'NOT_LOGGED',
} as const;

type AuthStatusKeys = keyof typeof AUTH_STATUSES;
export type AuthStatus = (typeof AUTH_STATUSES)[AuthStatusKeys];

interface AuthContextInterface {
  authStatus: AuthStatus;
  authError: boolean;
  allowPassword: boolean;
  googleClientId: string;
  register: (email: string, password: string) => void;
  signIn: (email: string, password: string) => void;
  googleSignIn: (googleToken: string) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextInterface>({
  authStatus: AUTH_STATUSES.NOT_CHECKED,
  authError: false,
  allowPassword: true,
  googleClientId: '',
  register: () => {},
  signIn: () => {},
  googleSignIn: () => {},
  signOut: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

const AuthProvider: FC<PropsWithChildren> = ({ children = null }) => {
  const [authError, setAuthError] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    AUTH_STATUSES.NOT_CHECKED,
  );
  const [allowPassword, setAllowPassword] = useState<boolean>(true);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const router = useRouter();
  const signOut = useCallback(() => {
    new Cookies().remove('bearerToken');
    setAuthStatus(AUTH_STATUSES.NOT_LOGGED);
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setAuthError(false);
      const body = new FormData();
      body.append('username', email);
      body.append('password', password);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body,
      });
      if (response.ok) {
        const data = await response.json();
        new Cookies().set('bearerToken', data.access_token, { path: '/' });
        setAuthStatus(AUTH_STATUSES.LOGGED);
      } else {
        setAuthError(true);
      }
    } catch {
      setAuthError(true);
    }
  }, []);
  const googleSignIn = useCallback(
    async (googleToken: string) => {
      try {
        setAuthError(false);
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: googleToken }),
        });
        if (response.ok) {
          const data = await response.json();
          new Cookies().set('bearerToken', data.access_token, { path: '/' });
          setAuthStatus(AUTH_STATUSES.LOGGED);
        } else {
          setAuthError(true);
        }
      } catch {
        setAuthError(true);
      } finally {
        router.replace('/');
      }
    },
    [router],
  );
  const register = useCallback(async (email: string, password: string) => {
    try {
      const body = new FormData();
      body.append('username', email);
      body.append('password', password);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        body,
      });
      if (response.ok) {
        const data = await response.json();
        new Cookies().set('bearerToken', data.access_token, { path: '/' });
        setAuthStatus(AUTH_STATUSES.LOGGED);
      }
    } catch {}
  }, []);

  const memoizedValue = useMemo(
    () => ({
      authStatus,
      authError,
      allowPassword,
      googleClientId,
      register,
      signIn,
      googleSignIn,
      signOut,
    }),
    [
      authStatus,
      authError,
      allowPassword,
      googleClientId,
      register,
      signIn,
      googleSignIn,
      signOut,
    ],
  );

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const bearerToken = new Cookies().get('bearerToken');

        if (bearerToken) {
          const response = await fetch(`/api/v1/user/`, {
            method: 'GET',
            headers: addAuthHeaders({
              Authorization: `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            }),
          });
          if (!response.ok) {
            throw new Error('Unauthorized');
          }
          setAuthStatus(AUTH_STATUSES.LOGGED);
        } else {
          setAuthStatus(AUTH_STATUSES.NOT_LOGGED);
        }
      } catch {
        new Cookies().remove('bearerToken');
        setAuthStatus(AUTH_STATUSES.NOT_LOGGED);
      }
    }

    checkAuthStatus();
  }, []);

  useEffect(() => {
    async function checkAllowPassword() {
      try {
        const response = await fetch('/api/auth/allow-password');
        if (response.ok) {
          const data = await response.json();
          setAllowPassword(data.allow_password);
        }
      } catch {
        setAllowPassword(true);
      }
    }

    checkAllowPassword();
  }, []);

  useEffect(() => {
    async function fetchGoogleClientId() {
      try {
        const response = await fetch('/api/auth/google-client-id');
        if (response.ok) {
          const data = await response.json();
          setGoogleClientId(data.google_client_id);
        }
      } catch {
        setGoogleClientId('');
      }
    }

    fetchGoogleClientId();
  }, []);

  return (
    <AuthContext.Provider value={memoizedValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
