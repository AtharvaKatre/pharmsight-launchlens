import { apiRequest } from "./client";
import type { TokenResponse, User } from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => apiRequest<User>("/auth/me"),
};
