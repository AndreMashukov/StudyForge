export interface IAdminUserSummary {
  uid: string;
  email: string;
  displayName?: string;
  createdAt?: string;
  disabled?: boolean;
  emailVerified?: boolean;
  emailVerificationExempt?: boolean;
  userGroupId?: string;
  userGroupName?: string;
}
