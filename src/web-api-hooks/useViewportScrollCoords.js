import { useEffect, useState } from 'react';
import { canUseVisualViewport, managedEventListener } from './utils';
/**
 * Tracks visual viewport scroll position.
 *
 * ⚗️ _The underlying technology is experimental. Please be aware about browser compatibility before using this in production._
 *
 * @returns Coordinates `[x, y]`, falling back to `[0, 0]` when unavailable.
 *
 * @example
 * function Component() {
 *   const [viewportScrollX, viewportScrollY] = useViewportScrollCoords();
 *   // ...
 * }
 */
export default function useViewportScrollCoords() {
    const [coords, setCoords] = useState(canUseVisualViewport
        ? [window.visualViewport.pageLeft, window.visualViewport.pageTop]
        : [0, 0]);
    useEffect(() => {
        if (!canUseVisualViewport) {
            return;
        }
        function handler() {
            setCoords([
                window.visualViewport.pageLeft,
                window.visualViewport.pageTop,
            ]);
        }
        managedEventListener(window === null || window === void 0 ? void 0 : window.visualViewport, 'scroll', handler);
        managedEventListener(window === null || window === void 0 ? void 0 : window.visualViewport, 'resize', handler);
    }, []);
    return coords;
}
