import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';

import { HandoverBrief } from './handover-brief';
import { buildUser } from 'src/app/testing/fixtures';

describe('HandoverBrief', () => {
  let fixture: ComponentFixture<HandoverBrief>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HandoverBrief],
    }).compileComponents();

    fixture = TestBed.createComponent(HandoverBrief);
  });

  function setHandover(overrides: Record<string, any> = {}) {
    fixture.componentRef.setInput('handover', {
      caseId: 'case-1',
      date: new Date('2024-03-01'),
      removedIds: [],
      addedIds: [],
      added: [],
      removed: [],
      ...overrides,
    } as any);
    fixture.detectChanges();
  }

  it('renders the handover date formatted via the date pipe', () => {
    const date = new Date('2024-03-01');
    setHandover({ date });

    const expected = new DatePipe('en-US').transform(date);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(expected);
  });

  it('renders one "+" line per added user, using the user pipe', () => {
    const added = [
      buildUser({ firstName: 'Anna', lastName: 'Muster' }),
      buildUser({ firstName: 'Ben', lastName: 'Beispiel' }),
    ];
    setHandover({ added, removed: [] });

    const paragraphs: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('p'),
    ).map((p: any) => p.textContent.trim());

    expect(paragraphs).toContain('+ Anna Muster');
    expect(paragraphs).toContain('+ Ben Beispiel');
  });

  it('renders one "-" line per removed user', () => {
    const removed = [buildUser({ firstName: 'Carla', lastName: 'Weg' })];
    setHandover({ added: [], removed });

    const paragraphs: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('p'),
    ).map((p: any) => p.textContent.trim());

    expect(paragraphs).toContain('- Carla Weg');
  });

  it('renders just the first name via the user pipe when a user has no last name', () => {
    const added = [
      buildUser({ firstName: 'Anna', lastName: null, email: 'anna@example.com' }),
    ];
    setHandover({ added, removed: [] });

    expect(fixture.nativeElement.textContent).toContain('+ Anna');
  });

  it('falls back to the email via the user pipe when a user has no name at all', () => {
    const added = [
      buildUser({ firstName: null, lastName: null, email: 'anna@example.com' }),
    ];
    setHandover({ added, removed: [] });

    expect(fixture.nativeElement.textContent).toContain('+ anna@example.com');
  });

  it('shows the notes paragraph when notes are present', () => {
    setHandover({ notes: 'Wichtige Info' });

    expect(fixture.nativeElement.textContent).toContain('Notizen: Wichtige Info');
  });

  it('does not show a notes paragraph when there are no notes', () => {
    setHandover({ notes: undefined });

    expect(fixture.nativeElement.textContent).not.toContain('Notizen:');
  });
});
