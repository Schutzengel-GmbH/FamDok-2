import { Injectable } from '@angular/core';
import SuperJSON from 'superjson';
import { sub } from 'date-fns';
import { ChartKey } from '../components/stats/stats-chart-card/stats-chart-card.component';
import {
  GeneralFormModel as GeneralForm,
  QuestionModel as Question,
} from '../../../../shared/generated/prisma/models';
import { FullGeneralForm } from '../../../../shared/types';

interface State {
  range: { start: Date; end: Date };
  city?: string;
  plz?: string;
  selectedDynamicForm?: FullGeneralForm;
  selectedDynamicQuestion?: Question;
  selectedChartKey?: ChartKey;
}

interface StateUpdate {
  range?: { start?: Date; end?: Date };
  city?: string;
  plz?: string;
  selectedDynamicForm?: FullGeneralForm;
  selectedDynamicQuestion?: Question;
  selectedChartKey?: ChartKey;
}

const DEFAULT_STATE = {
  range: { start: sub(new Date(), { years: 1 }), end: new Date() },
};

const STATS_STATE_KEY = 'STATS_STATE';

@Injectable({
  providedIn: 'root',
})
export class StatsDashboardStateService {
  updateState(state: StateUpdate) {
    const curr = this.state;
    localStorage.setItem(
      STATS_STATE_KEY,
      SuperJSON.stringify({ ...curr, ...state }),
    );
  }
  get state(): State {
    const stateString = localStorage.getItem(STATS_STATE_KEY);
    if (!stateString) return DEFAULT_STATE;
    const obj = SuperJSON.parse<State>(stateString);
    return obj;
  }
}
