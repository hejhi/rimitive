import { useEffect, useState } from 'react';

export function useIsNarrowViewport(breakpoint = 768) {
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isNarrow;
}
