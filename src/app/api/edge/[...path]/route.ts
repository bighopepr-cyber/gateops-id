import { proxyGateopsEdgeRequest } from "@/lib/edge-function-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyGateopsEdgeRequest(request, path, {
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.GATEOPS_SERVICE_KEY,
  });
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyGateopsEdgeRequest(request, path, {
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.GATEOPS_SERVICE_KEY,
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyGateopsEdgeRequest(request, path, {
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.GATEOPS_SERVICE_KEY,
  });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyGateopsEdgeRequest(request, path, {
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.GATEOPS_SERVICE_KEY,
  });
}
