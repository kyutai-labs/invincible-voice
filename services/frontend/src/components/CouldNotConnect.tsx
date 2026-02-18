import { FC, useMemo } from 'react';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';

export type HealthStatus = {
  connected: 'no' | 'yes_request_ok' | 'yes_request_fail';
  ok: boolean;
  tts_up?: boolean;
  stt_up?: boolean;
  llm_up?: boolean;
};

interface RenderServiceStatusProps {
  name: string;
  status: string | boolean | undefined;
  t: (key: string) => string;
}

const RenderServiceStatus: FC<RenderServiceStatusProps> = ({
  name,
  status,
  t,
}) => {
  const displayedStatus = useMemo(() => {
    if (status === undefined) {
      return t('common.unknown');
    }
    if (status === true) {
      return t('common.up');
    }
    if (status === false) {
      return t('common.down');
    }
    return status;
  }, [status, t]);

  return (
    <p>
      {name}:{' '}
      <span
        className={cn({
          'text-white': displayedStatus === t('common.up'),
          'text-red': displayedStatus !== t('common.up'),
        })}
      >
        {displayedStatus}
      </span>
    </p>
  );
};

interface CouldNotConnectProps {
  healthStatus: HealthStatus;
}

const CouldNotConnect: FC<CouldNotConnectProps> = ({ healthStatus }) => {
  const t = useTranslations();

  if (healthStatus.ok) {
    return null;
  }

  const humanReadableStatus = {
    no: t('common.down'),
    yes_request_ok: t('common.up'),
    yes_request_fail: t('connection.upButWithErrors'),
  };

  return (
    <div className='w-full h-full flex flex-col gap-12 items-center justify-center bg-background'>
      <div className='text-center text-xl'>
        <h1 className='text-3xl mb-4'>{t('connection.couldNotConnect')}</h1>
        <p>{t('connection.serviceStatus')}</p>
        <RenderServiceStatus
          name={t('connection.backend')}
          status={humanReadableStatus[healthStatus.connected]}
          t={t}
        />
        <RenderServiceStatus
          name={t('connection.stt')}
          status={healthStatus.stt_up}
          t={t}
        />
        <RenderServiceStatus
          name={t('connection.llm')}
          status={healthStatus.llm_up}
          t={t}
        />
        <RenderServiceStatus
          name={t('connection.tts')}
          status={healthStatus.tts_up}
          t={t}
        />
      </div>
    </div>
  );
};

export default CouldNotConnect;
