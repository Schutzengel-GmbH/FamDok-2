import { Injectable, signal } from '@angular/core';
import { Optional } from '../util/typeUtils';

type ConfirmDialog = {
  id: string;
  title: string;
  text: string;
  style: 'default' | 'success' | 'warning' | 'danger';
  confirmAction: () => void;
  cancelAction: () => void;
};

export type ConfirmDialogProps = Optional<
  Omit<ConfirmDialog, 'id'>,
  'cancelAction' | 'style'
>;

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private _openDialogs = signal<ConfirmDialog[]>([]);
  openDialogs = this._openDialogs.asReadonly();

  open(props: ConfirmDialogProps) {
    const id = crypto.randomUUID();
    const dialog: ConfirmDialog = {
      id,
      title: props.title,
      text: props.text,
      style: props.style || 'default',
      confirmAction: () => {
        props.confirmAction();
        this._openDialogs.update((dialogs) =>
          dialogs.filter((d) => d.id !== id),
        );
      },
      cancelAction: () => {
        if (props.cancelAction) props.cancelAction();
        this._openDialogs.update((dialogs) =>
          dialogs.filter((d) => d.id !== id),
        );
      },
    };
    this._openDialogs.update((d) => [...d, dialog]);
  }
}
