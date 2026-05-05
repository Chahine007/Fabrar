export interface DecodedAuthToken {
  id: number;
  username?: string | null;
  role: string;
  employee_id: number | null;
  nome?: string | null;
  cognome?: string | null;
  iat?: number;
  exp?: number;
}

export interface UserData {
  id: number;
  username: string;
  role: string;
  employee_id: number | null;
  nome?: string | null;
  cognome?: string | null;
}
