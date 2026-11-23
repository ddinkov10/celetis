import { type RefObject, useEffect, useRef } from 'react';

export function useFocusedKey(
  root: RefObject<HTMLElement | null>,
  keyOf: (node: HTMLElement) => string | null,
): RefObject<string | null> {
  const key = useRef<string | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onIn = ({ target }: FocusEvent) => {
      key.current = target instanceof HTMLElement ? keyOf(target) : null;
    };
    // React sends no blur for a removed node, and the layout effect of the commit must still read the key.
    const onOut = ({ relatedTarget }: FocusEvent) => {
      if (relatedTarget instanceof Node && node.contains(relatedTarget)) return;
      queueMicrotask(() => {
        if (!node.contains(document.activeElement)) key.current = null;
      });
    };
    node.addEventListener('focusin', onIn);
    node.addEventListener('focusout', onOut);
    return () => {
      node.removeEventListener('focusin', onIn);
      node.removeEventListener('focusout', onOut);
    };
  }, [root, keyOf]);
  return key;
}
