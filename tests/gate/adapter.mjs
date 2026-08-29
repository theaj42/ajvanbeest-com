// Post-lock integration seam. This is the ONLY file under tests/gate/ that may change after
// LOCK.sha256 is written (it is excluded from the lock). It maps the gate onto an environment;
// it must never alter scenario meaning, fixtures, thresholds, or expected outcomes.
export const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4321').replace(/\/+$/, '');
export const DIST = process.env.DIST || './dist';
export const SRC_CONTENT = process.env.SRC_CONTENT || './src/content';
