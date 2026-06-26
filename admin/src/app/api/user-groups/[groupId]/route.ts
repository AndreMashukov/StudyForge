import { NextResponse } from 'next/server';
import type { IUpdateUserGroupRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../lib/auth/session';
import {
  deleteUserGroup,
  getUserGroupById,
  listGroupMembers,
  updateUserGroup,
} from '../../../../lib/data/user-groups';

interface IRouteContext {
  params: Promise<{ groupId: string }>;
}

export async function GET(_request: Request, context: IRouteContext) {
  try {
    const { groupId } = await context.params;
    const group = await getUserGroupById(groupId);

    if (!group) {
      return NextResponse.json({ success: false, message: 'User group not found.' }, { status: 404 });
    }

    const members = await listGroupMembers(groupId);
    return NextResponse.json({ success: true, group, members });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load user group.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { groupId } = await context.params;
    const body = (await request.json()) as IUpdateUserGroupRequest;
    const group = await updateUserGroup(groupId, body, session.uid);
    revalidatePath('/user-groups');
    revalidatePath(`/user-groups/${groupId}`);
    return NextResponse.json({ success: true, group });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user group.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}

export async function DELETE(_request: Request, context: IRouteContext) {
  try {
    await requireAdminSession();
    const { groupId } = await context.params;
    await deleteUserGroup(groupId);
    revalidatePath('/user-groups');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user group.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
