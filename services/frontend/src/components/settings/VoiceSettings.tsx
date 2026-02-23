import { FC, useState, useCallback, useEffect } from 'react';
import { useTranslations } from '@/i18n';
import { playTTSStream } from '@/utils/ttsUtil';
import { getVoices, deleteVoice } from '@/utils/userData';
import VoiceSelector from './VoiceSelector';
import VoiceUploadForm from './VoiceUploadForm';

interface VoiceSettingsProps {
  currentVoice: string | null;
  onVoiceChange: (voice: string | null) => void;
}

const VoiceSettings: FC<VoiceSettingsProps> = ({
  currentVoice,
  onVoiceChange,
}) => {
  const t = useTranslations();
  const [availableVoices, setAvailableVoices] = useState<Record<
    string,
    string
  > | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showVoiceUpload, setShowVoiceUpload] = useState(false);
  const [voiceUploadFile, setVoiceUploadFile] = useState<File | null>(null);
  const [voiceUploadName, setVoiceUploadName] = useState<string>('');
  const [voiceUploadError, setVoiceUploadError] = useState<string | null>(null);
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingVoice, setIsDeletingVoice] = useState(false);

  // Fetch available voices
  useEffect(() => {
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      const result = await getVoices();
      if (result.data) {
        setAvailableVoices(result.data);
      } else {
        console.error('Failed to fetch voices:', result.error);
      }
      setIsLoadingVoices(false);
    };
    fetchVoices();
  }, []);

  const handleVoiceChange = useCallback(
    (value: string) => {
      onVoiceChange(value === '' ? null : value);
    },
    [onVoiceChange],
  );

  const handleTestVoice = useCallback(async () => {
    if (!currentVoice) return;
    setIsPlayingVoice(true);
    try {
      const testText = t('settings.testVoiceMessage');
      await playTTSStream({
        text: testText,
        messageId: crypto.randomUUID(),
        voiceName: currentVoice,
      });
    } catch (error) {
      console.error('Failed to play test voice:', error);
    } finally {
      setIsPlayingVoice(false);
    }
  }, [currentVoice, t]);

  const handleCreateVoice = useCallback(async () => {
    if (!voiceUploadFile || !voiceUploadName.trim()) {
      setVoiceUploadError(t('settings.voiceUploadError'));
      return;
    }

    setIsCreatingVoice(true);
    setVoiceUploadError(null);

    try {
      const { createVoice } = await import('@/utils/userData');
      const result = await createVoice(voiceUploadFile, voiceUploadName);

      if (result.error) {
        setVoiceUploadError(result.error);
        return;
      }

      if (result.data) {
        setIsLoadingVoices(true);
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 500);
        });
        const voicesResult = await getVoices();
        if (voicesResult.data) {
          setAvailableVoices(voicesResult.data);
          handleVoiceChange(result.data.name);
        }
        setIsLoadingVoices(false);
        setVoiceUploadFile(null);
        setVoiceUploadName('');
        setShowVoiceUpload(false);
      }
    } catch (err) {
      setVoiceUploadError(
        err instanceof Error ? err.message : 'An error occurred',
      );
    } finally {
      setIsCreatingVoice(false);
    }
  }, [voiceUploadFile, voiceUploadName, handleVoiceChange, t]);

  const handleDeleteVoice = useCallback(async () => {
    if (!currentVoice) return;

    setIsDeletingVoice(true);
    try {
      const result = await deleteVoice(currentVoice);

      if (result.error) {
        console.error('Failed to delete voice:', result.error);
        return;
      }

      setIsLoadingVoices(true);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 500);
      });
      const voicesResult = await getVoices();
      if (voicesResult.data) {
        setAvailableVoices(voicesResult.data);
        handleVoiceChange('');
      }
      setIsLoadingVoices(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeletingVoice(false);
    }
  }, [currentVoice, handleVoiceChange]);

  return (
    <div className='flex flex-col gap-2'>
      <label className='text-sm font-medium text-white'>
        {t('common.voice')}
      </label>
      <VoiceSelector
        selectedVoice={currentVoice}
        availableVoices={availableVoices}
        isLoadingVoices={isLoadingVoices}
        isPlayingVoice={isPlayingVoice}
        onVoiceChange={handleVoiceChange}
        onTestVoice={handleTestVoice}
        onDeleteVoice={() => setShowDeleteConfirm(true)}
        showDeleteButton={
          currentVoice !== null &&
          availableVoices !== null &&
          availableVoices[currentVoice] === 'Custom voice'
        }
      />

      {!showVoiceUpload && (
        <button
          type='button'
          onClick={() => setShowVoiceUpload(true)}
          className='mt-2 px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]'
        >
          {t('settings.cloneYourVoice')}
        </button>
      )}

      {showVoiceUpload && (
        <VoiceUploadForm
          voiceName={voiceUploadName}
          onVoiceNameChange={setVoiceUploadName}
          onFileChange={(file) => {
            setVoiceUploadFile(file);
            setVoiceUploadError(null);
          }}
          onCreateVoice={handleCreateVoice}
          onCancel={() => {
            setShowVoiceUpload(false);
            setVoiceUploadFile(null);
            setVoiceUploadName('');
            setVoiceUploadError(null);
          }}
          isCreating={isCreatingVoice}
          error={voiceUploadError}
        />
      )}

      {showDeleteConfirm && (
        <div className='mt-4 p-4 bg-[#181818] border border-red-500 rounded-2xl'>
          <p className='text-white mb-4'>{t('settings.deleteVoiceConfirm')}</p>
          <div className='flex gap-2'>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className='flex-1 px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]'
              disabled={isDeletingVoice}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeleteVoice}
              className='flex-1 px-4 py-2 text-sm text-white bg-[#FF6459] rounded-xl focus:outline-none hover:bg-[#E5554B] disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={isDeletingVoice}
            >
              {isDeletingVoice ? '...' : t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceSettings;
