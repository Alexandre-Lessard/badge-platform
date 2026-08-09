/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { PRODUCT_SLUGS } from "@badge/shared";

// ── Types ────────────────────────────────────────────────────────────

export type CartItem = {
  productId: string;       // product UUID (may be "" for items added before checkout resolves it)
  productSlug: string;     // e.g. "sticker-sheet"
  productName: string;     // localized display name
  quantity: number;
  itemId?: string;         // UUID of the linked item (or "pending:<name>" temporarily)
  itemName?: string;       // display name of the linked item
};

type CartContextType = {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  updateItemId: (oldItemId: string, newItemId: string) => void;
  clearCart: () => void;
  cartCount: number;
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Cart key = productSlug + ":" + (itemId || "") — allows same product for different items */
export function cartKey(item: { productSlug: string; itemId?: string }): string {
  return `${item.productSlug}:${item.itemId || ""}`;
}

// ── Storage ──────────────────────────────────────────────────────────

const STORAGE_KEY = "badge_cart_v2";
const OLD_STORAGE_KEY = "badge_cart";

function migrateOldCart(): CartItem[] {
  try {
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldRaw) return [];
    // Only migrate if v2 doesn't exist yet
    if (localStorage.getItem(STORAGE_KEY)) {
      localStorage.removeItem(OLD_STORAGE_KEY);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldItems = JSON.parse(oldRaw) as any[];
    const migrated: CartItem[] = oldItems
      .filter((i) => i.itemId)
      .map((i) => ({
        productId: "",
        productSlug: PRODUCT_SLUGS.STICKER_SHEET,
        productName: i.productName || "",
        quantity: i.quantity || 1,
        itemId: i.itemId,
        itemName: i.itemName || "",
      }));
    localStorage.removeItem(OLD_STORAGE_KEY);
    return migrated;
  } catch {
    // On any error, silently clear old storage and start fresh
    try { localStorage.removeItem(OLD_STORAGE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function loadCart(): CartItem[] {
  try {
    // Try migration first
    const migrated = migrateOldCart();
    if (migrated.length > 0) {
      saveCart(migrated);
      return migrated;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Validate shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (parsed as any[])
      .map((i) => ({
        productId: i.productId || "",
        productSlug: i.productSlug || "",
        productName: i.productName || "",
        quantity: i.quantity || 1,
        itemId: i.itemId || undefined,
        itemName: i.itemName || undefined,
      }))
      .filter((i) => i.productSlug);
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch { /* ignore quota errors */ }
}

// ── Context ──────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setCart((prev) => {
        const key = cartKey(item);
        const existing = prev.find((i) => cartKey(i) === key);
        const next = existing
          ? prev.map((i) =>
              cartKey(i) === key
                ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                : i,
            )
          : [...prev, { ...item, quantity: item.quantity ?? 1 }];
        saveCart(next);
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback(
    (key: string) => {
      setCart((prev) => {
        const next = prev.filter((i) => cartKey(i) !== key);
        saveCart(next);
        return next;
      });
    },
    [],
  );

  const updateQuantity = useCallback(
    (key: string, quantity: number) => {
      if (quantity < 1) return removeItem(key);
      setCart((prev) => {
        const next = prev.map((i) =>
          cartKey(i) === key ? { ...i, quantity } : i,
        );
        saveCart(next);
        return next;
      });
    },
    [removeItem],
  );

  const updateItemId = useCallback(
    (oldItemId: string, newItemId: string) => {
      setCart((prev) => {
        const next = prev.map((i) =>
          i.itemId === oldItemId ? { ...i, itemId: newItemId } : i,
        );
        saveCart(next);
        return next;
      });
    },
    [],
  );

  const clearCart = useCallback(() => {
    setCart([]);
    saveCart([]);
  }, []);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addItem, removeItem, updateQuantity, updateItemId, clearCart, cartCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
