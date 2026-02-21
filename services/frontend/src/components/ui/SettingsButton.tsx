import { Settings } from 'lucide-react';

interface SettingsButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
  variant?: 'full' | 'icon-only';
}

const SettingsButton = ({
  onClick,
  label,
  className = '',
  variant = 'full',
}: SettingsButtonProps) => {
  if (variant === 'icon-only') {
    return (
      <button
        onClick={onClick}
        className={`shrink-0 h-10 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl ${className}`}
        style={{
          filter: 'drop-shadow(0rem 0.2rem 0.15rem var(--darkgray))',
        }}
        type='button'
      >
        <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center rounded-2xl p-2'>
          <Settings size={20} />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-10 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl ${className}`}
      style={{
        filter: 'drop-shadow(0rem 0.2rem 0.15rem var(--darkgray))',
      }}
      type='button'
    >
      <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-5'>
        {label}
        <Settings size={20} />
      </div>
    </button>
  );
};

export default SettingsButton;
