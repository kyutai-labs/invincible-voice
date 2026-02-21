import NewConversation from '@/components/icons/NewConversation';

interface StartConversationButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
}

const StartConversationButton = ({
  onClick,
  label,
  className = '',
}: StartConversationButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 p-px cursor-pointer pointer-events-auto green-to-purple-via-blue-gradient rounded-2xl h-14 ${className}`}
      type='button'
    >
      <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-8'>
        {label}
        <NewConversation
          width={24}
          height={24}
          className='shrink-0 text-white'
        />
      </div>
    </button>
  );
};

export default StartConversationButton;
