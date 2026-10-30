/**
 * Request types shared by frontend and backend. Every route accepts exactly one schema from
 * `shared/api`, parsed by `route()` in `backend/util/routerUtils.ts`.
 *
 * Schemas are built from the generated, scalar-only Prisma inputs with `.pick`, so columns are
 * only ever accepted on purpose, and they never accept nested writes - those would reach other
 * records past the auth checks. Relations are plain ids; the controller builds the Prisma write.
 *
 * The frontend must only `import type` from here, to keep the generated schemas out of the bundle.
 */
import * as z from "zod";

type WireValue<T> = T extends Date
  ? Date | string
  : T extends Date[]
    ? Date[] | string[]
    : T extends (infer U)[]
      ? WireValue<U>[]
      : T extends object
        ? { [K in keyof T]: WireValue<T[K]> }
        : T;

/**
 * The type of a request, from the component that builds it to the controller that handles it.
 * `z.input` is no use here: `z.coerce.date()` makes dates `unknown` there. Dates are widened to
 * `Date | string` instead, since they arrive serialized and Prisma accepts either.
 */
export type Wire<S extends z.ZodType> = WireValue<z.output<S>>;
