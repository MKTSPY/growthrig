// Uses native fetch available in Node 18+

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SupabaseAdmin = {
  postgrest: (path: string, options: {
    method: string;
    body?: any;
    headers?: Record<string, string>;
  }) => Promise<any>;
};

export function getSupabaseAdmin(): SupabaseAdmin | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const base = SUPABASE_URL.replace(/\/*$/, '');
  return {
    postgrest: async (path, { method, body, headers }) => {
      const url = `${base}/rest/v1/${path}`;
      const res = await fetch(url, {
        method,
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase query failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      return data;
    },
  };
}
