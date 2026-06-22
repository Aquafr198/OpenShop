import { createElement, type ReactNode } from "react";
import { useCart, useCartActions } from "./cart.js";
import { Money } from "./money.js";

export interface AddToCartButtonProps {
  merchandiseId: string;
  quantity?: number;
  attributes?: { key: string; value: string }[];
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Adds a merchandise line to the cart on click. Automatically disabled while a
 * cart mutation is in flight.
 */
export function AddToCartButton({
  merchandiseId,
  quantity = 1,
  attributes,
  children,
  disabled,
  className,
}: AddToCartButtonProps) {
  const { addLine } = useCartActions();
  const updating = useCart((s) => s.status === "updating");

  return createElement(
    "button",
    {
      type: "button",
      disabled: disabled || updating,
      "aria-busy": updating,
      ...(className ? { className } : {}),
      onClick: () =>
        void addLine({
          merchandiseId,
          quantity,
          ...(attributes ? { attributes } : {}),
        }),
    },
    children ?? "Add to cart",
  );
}

export interface QuantityAdjusterProps {
  lineId: string;
  quantity: number;
  min?: number;
  className?: string;
}

/** Increment/decrement a cart line's quantity; removes the line at 0. */
export function QuantityAdjuster({
  lineId,
  quantity,
  min = 0,
  className,
}: QuantityAdjusterProps) {
  const { updateLine, removeLine } = useCartActions();
  const updating = useCart((s) => s.status === "updating");

  const setQty = (next: number) => {
    if (next <= 0) void removeLine(lineId);
    else void updateLine({ id: lineId, quantity: next });
  };

  return createElement(
    "div",
    { ...(className ? { className } : {}) },
    createElement(
      "button",
      {
        type: "button",
        "aria-label": "Decrease quantity",
        disabled: updating || quantity <= min,
        onClick: () => setQty(quantity - 1),
      },
      "-",
    ),
    createElement("span", null, String(quantity)),
    createElement(
      "button",
      {
        type: "button",
        "aria-label": "Increase quantity",
        disabled: updating,
        onClick: () => setQty(quantity + 1),
      },
      "+",
    ),
  );
}

export interface CartTotalProps {
  /** Which cost field to display. Default "total". */
  field?: "total" | "subtotal";
  className?: string;
}

/** Displays the cart total (or subtotal), formatted via `<Money>`. */
export function CartTotal({ field = "total", className }: CartTotalProps) {
  const amount = useCart((s) =>
    field === "subtotal"
      ? s.cart?.cost.subtotalAmount
      : s.cart?.cost.totalAmount,
  );
  if (!amount) return null;
  return createElement(Money, { data: amount, ...(className ? { className } : {}) });
}

export interface CheckoutButtonProps {
  children?: ReactNode;
  className?: string;
}

/** A link to the cart's checkout URL; disabled (rendered as a span) when empty. */
export function CheckoutButton({ children, className }: CheckoutButtonProps) {
  const checkoutUrl = useCart((s) => s.cart?.checkoutUrl ?? null);
  const totalQuantity = useCart((s) => s.cart?.totalQuantity ?? 0);
  const enabled = Boolean(checkoutUrl) && totalQuantity > 0;
  const label = children ?? "Checkout";

  if (!enabled) {
    return createElement(
      "span",
      { "aria-disabled": true, ...(className ? { className } : {}) },
      label,
    );
  }
  return createElement(
    "a",
    { href: checkoutUrl as string, ...(className ? { className } : {}) },
    label,
  );
}
