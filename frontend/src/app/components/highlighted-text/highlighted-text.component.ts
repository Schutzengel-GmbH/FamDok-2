import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TextSegment } from 'src/app/util/contactDocSearch';

/**
 * Renders text segments inline, wrapping search hits in `<mark>`. The template is kept on one
 * line on purpose: whitespace around interpolations would otherwise end up in the text.
 */
@Component({
  selector: 'app-highlighted-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // prettier-ignore
  template: `@for (s of segments(); track $index) {@if (s.match) {<mark class="search-hit">{{ s.text }}</mark>} @else {<span>{{ s.text }}</span>}}`,
  styles: `
    mark.search-hit {
      padding: 0 0.1em;
      border-radius: 0.2em;
    }
  `,
})
export class HighlightedText {
  segments = input.required<TextSegment[]>();
}
