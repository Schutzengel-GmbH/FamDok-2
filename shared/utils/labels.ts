import { Familienstand, Gender, Relation } from "../generated/prisma/enums";

export const FAMILIENSTAND_LABELS: Record<Familienstand, string> = {
  ledig: "Ledig",
  verheiratet: "Verheiratet",
  geschieden: "Geschieden",
  verwitwet: "Verwitwet",
  unspecified: "Keine Angabe",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Männlich",
  female: "Weiblich",
  other: "Anderes",
  unspecified: "Keine Angabe",
};

export const RELATION_LABELS: Record<Relation, string> = {
  mother: "Mutter",
  father: "Vater",
  grandparent: "Großeltern",
  partner: "Partner",
  other: "Anderes",
};
