import { useState, useEffect, useRef } from 'react';

/**
 * Hook that initializes the Farcaster Mini App SDK.
 * Returns { sdk, context, isReady }.
 *
 * When running inside Base App / Warpcast, the SDK is loaded from esm.sh CDN.
 * When running standalone (localhost), gracefully degrades.
 */
export function useMiniApp() {
  const [sdk, setSdk] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const mod = await import('https://esm.sh/@farcaster/miniapp-sdk@latest');
        const miniAppSdk = mod.sdk;
        const ctx = await miniAppSdk.context;

        // Tell host we're ready (hides splash screen in Base App)
        try { await miniAppSdk.actions.ready(); } catch { /* optional */ }

        setSdk(miniAppSdk);
        setContext(ctx);
        setIsReady(true);
      } catch (e) {
        console.warn('Mini App SDK not available (running standalone?):', e);
        setIsReady(true); // still "ready" — just without SDK
      }
    })();
  }, []);

  /** Compose a cast via the SDK (or fallback to Web Share API) */
  async function composeCast(text: string, embeds?: string[]) {
    try {
      if (sdk?.actions?.composeCast) {
        return await sdk.actions.composeCast({ text, embeds });
      }
    } catch { /* ignore */ }
    // Fallback: Web Share API
    if (navigator.share) {
      try {
        await navigator.share({ text, url: embeds?.[0] || window.location.href });
        return;
      } catch { /* user cancelled */ }
    }
    // Fallback: clipboard
    await navigator.clipboard.writeText(text + ' ' + (embeds?.[0] || window.location.href));
    throw new Error('Copied to clipboard');
  }

  return { sdk, context, isReady, composeCast };
}
