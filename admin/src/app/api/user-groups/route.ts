import { NextResponse } from 'next/server';
import type { ICreateUserGroupRequest } from '@shared-types';
import { getAdminApiStatusCode } from '../../../lib/api/route-utils';
import { requireAdminSession } from '../../../lib/auth/session';
import { createUserGroup, listUserGroups } from '../../../lib/data/user-groups';

export async function GET() {
  try {
    const groups = await listUserGroups();
    return NextResponse.json({ success: true, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load user groups.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as ICreateUserGroupRequest;
    const group = await createUserGroup(body, session.uid);
    return NextResponse.json({ success: true, group });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user group.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
