// External store for eBay auto-list progress, keyed by product/group id.
// ProductGroupCard is unmounted/remounted whenever the user selects a different
// item in AmazonPage's master-detail view (it's rendered with `key={itemId}`), which
// would otherwise reset local useState progress to its defaults every time the user
// navigates away and back — even though the in-flight fetch chain keeps running on
// the server regardless of whether the component is mounted. Storing progress here
// (outside React) lets it survive that remount.
import { useSyncExternalStore } from 'react';

const EMPTY = { autoListing: false, autoListStep: '', autoListError: '', autoListWarning: '', autoListSuccess: null };

const state = new Map(); // key -> progress object
const listeners = new Map(); // key -> Set<fn>

function notify(key) {
  listeners.get(key)?.forEach(fn => fn());
}

export function getAutoListState(key) {
  return state.get(key) || EMPTY;
}

export function setAutoListState(key, patch) {
  state.set(key, { ...getAutoListState(key), ...patch });
  notify(key);
}

export function useAutoListState(key) {
  return useSyncExternalStore(
    (onChange) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(onChange);
      return () => listeners.get(key).delete(onChange);
    },
    () => getAutoListState(key),
  );
}
