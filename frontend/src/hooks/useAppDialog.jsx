import React, { useCallback, useRef, useState } from 'react';
import AppDialog from '../components/Common/AppDialog';

export const useAppDialog = () => {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const openDialog = useCallback((nextOptions) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const handleResolve = useCallback((value) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    if (resolver) resolver(value);
  }, []);

  const dialog = <AppDialog options={options} onResolve={handleResolve} />;

  return {
    dialog,
    alert: (nextOptions) => openDialog({ ...nextOptions, type: 'alert' }),
    confirm: (nextOptions) => openDialog({ ...nextOptions, type: 'confirm' }),
    prompt: (nextOptions) => openDialog({ ...nextOptions, type: 'prompt' })
  };
};
