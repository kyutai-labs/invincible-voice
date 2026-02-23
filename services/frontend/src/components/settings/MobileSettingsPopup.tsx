'use client';

import { FC, useCallback, useState } from 'react';
import { useAuthContext } from '@/auth/authContext';
import { useTranslations } from '@/i18n';
import { updateUserSettings } from '@/utils/userData';
import type { UserSettings } from '@/utils/userData';
import EmailField from './EmailField';
import NameField from './NameField';
import SettingsHeader from './SettingsHeader';

interface MobileSettingsPopupProps {
  userSettings: UserSettings;
  email: string;
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

const MobileSettingsPopup: FC<MobileSettingsPopupProps> = ({
  userSettings,
  email,
  onSave,
  onCancel,
}) => {
  const t = useTranslations();
  const { signOut } = useAuthContext();
  const [name, setName] = useState(userSettings.name || '');

  const handleSave = useCallback(async () => {
    const updatedSettings: UserSettings = {
      ...userSettings,
      name,
    };
    const result = await updateUserSettings(updatedSettings);

    if (!result.error) {
      onSave(updatedSettings);
    }
  }, [name, userSettings, onSave]);

  const handleSignOut = useCallback(() => {
    signOut();
    onCancel();
  }, [signOut, onCancel]);

  return (
    <div className='flex flex-col w-full h-full text-white p-4'>
      <SettingsHeader
        title={t('settings.changeSettings')}
        onCancel={onCancel}
      />

      <div className='flex flex-col gap-4 flex-1'>
        <EmailField email={email} />
        <NameField
          value={name}
          onChange={setName}
          placeholder={t('settings.yourNamePlaceholder')}
        />
        <p className='text-xs text-gray-500 text-center mt-1'>
          {t('settings.moreSettingsAvailable')}
        </p>
      </div>

      <div className='flex flex-col gap-3 mt-6'>
        <div className='w-full flex justify-center'>
          <a
            href='https://kyutai.org/privacy-policy'
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm underline text-gray-400 hover:text-white transition-colors'
          >
            {t('common.termsOfService')}
          </a>
        </div>
        <button
          className='w-full px-6 py-3 text-[#FF6459] bg-[#1B1B1B] border border-[#FF6459] rounded-2xl font-medium'
          onClick={handleSignOut}
        >
          {t('settings.signOut')}
        </button>
        <button
          className='w-full px-6 py-3 text-black bg-[#39F2AE] rounded-2xl font-medium'
          onClick={handleSave}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
};

export default MobileSettingsPopup;
