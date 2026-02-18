import { CheckIcon, X } from 'lucide-react';
import {
  FC,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ChangeEvent,
} from 'react';
import { useTranslations } from '@/i18n';
import { estimateTokens, formatTokenCount } from '@/utils/tokenUtils';
import { Document } from '@/utils/userData';

interface DocumentEditorPopupProps {
  document: Document | null;
  isOpen: boolean;
  onSave: (document: Document) => void;
  onCancel: () => void;
}

const DocumentEditorPopup: FC<DocumentEditorPopupProps> = ({
  document,
  isOpen,
  onSave,
  onCancel,
}) => {
  const t = useTranslations();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const tokenCount = useMemo(() => estimateTokens(content), [content]);
  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    },
    [],
  );
  const handleContentChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setContent(event.target.value);
    },
    [],
  );
  const handleSave = useCallback(() => {
    if (title.trim()) {
      onSave({ title: title.trim(), content });
    }
  }, [content, onSave, title]);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [document, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <button
        aria-label='cancel'
        className='absolute inset-0 bg-[#121212CC] backdrop-blur'
        onClick={onCancel}
      />
      <div className='relative border bg-[#121212] border-black rounded-[40px] shadow-custom w-[90%] max-w-4xl h-[80vh] flex flex-col gap-4 px-12 pt-6 pb-8'>
        <div className='flex flex-row justify-between w-full'>
          <h2 className='text-base font-medium text-white'>
            {document
              ? t('documentEditor.editDocument')
              : t('documentEditor.newDocument')}
          </h2>
          <button
            className='size-10 cursor-pointer flex items-center justify-center rounded-2xl bg-[#101010] -mr-5 -mt-2'
            onClick={onCancel}
          >
            <X
              className='text-white'
              size={24}
            />
          </button>
        </div>
        <div className='flex flex-col grow gap-3 overflow-hidden'>
          <div>
            <div className='mb-1 text-sm font-medium text-gray-300'>
              {t('common.title')}
            </div>
            <input
              type='text'
              value={title}
              onChange={handleTitleChange}
              className='w-full px-6 py-2 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green'
              placeholder={t('documentEditor.documentTitlePlaceholder')}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
          <div className='flex flex-col flex-1'>
            <div className='flex items-center justify-between mb-1'>
              <div className='text-sm font-medium text-gray-300'>
                {t('common.content')}
              </div>
              <span className='text-xs text-gray-400'>
                {formatTokenCount(tokenCount)}
              </span>
            </div>
            <textarea
              value={content}
              onChange={handleContentChange}
              className='flex-1 w-full min-h-0 px-6 py-4 text-base text-white bg-[#1B1B1B] border border-white rounded-3xl resize-none focus:outline-none focus:border-green scrollbar-hidden scrollable'
              placeholder={t('documentEditor.documentContentPlaceholder')}
            />
          </div>
        </div>
        <div className='flex justify-end gap-x-3'>
          <button
            onClick={onCancel}
            className='px-8 text-sm h-14 bg-[#101010] rounded-2xl'
          >
            {t('documentEditor.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className='p-px h-14 light-green-to-green-gradient rounded-2xl'
          >
            <div className='flex flex-row bg-[#181818] size-full items-center justify-center gap-4 px-8 rounded-2xl'>
              {t('documentEditor.save')}
              <CheckIcon
                size={24}
                className='text-[#39F2AE]'
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditorPopup;
