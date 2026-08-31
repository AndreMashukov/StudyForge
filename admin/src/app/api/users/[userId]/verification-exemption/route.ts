import { NextResponse } from 'next/server';
import type { IUpdateUserVerificationExemptionRequest } from '@shared-types';
import { revalidatePath } from 'next/cache';
import { getAdminApiStatusCode } from '@admin/app/api/_utils/route-utils';
import { requireAdminSession } from '@admin/auth/session';
import { updateUserVerificationExemption } from '@admin/data/users';

interface IRouteContext {
  params: Promise<{ userId: string }>;
}

function parseRequestBody(value: unknown): IUpdateUserVerificationExemptionRequest | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'emailVerificationExempt' in value &&
    typeof value.emailVerificationExempt === 'boolean'
  ) {
    return {
      emailVerificationExempt: value.emailVerificationExempt,
    };
  }
  return null;
}

export async function PUT(request: Request, context: IRouteContext) {
  try {
    const session = await requireAdminSession();
    const { userId } = await context.params;
    const body = parseRequestBody(await request.json());

    if (!body) {
      return NextResponse.json(
        { success: false, message: 'emailVerificationExempt is required.' },
        { status: 400 },
      );
    }

    const user = await updateUserVerificationExemption(
      userId,
      body.emailVerificationExempt,
      session.uid,
    );
    revalidatePath('/users');
    revalidatePath(`/users/${userId}`);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update verification exemption.';
    return NextResponse.json(
      { success: false, message },
      { status: getAdminApiStatusCode(error) },
    );
  }
}
