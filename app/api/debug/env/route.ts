// TEMPORARY — delete after verifying Vercel env vars
export async function GET() {
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] as const;

  const result = keys.map((name) => {
    const value = process.env[name];
    return {
      name,
      isSet: !!value,
      length: value?.length ?? 0,
      first5: value?.slice(0, 5) ?? '',
    };
  });

  return Response.json({ env: result });
}
