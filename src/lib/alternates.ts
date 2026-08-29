// stub — replaced by P3. Signature per INTERFACES §5.
import type { Entry, Lane } from './content';

export type AlternatesPage =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'lane'; lane: Lane }
  | { kind: 'site' };

export interface Alternate {
  rel: 'alternate';
  type: string;
  href: string;
  title: string;
}

export function getAlternates(_page: AlternatesPage): Alternate[] {
  return [];
}
