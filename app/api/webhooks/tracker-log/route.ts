import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    // Verify shared secret
    const authHeader = request.headers.get('authorization');
    const sharedSecret = process.env.TRACKER_WEBHOOK_SECRET;

    if (!authHeader || !sharedSecret || authHeader !== `Bearer ${sharedSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      identity_id,
      user_id,
      trackers_stripped,
      tracker_companies,
      links_cleaned,
      email_from,
      email_subject,
    } = body;

    if (!identity_id || !user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { error } = await supabase.from('tracker_logs').insert({
      identity_id,
      user_id,
      trackers_stripped: trackers_stripped || 0,
      tracker_companies: tracker_companies || [],
      links_cleaned: links_cleaned || 0,
      email_from: email_from || null,
      email_subject: email_subject || null,
    });

    if (error) {
      return Response.json({ error: 'Failed to create record' }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
