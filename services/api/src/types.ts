import type { AppRole } from "@detrix/shared-types";

export interface AuthenticatedUser {
  id: string;
  email: string | undefined;
  role: AppRole;
}
