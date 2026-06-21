import { describe, it, expect } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n, type Locale, type Product } from "@openshop/core";
import { useMoney } from "./money.js";
import { useVariantSelection } from "./product.js";
import { provideI18n, useLocale, useLocalizedPath } from "./i18n.js";

function withSetup<T>(setup: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const Comp = defineComponent({
    setup() {
      result = setup();
      return () => h("div");
    },
  });
  const wrapper = mount(Comp);
  return { result, unmount: () => wrapper.unmount() };
}

describe("useMoney", () => {
  it("formats reactively", async () => {
    const money = ref({ amount: "19.99", currencyCode: "USD" });
    const { result } = withSetup(() => useMoney(money, { locale: "en-US" }));
    expect(result.value).toBe("$19.99");
    money.value = { amount: "5.00", currencyCode: "USD" };
    await nextTick();
    expect(result.value).toBe("$5.00");
  });
});

const product: Product = {
  id: "p1",
  handle: "tee",
  title: "Tee",
  description: "",
  options: [
    { name: "Size", values: ["S", "M"] },
    { name: "Color", values: ["Black", "White"] },
  ],
  variants: [
    {
      id: "v1",
      title: "S / Black",
      availableForSale: true,
      price: { amount: "20.00", currencyCode: "USD" },
      selectedOptions: [
        { name: "Size", value: "S" },
        { name: "Color", value: "Black" },
      ],
    },
    {
      id: "v2",
      title: "S / White",
      availableForSale: true,
      price: { amount: "20.00", currencyCode: "USD" },
      selectedOptions: [
        { name: "Size", value: "S" },
        { name: "Color", value: "White" },
      ],
    },
  ],
};

describe("useVariantSelection", () => {
  it("resolves the variant and updates on setOption", async () => {
    const { result } = withSetup(() => useVariantSelection(product));
    expect(result.selectedVariant.value?.id).toBe("v1");
    result.setOption("Color", "White");
    await nextTick();
    expect(result.selectedVariant.value?.id).toBe("v2");
  });
});

describe("i18n composables", () => {
  const i18n = createI18n({
    strategy: "pathname",
    defaultLocale: "en-US",
    locales: [
      { id: "en-US", language: "EN", country: "US" },
      { id: "fr-CA", language: "FR", country: "CA" },
    ],
  });

  it("provides the active locale and localizes paths", () => {
    const frCA = i18n.byId("fr-CA") as Locale;
    let localeId = "";
    let path = "";

    const Child = defineComponent({
      setup() {
        localeId = useLocale().id;
        path = useLocalizedPath()("/products/tee");
        return () => h("div");
      },
    });
    const Parent = defineComponent({
      setup() {
        provideI18n({ i18n, locale: frCA });
        return () => h(Child);
      },
    });
    mount(Parent);

    expect(localeId).toBe("fr-CA");
    expect(path).toBe("/fr-ca/products/tee");
  });
});
