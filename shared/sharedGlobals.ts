import { QuestionModel as Question } from "./generated/prisma/models";

export type { PrismaJson };

export enum BETREUUNG_ID {
  HAUSBESUCH = 0,
  TELEFONAT,
  ONLINE,
  BEGLEITUNG,
  NEUTRAL,
  NICHT_STATTGEFUNDEN,
  RECHERCHE,
}

export enum BERATUNG_ELTERN_ID {
  SUCHT = 0,
  MANGELNDE_SELBSTFUERSORGE,
  PSYCHISCHE_ERKRANKUNG,
  PSYCHISCHE_BELASTUNGEN,
  KOERPERLICHE_BEHINDERUNG,
  GEISTIGE_BEHINDERUNG,
  MIGRATION,
  MINDERJAEHRIGKEIT,
  KOERPERLICHE_ERKRANKUNG,
  GESUNDHEITSTHEMEN,
}

export enum BERATUNG_KINDER_ID {
  KOERPERLICHE_BEHINDERUNG = 0,
  GEISTIGE_BEHINDERUNG,
  GEWICHTSENTWICKLUNG,
  PFLEGE,
  KOERPERLICHE_ENTWICKLUNG,
  MOTORISCHE_ENTWICKLUNG,
  SPRACHLICHE_ENTWICKLUNG,
  SOZIALE_ENTWICKLUNG,
  KOERPERLICHE_ERKRANKUNG,
  GESUNDHEITSTHEMEN,
}

export enum BERATUNG_ALLGEMEIN_ID {
  PARTNERSCHAFTSKONFLIKTE = 0,
  WOHNSITUATION,
  ALLEINERZIEHEND,
  FINANZEN,
  BUEROKRATIE,
  BINDUNG,
  ERZIEHUNGSKOMPETENZ,
  SOZIALKOMPETENZ,
  GEWALTTAETIGES_UMFELD,
  MEHRLINGE,
  TOT_UND_FEHLGEBURT,
}

export const ContactDocumentationOptions: Record<
  string,
  PrismaJson.SelectOption[]
