let _pendingJoinId: string | null = null;
export const getPendingJoinId = () => _pendingJoinId;
export const setPendingJoinId = (id: string | null) => { _pendingJoinId = id; };
