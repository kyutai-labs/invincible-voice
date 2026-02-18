import Image from 'next/image';
import { useEffect } from 'react';
import { useTranslations } from '@/i18n';
import { useAuthContext } from './authContext';

const Google = () => {
  const { googleSignIn, googleClientId } = useAuthContext();
  const t = useTranslations();
  const clientID = googleClientId;
  const redirect = window.location.origin;
  const response = 'id_token';
  const scope = 'openid profile email';
  const nonce = 'secureRandomString';

  useEffect(() => {
    if (window.location.hash) {
      if (window.location.hash.split('id_token=').length > 1) {
        const googleToken = window.location.hash
          .split('id_token=')[1]
          .split('&')[0];
        googleSignIn(googleToken);
      }
    }
  }, [googleSignIn]);

  return (
    <a
      href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${redirect}&response_type=${response}&scope=${scope}&nonce=${nonce}`}
      className='shrink-0 p-px cursor-pointer pointer-events-auto rounded-2xl h-14'
    >
      <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
        <Image
          src='/google-icon.webp'
          alt='Google Logo'
          width={16}
          height={16}
          className='mr-2'
        />
        {t('common.googleSignIn')}
      </div>
    </a>
  );
};

export default Google;
