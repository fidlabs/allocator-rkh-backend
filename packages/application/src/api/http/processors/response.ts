export const ok = (message: string, data?: any) => ({
  status: '200',
  message: message || 'Success',
  data,
});

export const badRequest = (message: string, errors: any) => ({
  status: '400',
  message: message || 'Bad Request',
  errors,
});

export const badPermissions = (message?: string) => ({
  status: '400',
  message: message || 'Bad Permissions',
});

export const unauthorized = (message: string) => ({
  status: '401',
  message: message || 'Unauthorized',
});

export const internalServerError = (message: string) => ({
  status: '500',
  message: message || 'Internal Server Error',
});
