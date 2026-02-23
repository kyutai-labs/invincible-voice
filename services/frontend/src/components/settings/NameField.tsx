import { FC, ChangeEvent, useCallback } from 'react';
import { useTranslations } from '@/i18n';

interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const NameField: FC<NameFieldProps> = ({
  value,
  onChange,
  placeholder = '',
}) => {
  const t = useTranslations();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className='flex flex-col gap-2'>
      <label
        htmlFor='settings-name-input'
        className='text-sm font-medium text-white'
      >
        {t('settings.yourName')}
      </label>
      <input
        id='settings-name-input'
        type='text'
        value={value}
        onChange={handleChange}
        className='w-full px-6 py-2 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
        placeholder={placeholder}
      />
    </div>
  );
};

export default NameField;
