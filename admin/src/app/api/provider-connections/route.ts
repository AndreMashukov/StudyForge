import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '../../../lib/api/route-utils';
import { listProviderConnectionCatalog } from '../../../lib/data/provider-connections';

export async function GET() {
  try {
    const connections = await listProviderConnectionCatalog();
    return NextResponse.json({ success: true, connections });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load provider connections.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
