export interface DefaultSpecification {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  icon: string;
  accent: string;
}

/** Published specifications offered as shortcuts on the landing page. */
export const defaultSpecifications: DefaultSpecification[] = [
  {
    id: "dsv-dap",
    title: "DSV-DAP",
    subtitle: "Vocabulary · Application Profile",
    description:
      "Data Specification Vocabulary Default Application Profile for describing application profiles.",
    url: "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/",
    icon: "DSV",
    accent: "#2454d6",
  },
  {
    id: "dcat-ap",
    title: "DCAT-AP 3.0.1",
    subtitle: "Application Profile",
    description:
      "DCAT Application Profile for interoperable dataset, distribution and data-service descriptions.",
    url: "https://mff-uk.github.io/specifications/dcat-ap/",
    icon: "AP",
    accent: "#163d9f",
  },
  {
    id: "dcat-dap",
    title: "DCAT-DAP",
    subtitle: "Application Profile",
    description: "DCAT Default Application Profile published for the Dataspecer ecosystem.",
    url: "https://mff-uk.github.io/specifications/dcat-dap/",
    icon: "DAP",
    accent: "#5c5f61",
  },
  {
    id: "dsv",
    title: "DSV",
    subtitle: "Vocabulary",
    description: "The Data Specification Vocabulary used to describe semantic specifications.",
    url: "https://mff-uk.github.io/data-specification-vocabulary/dsv/",
    icon: "DSV",
    accent: "#44474a",
  },
];
