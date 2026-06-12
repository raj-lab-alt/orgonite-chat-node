const BASE = "";

function getToken(): string | null {
  return sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token");
}

export function setToken(token: string, remember: boolean) {
  if (remember) localStorage.setItem("admin_token", token);
  else sessionStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin";
    throw new Error("Non autorisé");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// --- Auth ---
export function adminLogin(email: string, password: string, remember: boolean) {
  return apiFetch<{ token: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminCheck() {
  return apiFetch<{ valid: boolean }>("/api/admin/check");
}

// --- Config ---
export function getConfig() {
  return apiFetch<any>("/api/admin/config");
}

export function updateConfig(data: any) {
  return apiFetch<{ success: boolean }>("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Stats ---
export function getStats(days = 30) {
  return apiFetch<any>(`/api/admin/stats?days=${days}`);
}

// --- Products ---
export function getAdminProducts() {
  return apiFetch<any[]>("/api/admin/products");
}

export function createProduct(data: any) {
  return apiFetch<{ success: boolean }>("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: string, data: any) {
  return apiFetch<{ success: boolean }>(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<{ success: boolean }>(`/api/admin/products/${id}`, {
    method: "DELETE",
  });
}

export function syncProducts(products: any[]) {
  return apiFetch<{ success: boolean; imported: number }>("/api/admin/products/sync", {
    method: "POST",
    body: JSON.stringify({ products }),
  });
}

// --- Services ---
export function getAdminServices() {
  return apiFetch<any[]>("/api/admin/services");
}

export function createService(data: any) {
  return apiFetch<{ success: boolean }>("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateService(id: string, data: any) {
  return apiFetch<{ success: boolean }>(`/api/admin/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteService(id: string) {
  return apiFetch<{ success: boolean }>(`/api/admin/services/${id}`, {
    method: "DELETE",
  });
}

// --- Orders ---
export function getOrders(includeTrash = false) {
  const qs = includeTrash ? "?includeTrash=1" : "";
  return apiFetch<any[]>(`/api/orders${qs}`);
}

export function getOrder(id: string) {
  return apiFetch<any>(`/api/orders/${id}`);
}

export function updateOrderStatus(id: string, statut: string) {
  return apiFetch<any>(`/api/orders/${id}/statut`, {
    method: "PUT",
    body: JSON.stringify({ statut }),
  });
}

export function updateOrder(id: string, data: any) {
  return apiFetch<any>(`/api/orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function bulkTrashOrders(ids: string[]) {
  return apiFetch<{ success: boolean }>("/api/orders/bulk-trash", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export function bulkRestoreOrders(ids: string[]) {
  return apiFetch<{ success: boolean }>("/api/orders/bulk-restore", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export function bulkDeleteOrders(ids: string[]) {
  return apiFetch<{ success: boolean }>("/api/orders/bulk-delete", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}
