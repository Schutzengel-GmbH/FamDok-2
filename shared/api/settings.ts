import * as z from "zod";
import { Wire } from "./common";

export const SettingsKeys = z.literal([
  "closing_doc",
  "personal_data_retention_days",
]);

export const Settings = z.partialRecord(SettingsKeys, z.string());

/** Body of `PUT /settings/:name` */
export const SettingUpdateRequest = z.strictObject({ value: z.string() });
export type SettingUpdateRequest = Wire<typeof SettingUpdateRequest>;
