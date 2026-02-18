'use client';

import { FC, PropsWithChildren } from 'react';
import AuthProvider from '@/auth/authContext';
import { I18nProvider } from '@/i18n';

const ContextProvider: FC<PropsWithChildren> = ({ children = null }) => {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
};

export default ContextProvider;
