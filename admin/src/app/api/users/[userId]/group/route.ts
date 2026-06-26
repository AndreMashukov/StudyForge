import { NextResponse } from 'next/server';
import type { IAssignUserGroupRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '../../../../../lib/api/route-utils';
import { requireAdminSession } from '../../../../../lib/auth/session';
import { assignUserGroup } from '../../../../../lib/data/users';

interface IRouteContext {
  params: Promise<{ userId: string }>;
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { userId } = await context.params;
    const body = (await request.json()) as IAssignUserGroupRequest;

    if (!body.userGroupId?.trim()) {
      return NextResponse.json(
        { success: false, message: 'userGroupId is required.' },
        { status: 400 }
      );
    }

    const user = await assignUserGroup(userId, body.userGroupId.trim(), session.uid);
    revalidatePath('/users');
    revalidatePath(`/users/${userId}`);
    revalidatePath('/user-groups');
    revalidatePath(`/user-groups/${body.userGroupId}`);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign user group.';
    return NextResponse.json({ success: false, message }, { status: getAdminApiStatusCode(error) });
  }
}
