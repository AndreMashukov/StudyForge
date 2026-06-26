export interface IAdminUserSummary {
  uid: string;
  email: string;
  displayName?: string;
  createdAt?: string;
  disabled?: boolean;
  userGroupId?: string;
  userGroupName?: string;
}
