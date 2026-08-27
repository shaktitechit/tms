type ApiErrorBody = {
  success?: boolean;
  message?: string;
  code?: string;
};

function messageFromError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof (error as { data: unknown }).data === 'object' &&
    (error as { data: ApiErrorBody }).data !== null
  ) {
    const data = (error as { data: ApiErrorBody }).data;
    if (typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const message = (error as { error: unknown }).error;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  return messageFromError(error, fallback);
}

/** Managed video API base path for the caller's role. */
export function managedVideosPath(role?: string | null): '/videos/tenant' | '/videos/user' {
  return role === 'tenant' ? '/videos/tenant' : '/videos/user';
}
