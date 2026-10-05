/**
 * 後台權限清單。角色（Role）持有權限字串陣列，`*` 代表全部權限。
 * 新增後台功能時，在這裡登記權限並於 controller 以 @RequirePermissions 宣告。
 */
export const Permission = {
  DashboardRead: 'dashboard:read',
  ProductRead: 'product:read',
  ProductWrite: 'product:write',
  CatalogWrite: 'catalog:write',
  OrderRead: 'order:read',
  OrderWrite: 'order:write',
  MemberRead: 'member:read',
  MemberWrite: 'member:write',
  ContentWrite: 'content:write',
  MarketingWrite: 'marketing:write',
  ReportRead: 'report:read',
  AdminManage: 'admin:manage',
  SettingsWrite: 'settings:write',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
export const ALL_PERMISSIONS = Object.values(Permission);
export const WILDCARD = '*';

export function hasPermissions(granted: readonly string[], required: readonly string[]): boolean {
  if (granted.includes(WILDCARD)) return true;
  return required.every((permission) => granted.includes(permission));
}
