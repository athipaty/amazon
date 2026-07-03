import { useState, useCallback } from 'react';

// Plain <img> tags paint row-by-row as bytes stream in, which looks janky on
// slower connections. This hides the image until it's fully loaded, then
// fades it in — so it always appears as one smooth reveal instead of
// rendering top to bottom.
export default function FadeImg({ className = '', onLoad, ...props }) {
  const [loaded, setLoaded] = useState(false);

  const setRef = useCallback((el) => {
    if (el?.complete) setLoaded(true);
  }, []);

  return (
    <img
      ref={setRef}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      className={`${className} transition-opacity duration-300 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      {...props}
    />
  );
}
