import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  caseFormDefinitionSchema,
  generalFormDefinitionSchema,
  safeParseJson,
} from 'src/app/util/validation';
import { FamilyService } from 'src/app/services/family.service';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from 'src/app/services/toast.service';
import { GeneralFormService } from 'src/app/services/general-form.service';
import {
  CaseFormCreateInput,
  GeneralFormCreateInput,
} from '../../../../../shared/generated/prisma/models';
import {
  parseGeneralForm,
  parseCaseForm,
} from '../../../../../shared/utils/parseForm';
import { CaseFormService } from 'src/app/services/case-form.service';

//TODO: clear files on form type change, make sure we can't upload the wrong type
@Component({
  selector: 'app-import-survey-definition',
  standalone: true,
  imports: [FormsModule, NgbTooltip],
  templateUrl: './import-survey-definition.html',
  styleUrl: './import-survey-definition.scss',
})
export class ImportSurveyDefinitionComponent {
  private fileReader = new FileReader();
  private caseFormService = inject(CaseFormService);
  private formService = inject(GeneralFormService);
  private toast = inject(ToastService);

  files!: FileList;
  input!: CaseFormCreateInput | GeneralFormCreateInput | undefined;
  fileValid = signal<boolean>(false);
  classNames = signal<string>('bi bi-square');
  importGeneralForm = signal<boolean>(false);

  constructor() {
    this.fileReader.onload = (e) => {
      if (this.importGeneralForm()) {
        try {
          this.input = parseGeneralForm(this.fileReader.result as string);
          this.fileValid.set(true);
          this.classNames.set('bi bi-check-square text-success');
        } catch (e) {
          this.fileValid.set(false);
          this.classNames.set('bi bi-x-square text-danger');
        }
      } else {
        try {
          this.input = parseCaseForm(this.fileReader.result as string);
          this.fileValid.set(true);
          this.classNames.set('bi bi-check-square text-success');
        } catch (e) {
          this.fileValid.set(false);
          this.classNames.set('bi bi-x-square text-danger');
        }
      }
    };
  }

  changeType() {
    this.importGeneralForm.set(!this.importGeneralForm());
  }

  filesChanged(e: any) {
    this.files = e.target.files;
    if (this.files.length > 0) {
      this.fileReader.readAsText(this.files.item(0)!);
    }
  }

  save() {
    if (this.importGeneralForm()) {
      this.formService
        .createDefinition(this.input! as GeneralFormCreateInput)
        .subscribe((res) => {
          this.toast.show({
            title: 'Erfolg',
            text: `Formular ${res.name} erfolgreich hinzugefügt`,
            severity: 'success',
          });
        });
    } else {
      this.caseFormService
        .createCaseFormDefinition(this.input! as CaseFormCreateInput)
        .subscribe((res) => {
          this.toast.show({
            title: 'Erfolg',
            text: `Formular ${res.name} erfolgreich hinzugefügt`,
            severity: 'success',
          });
        });
    }
  }

  tooltip() {
    if (!this.files || this.files.length < 1) return 'Keine Datei ausgewählt';
    return this.fileValid() ? '' : 'Die Datei enthält kein valides Formular';
  }
}
