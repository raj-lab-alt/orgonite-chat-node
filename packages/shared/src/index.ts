export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  is_active: boolean;
  welcome_sequence?: string[];
  faq?: { question: string; answer: string }[];
  reviews?: { author: string; rating: number; text: string }[];
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  is_active: boolean;
  product_ids?: string[];
  created_at: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address?: string;
  product_id?: string;
  product_name?: string;
  quantity: number;
  total: number;
  currency: string;
  status: OrderStatus;
  notes?: string;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface TrackingConfig {
  facebook_pixel_id?: string;
  ga4_id?: string;
  welcome_message?: string;
}
