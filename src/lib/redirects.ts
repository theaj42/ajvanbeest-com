// stub — replaced by P4 (redirect pages from `aliases` + legacy-urls.txt).
export interface Redirect {
  from: string;
  to: string;
}

export async function getRedirects(): Promise<Redirect[]> {
  return [];
}
