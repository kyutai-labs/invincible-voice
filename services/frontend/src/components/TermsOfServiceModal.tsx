'use client';

import { FC } from 'react';
import { useTranslations } from '@/i18n';

interface TermsOfServiceModalProps {
  onAccept: () => void;
  onRefuse: () => void;
}

const TermsOfServiceModal: FC<TermsOfServiceModalProps> = ({
  onAccept,
  onRefuse,
}) => {
  const t = useTranslations();

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80'>
      <div className='flex flex-col gap-4 max-w-3xl w-[90%] max-h-[90vh] bg-[#101010] px-6 py-6 rounded-4xl overflow-hidden'>
        <h2 className='text-xl font-bold text-center pt-2'>
          {t('common.termsOfService')}
        </h2>
        <div className='px-4 py-4 text-center text-base leading-relaxed'>
          {t('common.termsOfServiceMessage')}{' '}
          <a
            href='https://kyutai.org/privacy-policy'
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-gray-300'
          >
            {t('common.termsOfService')}
          </a>
        </div>
        <div className='flex gap-4 pt-2'>
          <button
            onClick={onRefuse}
            className='flex-1 shrink-0 p-px font-bold cursor-pointer pointer-events-auto rounded-2xl h-14'
          >
            <span className='h-full w-full flex flex-row bg-[#181818] border border-red text-red items-center justify-center gap-2 rounded-2xl text-sm px-4'>
              {t('common.refuse')}
            </span>
          </button>
          <button
            onClick={onAccept}
            className='flex-1 shrink-0 p-px font-bold cursor-pointer pointer-events-auto green-to-purple-via-blue-gradient rounded-2xl h-14'
          >
            <span className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-4'>
              {t('common.accept')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
