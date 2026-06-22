import { createI18n } from "@openshop/core";

export const i18n = createI18n({
  strategy: "pathname",
  defaultLocale: "en-US",
  locales: [
    { id: "en-US", language: "EN", country: "US", currency: "USD", label: "English" },
    { id: "fr-CA", language: "FR", country: "CA", currency: "CAD", label: "Français" },
  ],
});
