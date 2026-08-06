import { NextResponse } from 'next/server';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { listProviderConnectionCatalog } from '@admin/data/provider-connections';

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
