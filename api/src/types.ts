export type LectureAsset = 'transcript' | 'slides' | 'voiceover' | 'diagram';

export type LectureAssetState = {
  status: 'pending' | 'complete';
  content?: string;
  completedAt?: number;
};

export type LectureJob = {
  id: string;
  topic: string;
  createdAt: number;
  assets: Record<LectureAsset, LectureAssetState>;
};

export type ProgressEvent = {
  type: 'progress';
  asset: LectureAsset;
  status: LectureAssetState['status'];
};

export type AssetResponse = {
  id: string;
  topic: string;
  asset: LectureAsset;
  content: string;
  completedAt: number;
};
