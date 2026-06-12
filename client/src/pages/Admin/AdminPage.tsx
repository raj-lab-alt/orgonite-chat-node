import { Routes, Route, Navigate } from "react-router-dom";

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Routes>
        <Route index element={<div className="p-4">Admin Dashboard</div>} />
        <Route path="orders" element={<div className="p-4">Orders</div>} />
        <Route path="products" element={<div className="p-4">Products</div>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
