import { getSupabaseServiceClient } from './supabase';

export interface AuditLogParams {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  request?: {
    headers: { get(name: string): string | null };
  };
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (params.request) {
      ipAddress =
        params.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        params.request.headers.get('x-real-ip') ||
        null;
      userAgent = params.request.headers.get('user-agent') || null;
    }

    const { error } = await supabase.from('audit_log').insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      metadata: params.metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      success: params.success ?? true,
    });

    if (error) {
      console.warn('[audit] Failed to write audit log:', error.message);
    }
  } catch (err) {
    console.warn('[audit] Unexpected error in logAudit:', err);
  }
}
