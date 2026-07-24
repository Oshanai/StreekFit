/**
 * Capture the offscreen ShareCard and hand it to the system share sheet —
 * Instagram Stories appears there when the app is installed. The user picks
 * the destination themselves; nothing is posted automatically.
 */

import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export function useShareCard() {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async () => {
    if (cardRef.current == null || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`, {
          mimeType: 'image/png',
          dialogTitle: 'Streek Fit',
        });
      }
    } catch {
      // Capture/share is best-effort — never crash the Today screen over it.
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return { cardRef, share, sharing };
}
