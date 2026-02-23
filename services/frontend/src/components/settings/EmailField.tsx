import { FC } from 'react';
import { useTranslations } from '@/i18n';

interface EmailFieldProps {
  email: string;
}

const EmailField: FC<EmailFieldProps> = ({ email }) => {
  const t = useTranslations();

  return (
    <div className='flex flex-col gap-2'>
      <label className='text-sm font-medium text-white'>
        {t('common.yourEmail')}
      </label>
      <input
        type='email'
        value={email}
        disabled
        className='w-full px-6 py-2 text-base text-gray-400 bg-[#1B1B1B] border border-gray-600 rounded-2xl cursor-not-allowed'
      />
    </div>
  );
};

export default EmailField;
