import { z } from 'zod';
import { route } from '../routerUtils';
import { ForbiddenError } from '../authUtils';
import { buildUser } from '../../testUtils/fixtures';

function run(
  handler: ReturnType<typeof route>,
  req: Record<string, unknown> = {}
) {
  const res: any = { headersSent: false };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  const fullReq = { user: buildUser(), params: {}, query: {}, ...req };
  return (handler as any)(fullReq, res).then(() => res);
}

describe('route', () => {
  const Schema = z.strictObject({ name: z.string() });

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  it('hands the parsed body to the handler and sends the result', async () => {
    const handler = jest.fn(({ body }) => ({ got: body.name }));

    const res = await run(route({ body: Schema }, handler), {
      body: { name: 'x' },
    });

    expect(res.json).toHaveBeenCalledWith({ got: 'x' });
  });

  it('answers 400 without calling the handler for an invalid body', async () => {
    const handler = jest.fn();

    const res = await run(route({ body: Schema }, handler), {
      body: { name: 'x', role: 'Admin' },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('decodes the query from the `q` param', async () => {
    const handler = jest.fn(({ query }) => query);

    const res = await run(route({ query: Schema }, handler), {
      query: { q: '{"name":"x"}' },
    });

    expect(res.json).toHaveBeenCalledWith({ name: 'x' });
  });

  it('answers 400 for malformed query JSON', async () => {
    const handler = jest.fn();

    const res = await run(route({ query: Schema }, handler), {
      query: { q: '{' },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not expose unparsed input to the handler', async () => {
    const handler = jest.fn(({ body, query }) => ({ body, query }));

    const res = await run(route(handler), {
      body: { role: 'Admin' },
      query: { q: '{}' },
    });

    expect(res.json).toHaveBeenCalledWith({
      body: undefined,
      query: undefined,
    });
  });

  it('leaves the response alone when the handler already sent one', async () => {
    const res: any = { headersSent: true, json: jest.fn() };

    await (route(() => undefined) as any)(
      { user: buildUser(), params: {}, query: {} },
      res
    );

    expect(res.json).not.toHaveBeenCalled();
  });

  it('routes errors through handleError', async () => {
    const res = await run(
      route(() => {
        throw new ForbiddenError();
      })
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
