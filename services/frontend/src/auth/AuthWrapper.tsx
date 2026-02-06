'use client';

import Image from 'next/image';
import React, {
  ChangeEvent,
  FC,
  FormEvent,
  PropsWithChildren,
  useCallback,
  useState,
} from 'react';
import Google from './Google';
import { AUTH_STATUSES, useAuthContext } from './authContext';

const AuthWrapper: FC<PropsWithChildren> = ({ children = null }) => {
  const { authStatus, authError, signIn, register, allowPassword } =
    useAuthContext();
  const [displayRegisterScreen, setDisplayRegisterScreen] = useState(false);
  const toggleRegisterScreen = useCallback(() => {
    setDisplayRegisterScreen((prev) => !prev);
  }, []);

  if (authStatus === AUTH_STATUSES.NOT_CHECKED) {
    return (
      <div className='flex flex-col items-center justify-center w-full'>
        <h1 className='mb-4 text-xl'>Loading…</h1>
      </div>
    );
  }

  if (authStatus === AUTH_STATUSES.NOT_LOGGED) {
    return (
      <div className='flex flex-col items-center justify-center w-full'>
        {!displayRegisterScreen && (
          <SignInScreen
            authError={authError}
            allowPassword={allowPassword}
            onSignIn={signIn}
            onSwitchToRegister={toggleRegisterScreen}
          />
        )}
        {displayRegisterScreen && (
          <RegisterScreen
            allowPassword={allowPassword}
            onRegister={register}
            onSwitchToSignIn={toggleRegisterScreen}
          />
        )}
      </div>
    );
  }

  return children;
};

export default AuthWrapper;

interface SignInScreenProps {
  authError: boolean;
  allowPassword: boolean;
  onSignIn: (email: string, password: string) => void;
  onSwitchToRegister: () => void;
}

const SignInScreen: FC<SignInScreenProps> = ({
  authError,
  allowPassword,
  onSignIn,
  onSwitchToRegister,
}) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (formData.email && formData.password) {
        onSignIn(formData.email, formData.password);
      }
    },
    [formData, onSignIn],
  );
  const onChangeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, email: event.target.value }));
    },
    [setFormData],
  );
  const onChangePassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, password: event.target.value }));
    },
    [setFormData],
  );

  return (
    <div className='flex flex-col gap-3 max-w-md w-[90%] my-16'>
      <form
        className='flex flex-col gap-4 w-full bg-[#101010] px-11 py-9 rounded-4xl'
        onSubmit={onSubmit}
      >
        <div className='flex flex-row items-center justify-center shrink-0 gap-2 pb-2 text-xs'>
          <Image
            src='/logo_invincible.png'
            alt='Invincible Logo'
            width={56}
            height={56}
            className='rounded-lg'
          />
          by
          <Image
            src='/logo_kyutai.svg'
            alt='Kyutai Logo'
            width={155}
            height={64}
            className='-ml-8'
          />
        </div>
        <h1 className='text-center text-xl font-bold mb-9'>Connexion</h1>
        {allowPassword && (
          <React.Fragment>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='auth-email-input'
                className='block mb-1 text-sm font-medium'
              >
                Votre email
              </label>
              <input
                id='auth-email-input'
                type='email'
                onChange={onChangeEmail}
                className='w-full px-6 py-3 text-base bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='prenom.nom@exemple.com'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='auth-password-input'
                className='block mb-1 text-sm font-medium'
              >
                Votre mot de passe
              </label>
              <input
                id='auth-password-input'
                type='password'
                onChange={onChangePassword}
                className='w-full px-6 py-3 text-base bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='*********'
              />
            </div>
            <p className='block h-4 italic text-xs'>
              {authError ? 'Email ou mot de passe incorrecte' : ''}
            </p>
            <button
              type='submit'
              className='shrink-0 p-px mt-4 font-bold cursor-pointer pointer-events-auto green-to-purple-via-blue-gradient rounded-2xl h-14'
            >
              <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
                Connexion
              </div>
            </button>
            <p className='font-bold text-sm text-center'>ou</p>
          </React.Fragment>
        )}
        <Google />
      </form>
      <div className='flex flex-col gap-2 w-full bg-[#101010] px-11 py-9 rounded-4xl font-bold'>
        <p className='mb-4 font-bold text-sm text-center'>
          Vous n’avez pas encore de compte ?
        </p>
        <button
          onClick={onSwitchToRegister}
          className='shrink-0 p-px cursor-pointer pointer-events-auto rounded-2xl h-14'
        >
          <span className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
            Créer un compte
          </span>
        </button>
      </div>
    </div>
  );
};

