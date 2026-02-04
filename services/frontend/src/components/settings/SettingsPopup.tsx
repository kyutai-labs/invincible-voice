/* eslint-disable react/no-array-index-key */
import { CheckIcon, LoaderCircleIcon, Play, X } from 'lucide-react';
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  FC,
  KeyboardEvent,
  ChangeEvent,
} from 'react';
import { useAuthContext } from '@/auth/authContext';
import Edit from '@/components/icons/Edit';
import Plus from '@/components/icons/Plus';
import Trash from '@/components/icons/Trash';
import { estimateTokens, formatTokenCount } from '@/utils/tokenUtils';
import { playTTSStream } from '@/utils/ttsUtil';
import {
  UserSettings,
  updateUserSettings,
  Document,
  getVoices,
  createVoice,
} from '@/utils/userData';
import DocumentEditorPopup from './DocumentEditorPopup';

interface SettingsPopupProps {
  userSettings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

const SettingsPopup: FC<SettingsPopupProps> = ({
  userSettings,
  onSave,
  onCancel,
}) => {
  const { signOut } = useAuthContext();
  const [formData, setFormData] = useState<UserSettings>(userSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState<string>('');
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');
  const [isDocumentEditorOpen, setIsDocumentEditorOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editingDocumentIndex, setEditingDocumentIndex] = useState<
    number | null
  >(null);
  const [availableVoices, setAvailableVoices] = useState<Record<
    string,
    string
  > | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);
  const [showVoiceUpload, setShowVoiceUpload] = useState(false);
  const [voiceUploadFile, setVoiceUploadFile] = useState<File | null>(null);
  const [voiceUploadName, setVoiceUploadName] = useState<string>('');
  const [voiceUploadError, setVoiceUploadError] = useState<string | null>(null);
  const promptTokenCount = useMemo(
    () => estimateTokens(formData.prompt),
    [formData.prompt],
  );

  const handleInputChange = useCallback(
    (
      field: keyof UserSettings,
      value: string | string[] | Document[] | boolean,
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );
  const handleAddFriend = useCallback(() => {
    if (
      newFriendInput.trim() &&
      !formData.friends.includes(newFriendInput.trim())
    ) {
      handleInputChange('friends', [
        ...formData.friends,
        newFriendInput.trim(),
      ]);
      setNewFriendInput('');
    }
  }, [formData.friends, handleInputChange, newFriendInput]);
  const handleRemoveFriend = useCallback(
    (friendToRemove: string) => {
      handleInputChange(
        'friends',
        formData.friends.filter((friend) => friend !== friendToRemove),
      );
    },
    [formData.friends, handleInputChange],
  );
  const handleFriendInputKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddFriend();
      }
    },
    [handleAddFriend],
  );
  const handleAddKeyword = useCallback(() => {
    if (
      newKeywordInput.trim() &&
      !formData.additional_keywords.includes(newKeywordInput.trim())
    ) {
      handleInputChange('additional_keywords', [
        ...formData.additional_keywords,
        newKeywordInput.trim(),
      ]);
      setNewKeywordInput('');
    }
  }, [formData.additional_keywords, handleInputChange, newKeywordInput]);
  const handleRemoveKeyword = useCallback(
    (keywordToRemove: string) => {
      handleInputChange(
        'additional_keywords',
        formData.additional_keywords.filter(
          (keyword) => keyword !== keywordToRemove,
        ),
      );
    },
    [formData.additional_keywords, handleInputChange],
  );
  const handleKeywordInputKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddKeyword();
      }
    },
    [handleAddKeyword],
  );
  const handleAddDocument = useCallback(() => {
    setEditingDocument(null);
    setEditingDocumentIndex(null);
    setIsDocumentEditorOpen(true);
  }, []);
  const handleEditDocument = useCallback(
    (index: number) => {
      const doc = formData.documents?.[index];
      if (doc) {
        setEditingDocument(doc);
        setEditingDocumentIndex(index);
        setIsDocumentEditorOpen(true);
      }
    },
    [formData.documents],
  );
  const handleRemoveDocument = useCallback(
    (index: number) => {
      const newDocuments = [...(formData.documents || [])];
      newDocuments.splice(index, 1);
      handleInputChange('documents', newDocuments);
    },
    [formData.documents, handleInputChange],
  );
  const handleSaveDocument = useCallback(
    (document: Document) => {
      const newDocuments = [...(formData.documents || [])];
      if (editingDocumentIndex !== null) {
        newDocuments[editingDocumentIndex] = document;
      } else {
        newDocuments.push(document);
      }
      handleInputChange('documents', newDocuments);
      setIsDocumentEditorOpen(false);
      setEditingDocument(null);
      setEditingDocumentIndex(null);
    },
    [editingDocumentIndex, formData.documents, handleInputChange],
  );
  const handleCancelDocument = useCallback(() => {
    setIsDocumentEditorOpen(false);
    setEditingDocument(null);
    setEditingDocumentIndex(null);
  }, []);

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

  // Handle voice selection
  const handleVoiceChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      handleInputChange('voice', event.target.value);
    },
    [handleInputChange],
  );

  // Handle test voice button click
  const handleTestVoice = useCallback(async () => {
    if (!formData.voice) return;
    setIsPlayingVoice(true);
    try {
      const testText =
        'Bonjour, votre voix ressemblera à cela. Vous pouvez aussi cloner votre propre voix en fournissant un enregistrement audio de vous.';
      await playTTSStream({
        text: testText,
        messageId: crypto.randomUUID(),
        voiceName: formData.voice,
      });
    } catch (error) {
      console.error('Failed to play test voice:', error);
    } finally {
      setIsPlayingVoice(false);
    }
  }, [formData.voice]);

  // Handle voice creation
  const handleCreateVoice = useCallback(async () => {
    if (!voiceUploadFile || !voiceUploadName.trim()) {
      setVoiceUploadError(
        'Veuillez fournir un fichier audio et un nom pour la voix',
      );
      return;
    }

    setIsCreatingVoice(true);
    setVoiceUploadError(null);

    try {
      const result = await createVoice(voiceUploadFile, voiceUploadName);

      if (result.error) {
        setVoiceUploadError(result.error);
        return;
      }

      if (result.data) {
        // Refresh the voices list with a small delay to allow the API to process the new voice
        setIsLoadingVoices(true);
        // Wait a bit for the API to index the new voice
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 500);
        });
        const voicesResult = await getVoices();
        if (voicesResult.data) {
          setAvailableVoices(voicesResult.data);
          // Select the newly created voice
          handleInputChange('voice', result.data.name);
        } else {
          console.error('Failed to fetch voices:', voicesResult.error);
        }
        setIsLoadingVoices(false);

        // Reset the upload form
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
  }, [voiceUploadFile, voiceUploadName, handleInputChange]);

  // Handle voice file selection
  const handleVoiceFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith('.wav')) {
          setVoiceUploadError('Veuillez fournir un fichier WAV');
          return;
        }
        setVoiceUploadFile(file);
        setVoiceUploadError(null);
      }
    },
    [],
  );
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await updateUserSettings(formData);

      if (result.error) {
        // Handle error silently for now
        console.error(result.error);
      } else {
        onSave(formData);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [formData, onSave]);
  const onChangeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleInputChange('name', event.target.value);
    },
    [handleInputChange],
  );
  const onChangeThinkingMode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleInputChange('thinking_mode', event.target.checked);
    },
    [handleInputChange],
  );
  const onChangePrompt = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange('prompt', event.target.value);
    },
    [handleInputChange],
  );
  const onChangeNewKeywordInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setNewKeywordInput(event.target.value);
    },
    [],
  );
  const onChangeNewFriendInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setNewFriendInput(event.target.value);
    },
    [],
  );

  useEffect(() => {
    setFormData({
      ...userSettings,
      documents: userSettings.documents || [],
    });
  }, [userSettings]);

  return (
    <div className='flex flex-col w-full h-full gap-y-2'>
      <div className='flex flex-row justify-between w-full'>
        <h2 className='text-base font-medium text-white'>Paramètres</h2>
        <div className='flex flex-row items-center gap-2 -mr-5 -mt-2'>
          <button
            className='text-[#FF6459] underline text-xs'
            onClick={signOut}
          >
            Se déconnecter
          </button>
          <button
            className='size-10 cursor-pointer flex items-center justify-center rounded-2xl bg-[#101010]'
            onClick={onCancel}
          >
            <X
              size={24}
              className='text-white'
            />
          </button>
        </div>
      </div>
      <div className='grid grow w-full grid-cols-2 gap-8'>
        <div className='flex flex-col h-full gap-6 pb-4'>
          <div className='flex flex-row gap-8'>
            <div className='flex flex-col grow gap-2'>
              <label
                htmlFor='settings-name-input'
                className='text-sm font-medium text-white'
              >
                Votre nom
              </label>
              <input
                id='settings-name-input'
                type='text'
                value={formData.name}
                onChange={onChangeName}
                className='w-full px-6 py-2 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
                placeholder='Le nom avec lequel vous souhaitez communiquer'
              />
            </div>
            <div className='flex items-center gap-2 pt-6'>
              <label
                htmlFor='settings-thinking-mode-input'
                className='text-sm font-medium text-white'
              >
                Thinking Mode:
              </label>
              <input
                id='settings-thinking-mode-input'
                type='checkbox'
                checked={formData.thinking_mode}
                onChange={onChangeThinkingMode}
                className='w-4 h-4 text-green-600 bg-[#1B1B1B] rounded focus:ring-green-500 focus:ring-2'
              />
            </div>
          </div>
          <div className='flex flex-col gap-2'>
            <label
              htmlFor='settings-voice-select'
              className='text-sm font-medium text-white'
            >
              Voix
            </label>
            <div className='flex gap-2'>
              <select
                id='settings-voice-select'
                value={formData.voice || ''}
                onChange={handleVoiceChange}
                disabled={isLoadingVoices}
                className='flex-1 px-6 py-2 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green disabled:opacity-50'
              >
                <option value=''>Par défaut</option>
                {availableVoices &&
                  Object.entries(availableVoices)
                    .sort(([, langA], [, langB]) => langA.localeCompare(langB))
                    .map(([voiceName, language]) => (
                      <option
                        key={voiceName}
                        value={voiceName}
                      >
                        {voiceName} ({language})
                      </option>
                    ))}
              </select>
              <button
                type='button'
                onClick={handleTestVoice}
                disabled={!formData.voice || isPlayingVoice}
                className='px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green hover:bg-[#2B2B2B] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap'
              >
                {isPlayingVoice ? (
                  <LoaderCircleIcon
                    size={16}
                    className='animate-spin'
                  />
                ) : (
                  <Play size={16} />
                )}
                Tester votre voix
              </button>
            </div>
            {!showVoiceUpload && (
              <button
                type='button'
                onClick={() => setShowVoiceUpload(true)}
                className='mt-2 px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]'
              >
                Cloner votre propre voix
              </button>
            )}
            {showVoiceUpload && (
              <div className='mt-2 px-4 py-3 bg-[#181818] border border-white rounded-2xl'>
                <div className='flex flex-col gap-3'>
                  <div className='flex flex-col gap-1'>
                    <label
                      htmlFor='voice-upload-name-input'
                      className='text-xs font-medium text-gray-300'
                    >
                      Nom de la voix
                    </label>
                    <input
                      id='voice-upload-name-input'
                      type='text'
                      value={voiceUploadName}
                      onChange={(e) => setVoiceUploadName(e.target.value)}
                      className='w-full px-3 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green'
                      placeholder='Ma voix'
                    />
                  </div>
                  <div className='flex flex-col gap-1'>
                    <label
                      htmlFor='voice-upload-file-input'
                      className='text-xs font-medium text-gray-300'
                    >
                      Fichier audio (WAV)
                    </label>
                    <input
                      id='voice-upload-file-input'
                      type='file'
                      accept='.wav'
                      onChange={handleVoiceFileChange}
                      className='w-full px-3 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-[#39F2AE] file:text-black file:text-sm file:cursor-pointer'
                    />
                  </div>
                  {voiceUploadError && (
                    <p className='text-xs text-red-400'>{voiceUploadError}</p>
                  )}
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={() => {
                        setShowVoiceUpload(false);
                        setVoiceUploadFile(null);
                        setVoiceUploadName('');
                        setVoiceUploadError(null);
                      }}
                      className='flex-1 px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]'
                    >
                      Annuler
                    </button>
                    <button
                      type='button'
                      onClick={handleCreateVoice}
                      disabled={
                        isCreatingVoice ||
                        !voiceUploadFile ||
                        !voiceUploadName.trim()
                      }
                      className='flex-1 px-4 py-2 text-sm text-white bg-[#39F2AE] rounded-xl focus:outline-none hover:bg-[#2EDB9B] disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {isCreatingVoice ? (
                        <LoaderCircleIcon
                          size={16}
                          className='animate-spin mx-auto'
                        />
                      ) : (
                        'Créer la voix'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className='flex flex-col flex-1 gap-2'>
            <div className='flex items-center justify-between mb-1'>
              <div className='text-sm font-medium text-white'>
                Configurez votre assistant conversationnel
              </div>
              <span className='text-sm text-gray-400'>
                {formatTokenCount(promptTokenCount)}
              </span>
            </div>
            <textarea
              value={formData.prompt}
              onChange={onChangePrompt}
              className='flex-1 w-full min-h-0 px-6 py-4 text-base text-white bg-[#1B1B1B] border border-white rounded-3xl resize-none focus:outline-none focus:border-green scrollbar-hidden scrollable'
              placeholder='Enter your prompt'
            />
          </div>
        </div>
        <div className='flex flex-col h-full gap-2'>
          <div className='flex flex-col grow h-full gap-2'>
            <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
              <div className='block mb-1 text-sm font-medium text-white'>
                Mots-clés supplémentaires
              </div>
              <div className='flex flex-col w-full gap-0.5'>
                <div className='flex flex-wrap gap-1.5 min-h-6 max-h-28 overflow-y-auto overflow-x-hidden py-2'>
                  {formData.additional_keywords.map((keyword) => (
                    <AdditionalKeyword
                      key={keyword}
                      keyword={keyword}
                      removeKeyword={handleRemoveKeyword}
                    />
                  ))}
                  {formData.additional_keywords.length === 0 && (
                    <p className='text-sm italic text-gray-500'>
                      Pas de mots-clés ajoutés
                    </p>
                  )}
                </div>
                <div className='relative flex gap-2'>
                  <input
                    type='text'
                    value={newKeywordInput}
                    onChange={onChangeNewKeywordInput}
                    onKeyDown={handleKeywordInputKeyPress}
                    className='flex-1 px-4 py-1 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green h-10'
                    placeholder='Ajoutez votre mot-clé'
                  />
                  <button
                    onClick={handleAddKeyword}
                    className='absolute shrink-0 h-8 p-px right-1 inset-y-1 w-fit green-to-purple-via-blue-gradient rounded-xl'
                    style={{
                      filter:
                        'drop-shadow(0rem 0.2rem 0.15rem var(--darkgray))',
                    }}
                  >
                    <div className='h-full w-full pl-4 pr-3 flex flex-row bg-[#181818] items-center justify-center gap-1 rounded-xl text-sm'>
                      Ajouter
                      <Plus
                        width={24}
                        height={24}
                        className='shrink-0 text-white'
                      />
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
              <div className='block mb-1 text-sm font-medium text-white'>
                Amis
              </div>
              <div className='flex flex-col w-full gap-0.5'>
                <div className='flex flex-wrap gap-1.5 min-h-6 max-h-28 overflow-y-auto overflow-x-hidden py-2'>
                  {formData.friends.map((friend) => (
                    <Friend
                      key={friend}
                      friend={friend}
                      removeFriend={handleRemoveFriend}
                    />
                  ))}
                  {formData.friends.length === 0 && (
                    <p className='text-sm italic text-gray-500'>
                      Aucun ami ajouté pour le moment
                    </p>
                  )}
                </div>
                <div className='relative flex gap-2'>
                  <input
                    type='text'
                    value={newFriendInput}
                    onChange={onChangeNewFriendInput}
                    onKeyDown={handleFriendInputKeyPress}
                    className='flex-1 px-4 py-1 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green h-10'
                    placeholder="Entrez le nom d'un ami"
                  />
                  <button
                    onClick={handleAddFriend}
                    className='absolute shrink-0 h-8 p-px right-1 inset-y-1 w-fit green-to-purple-via-blue-gradient rounded-xl'
                    style={{
                      filter:
                        'drop-shadow(0rem 0.2rem 0.15rem var(--darkgray))',
                    }}
                  >
                    <div className='h-full w-full pl-4 pr-3 flex flex-row bg-[#181818] items-center justify-center gap-1 rounded-xl text-sm'>
                      Ajouter
                      <Plus
                        width={24}
                        height={24}
                        className='shrink-0 text-white'
                      />
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
              <div className='flex flex-row items-center justify-between w-full mb-2'>
                <div className='block mb-1 text-sm font-medium text-white'>
                  Documents
                </div>
                <button
                  onClick={handleAddDocument}
                  className='shrink-0 p-px w-fit green-to-purple-via-blue-gradient rounded-xl h-8 -mt-0.5 mr-1'
                  style={{
                    filter: 'drop-shadow(0rem 0.2rem 0.15rem var(--darkgray))',
                  }}
                >
                  <div className='h-full w-full pl-4 pr-3 flex flex-row bg-[#181818] items-center justify-center gap-1 rounded-xl text-sm'>
                    Ajouter un document
                    <Plus
                      width={24}
                      height={24}
                      className='shrink-0 text-white'
                    />
                  </div>
                </button>
              </div>
              <div className='flex flex-col w-full gap-0.5'>
                <div className='flex flex-col gap-2 py-2 overflow-x-hidden overflow-y-auto max-h-40'>
                  {(formData.documents || []).map((doc, index) => (
                    <DocumentCard
                      key={index}
                      document={doc}
                      editDocument={handleEditDocument}
                      index={index}
                      removeDocument={handleRemoveDocument}
                    />
                  ))}
                  {(!formData.documents || formData.documents.length === 0) && (
                    <p className='text-sm italic text-gray-500'>
                      No documents added yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className='flex justify-end gap-x-3'>
            <button
              className='px-8 text-sm h-14 bg-[#101010] rounded-2xl'
              onClick={onCancel}
            >
              Annuler
            </button>
            <button
              className='p-px h-14 light-green-to-green-gradient rounded-2xl'
              onClick={handleSave}
            >
              <div className='flex flex-row bg-[#181818] size-full items-center justify-center gap-4 px-8 rounded-2xl'>
                Sauvegarder la configuration
                {!isLoading && (
                  <CheckIcon
                    size={24}
                    className='text-[#39F2AE]'
                  />
                )}
                {isLoading && (
                  <LoaderCircleIcon
                    size={24}
                    className='animate-spin text-[#39F2AE]'
                  />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
      <DocumentEditorPopup
        document={editingDocument}
        isOpen={isDocumentEditorOpen}
        onSave={handleSaveDocument}
        onCancel={handleCancelDocument}
      />
    </div>
  );
};

export default SettingsPopup;

interface AdditionalKeywordProps {
  keyword: string;
  removeKeyword: (keyword: string) => void;
}

const AdditionalKeyword: FC<AdditionalKeywordProps> = ({
  keyword,
  removeKeyword,
}) => {
  const onClickRemove = useCallback(() => {
    removeKeyword(keyword);
  }, [keyword, removeKeyword]);

  return (
    <div className='relative group'>
      <button
        className='h-10 p-px transition-colors green-to-light-green-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500'
        type='button'
      >
        <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
          {keyword}
        </div>
      </button>
      <button
        type='button'
        onClick={onClickRemove}
        className='absolute flex items-center justify-center w-4 h-4 text-sm text-white transition-opacity bg-red-500 rounded-full opacity-0 -top-1 -right-1 hover:bg-[#FF6459] group-hover:opacity-100'
        title='Remove keyword'
      >
        ×
      </button>
    </div>
  );
};

interface FriendProps {
  friend: string;
  removeFriend: (friend: string) => void;
}

const Friend: FC<FriendProps> = ({ friend, removeFriend }) => {
  const onClickRemove = useCallback(() => {
    removeFriend(friend);
  }, [friend, removeFriend]);

  return (
    <div className='relative group'>
      <button
        type='button'
        className='h-10 p-px transition-colors blue-to-light-blue-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
      >
        <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
          {friend}
        </div>
      </button>
      <button
        type='button'
        onClick={onClickRemove}
        className='absolute flex items-center justify-center w-4 h-4 text-sm text-white transition-opacity bg-red-500 rounded-full opacity-0 -top-1 -right-1 hover:bg-[#FF6459] group-hover:opacity-100'
        title='Remove friend'
      >
        ×
      </button>
    </div>
  );
};

interface DocumentProps {
  document: Document;
  editDocument: (index: number) => void;
  index: number;
  removeDocument: (index: number) => void;
}

const DocumentCard: FC<DocumentProps> = ({
  index,
  document,
  editDocument,
  removeDocument,
}) => {
  const docTokenCount = useMemo(
    () => estimateTokens(document.content),
    [document.content],
  );
  const handleEditDocument = useCallback(() => {
    editDocument(index);
  }, [editDocument, index]);
  const handleRemoveDocument = useCallback(() => {
    removeDocument(index);
  }, [removeDocument, index]);

  return (
    <div className='flex flex-row items-center gap-x-2 justify-between bg-[#1B1B1B] border border-black rounded-2xl pl-5 pr-2 min-h-14'>
      <div className='grow flex flex-col gap-0.5'>
        <span className='block text-base font-medium text-white truncate'>
          {document.title}
        </span>
        <span className='text-[10px] text-gray-400'>
          {formatTokenCount(docTokenCount)}
        </span>
      </div>
      <div className='flex gap-2'>
        <button
          aria-label='editer'
          className='size-10 cursor-pointer flex items-center justify-center rounded-xl bg-[#101010]/25'
          onClick={handleEditDocument}
        >
          <Edit
            width={24}
            height={24}
            className='text-white'
          />
        </button>
        <button
          aria-label='supprimer'
          className='size-10 cursor-pointer flex items-center justify-center rounded-xl bg-[#101010]/25'
          onClick={handleRemoveDocument}
        >
          <Trash
            width={24}
            height={24}
            className='text-[#FF6459]'
          />
        </button>
      </div>
    </div>
  );
};
