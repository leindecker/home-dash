export interface LockState {
  status: 'locked' | 'unlocked' | 'unknown';
  method: string | null;
  userName: string | null;
  updatedAt: string;
}

export const lockState: LockState = {
  status: 'unknown',
  method: null,
  userName: null,
  updatedAt: new Date().toISOString(),
};
