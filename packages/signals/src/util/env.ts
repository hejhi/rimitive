// Simple dev/prod switch for optional runtime checks in hot paths
export const DEV = process.env.NODE_ENV !== 'production';

