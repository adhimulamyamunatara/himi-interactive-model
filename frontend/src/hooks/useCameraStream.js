import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createCameraController } from '../utils/cameraController';

/**
 * The camera, owned by one page. It never starts by itself: call `start()` from a button.
 * It is switched off (all tracks stopped) when the page unmounts, when the tab or page is hidden or closed,
 * and when `allowed` becomes false.
 */
export function useCameraStream({ allowed }) {
  const [controller] = useState(() => createCameraController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [leftTab, setLeftTab] = useState(false);

  useEffect(() => {
    const stopHidden = () => {
      if (document.hidden && controller.getSnapshot().status !== 'idle') {
        controller.stop();
        setLeftTab(true);
      }
    };
    const stop = () => controller.stop();

    document.addEventListener('visibilitychange', stopHidden);
    window.addEventListener('pagehide', stop);

    return () => {
      document.removeEventListener('visibilitychange', stopHidden);
      window.removeEventListener('pagehide', stop);
      controller.stop();
    };
  }, [controller]);

  useEffect(() => {
    if (!allowed) {
      controller.stop();
    }
  }, [allowed, controller]);

  const start = useCallback(() => {
    if (!allowed) {
      return Promise.resolve(false);
    }

    setLeftTab(false);
    return controller.start();
  }, [allowed, controller]);

  const stop = useCallback(() => {
    setLeftTab(false);
    controller.stop();
  }, [controller]);

  return { ...snapshot, leftTab, start, stop };
}
