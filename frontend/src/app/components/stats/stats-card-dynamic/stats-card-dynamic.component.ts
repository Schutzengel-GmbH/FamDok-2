import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { GeneralFormService } from 'src/app/services/general-form.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { map, Subject } from 'rxjs';
import { StatsDashboardStateService } from 'src/app/services/stats-dashoard-state.service';
import {
  GeneralFormModel as GeneralForm,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';
import { FullGeneralForm } from '../../../../../../shared/types';

@Component({
  selector: 'app-stats-card-dynamic',
  templateUrl: './stats-card-dynamic.component.html',
  standalone: true,
  styleUrls: ['../stats-card-styles.scss'],
  imports: [NgSelectComponent, FormsModule],
})
export class StatsCardDynamicComponent {
  private formService = inject(GeneralFormService);
  private stateService = inject(StatsDashboardStateService);
  range = input<{ start: Date; end: Date }>(this.stateService.state.range);

  constructor() {
    effect(() => {
      this.refreshValue();
      this.stateService.updateState({
        selectedDynamicForm: this.selectedForm(),
        selectedDynamicQuestion: this.selectedQuestion(),
      });
    });
  }

  forms$ = this.formService.getDefinitions({
    AND: [
      {
        questions: {
          some: { type: 'Date', text: 'Datum' },
        },
      },
      {
        OR: [
          {
            questions: {
              some: { type: 'Integer' },
            },
          },
          {
            questions: {
              some: { type: 'Float' },
            },
          },
        ],
      },
    ],
  });
  forms = toSignal(this.forms$);

  selectedForm = signal<FullGeneralForm | undefined>(
    this.stateService.state.selectedDynamicForm,
  );
  dateQuestion = computed(() =>
    this.selectedForm()?.questions?.find((q) => q.type === 'Date'),
  );

  questions = computed(() =>
    this.selectedForm()
      ? this.selectedForm()!.questions?.filter(
          (q) => q.type === 'Integer' || q.type === 'Float',
        )
      : [],
  );

  selectedQuestion = signal<Question | undefined>(
    this.stateService.state.selectedDynamicQuestion,
  );

  // TODO: maybe collect all the values in an array and provide total, average, median?
  value$ = new Subject<number>();

  refreshValue() {
    if (!this.selectedForm() || !this.selectedQuestion()) return;
    this.formService
      .getResponsesForDefinition(this.selectedForm()!.id, {
        answers: {
          some: {
            questionId: this.dateQuestion()?.id,
            answerDate: {
              gte: this.range()?.start.toISOString(),
              lte: this.range()?.end.toISOString(),
            },
          },
        },
      })
      .pipe(
        map((res) => {
          return res.reduce((acc, r) => {
            const answer = r.answers.find(
              (a) => a.questionId === this.selectedQuestion()!.id,
            );
            if (!answer) return acc;
            if (this.selectedQuestion()!.type === 'Integer')
              return (answer.answerInt || 0) + acc;
            if (this.selectedQuestion()!.type === 'Float')
              return (answer.answerNum || 0) + acc;
            return acc;
          }, 0);
        }),
      )
      .subscribe((v) => this.value$.next(v));
  }

  value = toSignal(this.value$);
}