> = {
  artDerBetreuung: [
    { id: BETREUUNG_ID.HAUSBESUCH, text: "Hausbesuch" },
    { id: BETREUUNG_ID.TELEFONAT, text: "Telefonat" },
    { id: BETREUUNG_ID.ONLINE, text: "Online" },
    { id: BETREUUNG_ID.BEGLEITUNG, text: "Begleitung" },
    { id: BETREUUNG_ID.NEUTRAL, text: "Treffen in neutralem Raum" },
    {
      id: BETREUUNG_ID.NICHT_STATTGEFUNDEN,
      text: "Nicht stattgefundener Hausbesuch",
    },
    { id: BETREUUNG_ID.RECHERCHE, text: "Recherche" },
  ],
  beratungsThemenEltern: [
    { id: BERATUNG_ELTERN_ID.SUCHT, text: "Sucht" },
    {
      id: BERATUNG_ELTERN_ID.MANGELNDE_SELBSTFUERSORGE,
      text: "Mangelnde Selbstfürsorge",
    },
    {
      id: BERATUNG_ELTERN_ID.PSYCHISCHE_ERKRANKUNG,
      text: "Psychische Erkrankung (mit Diagnose)",
    },
    {
      id: BERATUNG_ELTERN_ID.PSYCHISCHE_BELASTUNGEN,
      text: "Psychische Belastungen",
    },
    {
      id: BERATUNG_ELTERN_ID.KOERPERLICHE_BEHINDERUNG,
      text: "Körperliche Behinderung",
    },
    {
      id: BERATUNG_ELTERN_ID.GEISTIGE_BEHINDERUNG,
      text: "Geistige Behinderung",
    },
    { id: BERATUNG_ELTERN_ID.MIGRATION, text: "Migration" },
    { id: BERATUNG_ELTERN_ID.MINDERJAEHRIGKEIT, text: "Minderjährigkeit" },
    {
      id: BERATUNG_ELTERN_ID.KOERPERLICHE_ERKRANKUNG,
      text: "Akute oder chronische körperliche Erkrankung",
    },
    { id: BERATUNG_ELTERN_ID.GESUNDHEITSTHEMEN, text: "Gesundheitsthemen" },
  ],
  beratungsThemenKinder: [
    {
      id: BERATUNG_KINDER_ID.KOERPERLICHE_BEHINDERUNG,
      text: "Körperliche Behinderung",
    },
    {
      id: BERATUNG_KINDER_ID.GEISTIGE_BEHINDERUNG,
      text: "Geistige Behinderung",
    },
    { id: BERATUNG_KINDER_ID.GEWICHTSENTWICKLUNG, text: "Gewichtsentwicklung" },
    { id: BERATUNG_KINDER_ID.PFLEGE, text: "Pflege" },
    {
      id: BERATUNG_KINDER_ID.KOERPERLICHE_ENTWICKLUNG,
      text: "Körperliche Entwicklung",
    },
    {
      id: BERATUNG_KINDER_ID.MOTORISCHE_ENTWICKLUNG,
      text: "Motorische Entwicklung",
    },
    {
      id: BERATUNG_KINDER_ID.SPRACHLICHE_ENTWICKLUNG,
      text: "Sprachliche Entwicklung",
    },
    { id: BERATUNG_KINDER_ID.SOZIALE_ENTWICKLUNG, text: "Soziale Entwicklung" },
    {
      id: BERATUNG_KINDER_ID.KOERPERLICHE_ERKRANKUNG,
      text: "Akute oder chronische körperliche Erkrankung",
    },
    { id: BERATUNG_KINDER_ID.GESUNDHEITSTHEMEN, text: "Gesundheitsthemen" },
  ],
  beratungsThemenAllgemein: [
    {
      id: BERATUNG_ALLGEMEIN_ID.PARTNERSCHAFTSKONFLIKTE,
      text: "Partnerschaftskonflikte",
    },
    { id: BERATUNG_ALLGEMEIN_ID.WOHNSITUATION, text: "Wohnsituation" },
    { id: BERATUNG_ALLGEMEIN_ID.ALLEINERZIEHEND, text: "Alleinerziehend" },
    { id: BERATUNG_ALLGEMEIN_ID.FINANZEN, text: "Finanzen" },
    { id: BERATUNG_ALLGEMEIN_ID.BUEROKRATIE, text: "Bürokratie" },
    { id: BERATUNG_ALLGEMEIN_ID.BINDUNG, text: "Bindung" },
    {
      id: BERATUNG_ALLGEMEIN_ID.ERZIEHUNGSKOMPETENZ,
      text: "Erziehungskompetenz",
    },
    { id: BERATUNG_ALLGEMEIN_ID.SOZIALKOMPETENZ, text: "Sozialkompetenz" },
    {
      id: BERATUNG_ALLGEMEIN_ID.GEWALTTAETIGES_UMFELD,
      text: "Gewalttätiges Umfeld",
    },
    { id: BERATUNG_ALLGEMEIN_ID.MEHRLINGE, text: "Mehrlinge" },
    {
      id: BERATUNG_ALLGEMEIN_ID.TOT_UND_FEHLGEBURT,
      text: "Tot- und Fehlgeburt",
    },
  ],
};

declare global {
  namespace PrismaJson {
    type SelectOption = {
      id: number;
      text: string;
      isOpen?: boolean;
    };

    type CaseFormResponse = {
      answers: Answer[];
    };

    type GeneralFormDefinition = {
      questions: Question[];
    };

    type GeneralFormResponse = {
      answers: Answer[];
    };

    type ContactDocumentationResponse = {
      duration: number;
      artDerBetreuung: SelectOption;
      beratungsThemenEltern: SelectOption[];
      beratungsThemenKinder: SelectOption[];
      beratungsThemenAllgemein: SelectOption[];
      zusammenfassung?: string;
      dokumentation?: string;
    };

    type ClosingDocumentationResponse = {
      answers: Answer[];
    };

    type Answer =
      | TextAnswer
      | FloatAnswer
      | IntegerAnswer
      | DateAnswer
      | SelectAnswer
      | null;

    type TextAnswer = { answer?: string };

    type FloatAnswer = { answer?: number };

    type IntegerAnswer = { answer?: number };

    type DateAnswer = { answer?: Date };

    type SelectAnswer = { answer?: SelectOption[] };

    type Address = {
      street: string;
      number: string;
      plz: string;
      city: string;
    };

    type HealthDataPointChild = {
      date: Date;
      weightKg?: number;
      sizeCm?: number;
    };
  }
}
