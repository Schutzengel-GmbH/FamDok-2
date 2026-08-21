import { UserPipe } from './user.pipe';

describe('UserPipe', () => {
  const pipe = new UserPipe();

  it('renders first and last name when a last name is set', () => {
    const user = { firstName: 'Anna', lastName: 'Muster', email: 'a@b.de' } as any;

    expect(pipe.transform(user)).toBe('Anna Muster');
  });

  it('renders just the last name when no first name is set', () => {
    const user = { firstName: '', lastName: 'Muster', email: 'a@b.de' } as any;

    expect(pipe.transform(user)).toBe('Muster');
  });

  it('renders just the first name when no last name is set', () => {
    const user = { firstName: 'Anna', lastName: '', email: 'a@b.de' } as any;

    expect(pipe.transform(user)).toBe('Anna');
  });

  it('falls back to the email when neither name is set', () => {
    const user = { firstName: '', lastName: '', email: 'a@b.de' } as any;

    expect(pipe.transform(user)).toBe('a@b.de');
  });

  it('renders an anonymized user as its org label', () => {
    const anonUser = {
      id: 'u1',
      organisation: { name: 'Org 1' },
      subOrganisations: [{ name: 'Sub 2' }],
    } as any;

    expect(pipe.transform(anonUser)).toBe('Org 1 - Sub 2');
  });
});
