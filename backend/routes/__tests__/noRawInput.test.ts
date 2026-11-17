import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Routes get their input from `route()`, parsed with a schema from `shared/api`. Reading it from
 * `req` would bypass that - and `req.body` is `any`, so the compiler wouldn't object.
 */
describe('routers', () => {
  const dir = join(__dirname, '..');
  const routers = readdirSync(dir).filter((file) => file.endsWith('.ts'));

  it('finds the routers', () => {
    expect(routers.length).toBeGreaterThan(0);
  });

  it.each(routers)('%s does not read raw input', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');

    expect(source).not.toMatch(/\breq\.(body|query)\b/);
  });
});
