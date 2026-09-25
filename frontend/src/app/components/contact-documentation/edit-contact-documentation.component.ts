import {
  Component,
  effect,
  inject,
  input,
  linkedSignal,
  OnChanges,
  signal,
} from '@angular/core';
import {
  FullCase,
  FullContactDocumentation,
} from '../../../../../shared/types';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastService } from 'src/app/services/toast.service';
import { SelectCaseComponent } from '../select-case/select-case';
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ContactDocumentationOptions } from '../../../../../shared/sharedGlobals';
import { Router } from '@angular/router';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-edit-contact-documentation',
  standalone: true,
  imports: [
    FormsModule,
    NgSelectComponent,
    ReactiveFormsModule,
    SelectCaseComponent,
    NgbDatepickerModule,
  ],
  templateUrl: './edit-contact-documentation.component.html',
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
  ],
})
export class EditContactDocumentation implements OnChanges {
  doc = input<FullContactDocumentation>();

  protected start = linkedSignal(() =>
    this.doc()?.start ? this.dateToTimeString(this.doc()!.start!) : '00:00',
  );
  protected end = linkedSignal(() =>
    this.doc()?.end ? this.dateToTimeString(this.doc()!.end!) : '00:00',
  );

  protected setDurationViaTime = signal(false);

  private documentationService = inject(ContactDocumentationService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private dialogService = inject(ConfirmDialogService);

  protected form!: FormGroup;

  initialCase = input<FullCase>();
  isNew = input<boolean>(false);
  readOnly = input(false);

  options = ContactDocumentationOptions;
  case = linkedSignal<FullCase | undefined>(() => this.initialCase());

  protected activeTab = signal<'daten' | 'dokumentation'>('daten');

  private draftCreated = false;

  constructor() {
    effect(() => {
      if (!this.isNew() || this.doc() || this.draftCreated) return;

      const caseId = this.initialCase()?.id ?? this.case()?.id;
      if (!caseId) return;

      this.draftCreated = true;
      this.documentationService
        .createDocumentation(caseId, { case: { connect: { id: caseId } } })
        .subscribe((doc) => {
          this.router.navigate(['contact-documentation', caseId, doc.id], {
            replaceUrl: true,
          });
        });
    });
  }

  onCaseChange(c: FullCase | undefined) {
    this.case.set(c);
  }

  setActiveTab(tab: 'daten' | 'dokumentation') {
    if (tab === this.activeTab()) return;
    if (this.form.dirty) this.save(false);
    this.activeTab.set(tab);
  }

  ngOnChanges() {
    const doc = this.doc();
    const {
      duration,
      artDerBetreuung,
      beratungsThemenAllgemein,
      beratungsThemenEltern,
      beratungsThemenKinder,
      zusammenfassung,
      dokumentation,
    } = doc ? doc : {};
    this.form = this.fb.group({
      date: [doc?.date, Validators.required],
      duration: [duration],
      artDerBetreuung: [artDerBetreuung, Validators.required],
      beratungsThemenEltern: [beratungsThemenEltern ?? []],
      beratungsThemenKinder: [beratungsThemenKinder ?? []],
      beratungsThemenAllgemein: [beratungsThemenAllgemein ?? []],
      zusammenfassung: [zusammenfassung, Validators.required],
      dokumentation: [dokumentation, Validators.required],
    });
    if (this.readOnly()) this.form.disable();
  }

  save(navigateAfterSave = true) {
    const docValue = this.doc();

    let caseId;
    if (this.case()) caseId = this.case()!.id;
    else if (this.initialCase() !== undefined) caseId = this.initialCase()!.id;
    if (!caseId) return;

    const { date, ...formWithoutDate } = this.form.value;

    const onSaved = () => {
      this.form.markAsPristine();
      this.toastService.show({
        title: 'Gespeichert',
        text: `Dokumentation gespeichert.`,
        severity: 'success',
      });
      if (navigateAfterSave) this.router.navigate(['/']);
    };

    if (docValue) {
      this.documentationService
        .updateDocumentation(docValue.caseId, docValue.id, {
          date: this.form.get('date')?.value,
          ...formWithoutDate,
          start: this.setDurationViaTime()
            ? this.timeStringToDate(this.start())
            : null,
          end: this.setDurationViaTime()
            ? this.timeStringToDate(this.end())
            : null,
        })
        .subscribe(onSaved);
    } else {
      this.documentationService
        .createDocumentation(caseId, {
          date: this.form.get('date')!.value,
          ...formWithoutDate,
          start: this.setDurationViaTime()
            ? this.timeStringToDate(this.start())
            : null,
          end: this.setDurationViaTime()
            ? this.timeStringToDate(this.end())
            : null,
          case: {
            connect: { id: caseId },
          },
        })
        .subscribe(onSaved);
    }
  }

  dateToTimeString(date: Date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  timeStringToDate(time: string) {
    const hours = parseInt(time.split(':')[0]);
    const minutes = parseInt(time.split(':')[1]);

    const date = this.doc()?.date ?? new Date();
    date.setHours(hours);
    date.setMinutes(minutes);

    return date;
  }

  delete() {
    this.dialogService.open({
      title: 'Dokumentation löschen?',
      text: 'Soll die Dokumentation wirklich endgültig gelöscht werden?',
      confirmAction: () => {
        const docValue = this.doc()!;
        this.documentationService
          .deleteDocumentation(docValue.caseId, docValue.id)
          .subscribe(() => {
            this.toastService.show({
              title: 'Gelöscht',
              text: `Dokumentation gelöscht.`,
              severity: 'success',
            });
            this.router.navigate(['/']);
          });
      },
    });
  }
}
