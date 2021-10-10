export const canUseDOM = typeof window !== 'undefined';
export const canUseVisualViewport = canUseDOM && 'visualViewport' in window;
export function dethunkify(value) {
    return typeof value === 'function' ? value() : value;
}
export function managedEventListener(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    return () => {
        target.removeEventListener(type, callback, options);
    };
}
export function managedInterval(callback, delayMs) {
    const id = setInterval(callback, delayMs);
    return () => {
        clearInterval(id);
    };
}
