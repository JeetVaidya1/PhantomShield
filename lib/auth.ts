import { getSupabaseClient } from './supabase';

export async function getAuthUser(request: Request): Promise<{
  userId: string;
  error?: undefined;
} | {
  userId?: undefined;
  error: string;
}> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Invalid or expired token' };
  }

  return { userId: user.id };
}
