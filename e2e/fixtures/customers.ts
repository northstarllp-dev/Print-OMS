/** Realistic signage-business customers for E2E tests */

export type CustomerFixture = {
  name: string;
  businessName: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  location: string;
  productType: string;
  kind:
    | "corporate"
    | "walkin"
    | "returning"
    | "vip"
    | "large"
    | "small";
};

const runId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Unique per call so parallel-ish runs never collide on phone/email. */
export function makeCustomer(
  kind: CustomerFixture["kind"] = "corporate"
): CustomerFixture {
  const id = runId();
  const base: Record<CustomerFixture["kind"], Omit<CustomerFixture, "phone" | "whatsapp" | "email"> & { phoneSuffix: string }> = {
    corporate: {
      kind: "corporate",
      name: "Dr. Ananya Reddy",
      businessName: `Sunrise Dental Clinic ${id}`,
      city: "Bengaluru",
      location: "Indiranagar, Bengaluru",
      productType: "3D LED Letters",
      phoneSuffix: "01",
    },
    walkin: {
      kind: "walkin",
      name: "Suresh Patil",
      businessName: `Kailash Motors ${id}`,
      city: "Pune",
      location: "FC Road, Pune",
      productType: "ACP Sign Board",
      phoneSuffix: "02",
    },
    returning: {
      kind: "returning",
      name: "Neha Kapoor",
      businessName: `Bloom Boutique ${id}`,
      city: "Mumbai",
      location: "Bandra West, Mumbai",
      productType: "Vinyl Graphics",
      phoneSuffix: "03",
    },
    vip: {
      kind: "vip",
      name: "Rajesh Malhotra",
      businessName: `Malhotra Hotels ${id}`,
      city: "Delhi",
      location: "Connaught Place, New Delhi",
      productType: "3D LED Letters",
      phoneSuffix: "04",
    },
    large: {
      kind: "large",
      name: "Vikram Shah",
      businessName: `Metro Mall Holdings ${id}`,
      city: "Hyderabad",
      location: "Gachibowli, Hyderabad",
      productType: "ACP Sign Board",
      phoneSuffix: "05",
    },
    small: {
      kind: "small",
      name: "Fatima Begum",
      businessName: `Cafe Noor ${id}`,
      city: "Chennai",
      location: "T Nagar, Chennai",
      productType: "Vinyl Graphics",
      phoneSuffix: "06",
    },
  };

  const t = base[kind];
  // Unique 10-digit Indian mobile derived from run id hash
  const digits = Array.from(id)
    .map((c) => c.charCodeAt(0) % 10)
    .join("")
    .padEnd(8, "7")
    .slice(0, 8);
  const phone = `98${digits}${t.phoneSuffix}`.slice(0, 10);

  return {
    kind: t.kind,
    name: t.name,
    businessName: t.businessName,
    city: t.city,
    location: t.location,
    productType: t.productType,
    phone,
    whatsapp: phone,
    email: `${kind}.${id}@e2e.printoms.test`,
  };
}

export const corporateCustomer = () => makeCustomer("corporate");
export const walkInCustomer = () => makeCustomer("walkin");
export const vipCustomer = () => makeCustomer("vip");
export const largeProjectCustomer = () => makeCustomer("large");
export const smallProjectCustomer = () => makeCustomer("small");
