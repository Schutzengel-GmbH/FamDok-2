import { Request, RequestHandler, Response } from 'express';
import { ZodError, ZodType, output, prettifyError } from 'zod';
import { FullUser } from '../../shared/types';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from './authUtils';

export function handleError(err: unknown, res: Response) {
  console.error(err);

  if (err instanceof BadRequestError)
    res.status(400).json({ message: 'Bad Request', error: err.message });
  else if (err instanceof ZodError)
    res.status(400).json({ message: 'Bad Request', error: prettifyError(err) });
  else if (err instanceof UnauthorizedError)
    res.status(401).json({ message: 'Unauthorized', error: err.message });
  else if (err instanceof ForbiddenError)
    res.status(403).json({ message: 'Forbidden', error: err.message });
  else if (err instanceof NotFoundError)
    res.status(404).json({ message: 'Not Found', error: err.message });
  else if (err instanceof ConflictError)
    res.status(409).json({ message: 'Conflict', error: err.message });
  else if (err instanceof InternalServerError)
    res
      .status(500)
      .json({ message: 'Internal Server Error', error: err.message });
  else
    res.status(500).json({
      message: 'Unexpected Error',
      error: err,
    });
}

type Parsed<S> = S extends ZodType ? output<S> : undefined;

/** What a route handler gets to work with. There is deliberately no `req`: input is parsed or absent. */
export type RouteContext<B, Q> = {
  user: FullUser;
  params: Record<string, string>;
  body: Parsed<B>;
  query: Parsed<Q>;
  file?: Express.Multer.File;
  res: Response;
};

type RouteHandler<B, Q> = (ctx: RouteContext<B, Q>) => unknown;

/** Queries arrive as a single JSON param, `?q=<json>`, built by `toQuery` in the frontend. */
function parseQuery(req: Request, schema: ZodType) {
  const raw = req.query['q'];
  if (raw === undefined) return schema.parse({});
  try {
    return schema.parse(JSON.parse(raw as string));
  } catch (e) {
    if (e instanceof SyntaxError) throw new BadRequestError('Invalid query');
    throw e;
  }
}

/**
 * The way into a controller: parses the request with the schemas from `shared/api` and sends
 * what the handler returns. A handler that responds itself (downloads) returns nothing.
 */
export function route<B extends ZodType | undefined, Q extends ZodType | undefined>(
  schemas: { body?: B; query?: Q },
  handler: RouteHandler<B, Q>
): RequestHandler;
export function route(handler: RouteHandler<undefined, undefined>): RequestHandler;
export function route(
  schemasOrHandler:
    | { body?: ZodType; query?: ZodType }
    | RouteHandler<undefined, undefined>,
  maybeHandler?: RouteHandler<any, any>
): RequestHandler {
  const schemas =
    typeof schemasOrHandler === 'function' ? {} : schemasOrHandler;
  const handler =
    typeof schemasOrHandler === 'function' ? schemasOrHandler : maybeHandler!;

  return async (req, res) => {
    try {
      const result = await handler({
        user: req.user!,
        params: req.params as Record<string, string>,
        body: schemas.body?.parse(req.body),
        query: schemas.query && parseQuery(req, schemas.query),
        file: req.file,
        res,
      } as RouteContext<any, any>);

      if (!res.headersSent) res.json(result);
    } catch (e) {
      handleError(e, res);
    }
  };
}
