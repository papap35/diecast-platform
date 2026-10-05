export interface MemberPrincipal {
  id: string;
}

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  permissions: string[];
}

declare global {
  // Express 的 Request 型別擴充：經過 guard 驗證後掛上的登入者資訊
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      member?: MemberPrincipal;
      admin?: AdminPrincipal;
    }
  }
}
