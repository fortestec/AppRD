import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface PartThumbnailProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const PartThumbnail: React.FC<PartThumbnailProps> = ({
  src,
  alt,
  size = 'md',
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClass =
    size === 'sm'
      ? 'w-11 h-11 rounded-lg'
      : size === 'lg'
        ? 'w-20 h-20 rounded-xl'
        : 'w-14 h-14 rounded-xl';

  const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  if (!src || hasError) {
    return (
      <div
        className={`${sizeClass} bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0`}
        aria-label={alt}
      >
        <Package className={iconSize} />
      </div>
    );
  }

  const content = (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${sizeClass} object-cover border border-zinc-200 bg-zinc-100 shrink-0`}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-red-600 rounded-xl"
        title="Ampliar foto"
      >
        {content}
      </button>
    );
  }

  return content;
};
