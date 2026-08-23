import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';

export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { params } = context;
  const p = params?.param as string;
  return new Response(JSON.stringify({ received: p, ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};