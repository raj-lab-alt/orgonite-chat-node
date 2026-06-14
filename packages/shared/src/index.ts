export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  imageUrl: string;
  benefits: string;
  composition: string;
  taille: string;
  accentColor: string;
  productType: string;
  welcomeSequence: string[];
  stock: number;
  hook: string;
  hookTransition: string;
  upsellPrice: number | null;
  priceOriginal: number | null;
  faq: { question: string; answer: string }[];
  reviews: { author: string; rating: number; text: string }[];
  visible: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  price: number;
  original_price: number | null;
  icon: string;
  imageUrl: string;
  color: string;
  description: string;
  benefits: string;
  duration: string;
  format: string;
  visible: boolean;
  product_ids: string[];
  created_at: string;
}

export type OrderStatus = string;

export interface Order {
  id: string;
  nom: string;
  telephone: string;
  telephone2: string;
  gouvernorat: string;
  adresse: string;
  produit: string;
  prix_produit: number;
  frais_livraison: number;
  total_commande: number;
  nombre_articles: number;
  notes: string;
  tracking_number: string;
  statut: OrderStatus;
  statut_avant_corbeille: string | null;
  trashed_at: string | null;
  date: string;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  imageBase64?: string;
  imageMimeType?: string;
  product?: Product;
  products?: Product[];
  order?: Order;
}

export interface TrackingConfig {
  facebookPixelIds: string[];
  googleAnalyticsIds: string[];
  welcomeMessage: string;
}
