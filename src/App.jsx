import { useEffect, useRef, useState } from 'react';
import shellMarkup from './templates/app-shell.html?raw';
import { bootstrapLegacyRuntime } from './legacy/bootstrapLegacyRuntime';

const bootstrapErrorStyle = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: '9999',
  background: '#fff4e5',
  border: '1px solid #f2c27b',
  color: '#5d3b00',
  borderRadius: '12px',
  padding: '10px 12px',
  maxWidth: '360px',
  fontSize: '13px',
  lineHeight: 1.4,
};

export default function App() {
  const shellHostRef = useRef(null);
  const [bootstrapError, setBootstrapError] = useState('');

  useEffect(() => {
    const shellHost = shellHostRef.current;
    if (!shellHost) {
      return undefined;
    }

    // React owns the app shell DOM mount, while legacy runtime keeps behavior parity.
    shellHost.innerHTML = shellMarkup;

    let isMounted = true;
    bootstrapLegacyRuntime().catch((error) => {
      if (!isMounted) {
        return;
      }
      setBootstrapError(error instanceof Error ? error.message : String(error));
      console.error('Legacy runtime bootstrap failed:', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <div id="legacy-shell-host" ref={shellHostRef} />
      {bootstrapError ? (
        <div style={bootstrapErrorStyle} role="alert" aria-live="assertive">
          Gagal memuat runtime aplikasi: {bootstrapError}
        </div>
      ) : null}
    </>
  );
}