interface RegisterScreenProps {
  allowPassword: boolean;
  onRegister: (email: string, password: string) => void;
  onSwitchToSignIn: () => void;
}

const RegisterScreen: FC<RegisterScreenProps> = ({
  allowPassword,
  onRegister,
  onSwitchToSignIn,
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (
        formData.email &&
        formData.password &&
        formData.confirmPassword === formData.password
      ) {
        onRegister(formData.email, formData.password);
      }
    },
    [formData, onRegister],
  );
  const onChangeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, email: event.target.value }));
    },
    [setFormData],
  );
  const onChangePassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, password: event.target.value }));
      if (formData.confirmPassword !== event.target.value) {
        setError('Les mots de passe ne correspondent pas.');
      } else {
        setError('');
      }
    },
    [formData, setFormData, setError],
  );
  const onChangeConfirmPassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }));
      if (formData.password !== event.target.value) {
        setError('Les mots de passe ne correspondent pas.');
      } else {
        setError('');
      }
    },
    [formData, setFormData, setError],
  );

  return (
    <div className='flex flex-col gap-3 max-w-md w-[90%] my-16'>
      <form
        className='flex flex-col gap-4 w-full bg-[#101010] px-11 py-9 rounded-4xl'
        onSubmit={onSubmit}
      >
        <div className='flex flex-row items-center justify-center shrink-0 gap-2 pb-2 text-xs'>
          <Image
            src='/logo_invincible.png'
            alt='Invincible Logo'
            width={56}
            height={56}
            className='rounded-lg'
          />
          by
          <Image
            src='/logo_kyutai.svg'
            alt='Kyutai Logo'
            width={155}
            height={64}
            className='-ml-8'
          />
        </div>
        <h1 className='text-center text-xl font-bold mb-9'>
          Créer votre compte
        </h1>
        {allowPassword && (
          <React.Fragment>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-email-input'
                className='block mb-1 text-sm font-medium'
              >
                Votre email
              </label>
              <input
                id='register-email-input'
                type='email'
                onChange={onChangeEmail}
                className='w-full px-6 py-3 text-base bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='Email'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-password-input'
                className='block mb-1 text-sm font-medium'
              >
                Créez votre mot de passe
              </label>
              <input
                id='register-password-input'
                type='password'
                onChange={onChangePassword}
                className='w-full px-6 py-3 text-base bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='*********'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-confirm-password-input'
                className='block mb-1 text-sm font-medium'
              >
                Confirmez votre mot de passe
              </label>
              <input
                id='register-confirm-password-input'
                type='password'
                onChange={onChangeConfirmPassword}
                className='w-full px-6 py-3 text-base bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='*********'
              />
              <span className='block h-4 italic text-xs'>{error}</span>
            </div>
            <button
              type='submit'
              className='shrink-0 p-px font-bold cursor-pointer pointer-events-auto green-to-purple-via-blue-gradient rounded-2xl h-14'
            >
              <span className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
                Créer mon compte
              </span>
            </button>
            <p className='font-bold text-sm text-center'>ou</p>
          </React.Fragment>
        )}
        <Google />
      </form>
      <div className='flex flex-col gap-2 w-full bg-[#101010] px-11 py-9 rounded-4xl font-bold'>
        <p className='mb-4 font-bold text-sm text-center'>
          Vous avez déjà un compte ?
        </p>
        <button
          onClick={onSwitchToSignIn}
          className='shrink-0 p-px cursor-pointer pointer-events-auto rounded-2xl h-14'
        >
          <span className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
            Me connecter
          </span>
        </button>
      </div>
    </div>
  );
};
