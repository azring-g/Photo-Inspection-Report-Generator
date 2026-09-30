export interface BillboardSite {
  siteNo: string;
  location: string;
  size: string;
  format: string;
  defaultVisual: string;
  seqCount: number;
  coordinates?: string;
  structureType?: string;
  highway?: string;
}

export interface PhotoSlot {
  id: string;
  url: string;
  name: string;
  comment: string;
  file?: File;
  timestamp?: string;
}

export type ScreenId = 'screen-dashboard' | 'screen-input' | 'screen-comments' | 'screen-success';
