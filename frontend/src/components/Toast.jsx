import { useEffect, useState, useRef, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef([]);

  /* Clear all pending timers on unmount */
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    const tid = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
    timers.current.push(tid);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
  };

  return { toasts, toast };
}

export function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && '✓ '}
          {t.type === 'error'   && '✕ '}
          {t.type === 'info'    && 'ℹ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}
