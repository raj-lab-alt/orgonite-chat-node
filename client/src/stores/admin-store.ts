import { create } from "zustand";
import { isLoggedIn, setToken, clearToken, adminCheck, adminLogin } from "@/lib/admin-api";

interface AdminState {
  isAuth: boolean;
  checking: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAuth: isLoggedIn(),
  checking: true,

  login: async (email, password, remember = false) => {
    const { token } = await adminLogin(email, password, remember);
    setToken(token, remember);
    set({ isAuth: true });
  },

  logout: () => {
    clearToken();
    set({ isAuth: false });
  },

  checkAuth: async () => {
    set({ checking: true });
    if (!isLoggedIn()) {
      set({ isAuth: false, checking: false });
      return;
    }
    try {
      await adminCheck();
      set({ isAuth: true, checking: false });
    } catch {
      clearToken();
      set({ isAuth: false, checking: false });
    }
  },
}));
