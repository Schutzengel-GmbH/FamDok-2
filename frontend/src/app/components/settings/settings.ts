import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MeService } from 'src/app/services/me.service';
import { GeneralFormService } from 'src/app/services/general-form.service';
import { CaseFormService } from 'src/app/services/case-form.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';
import {
  FullCaseForm,
  FullGeneralForm,
  FullOrganisation,
  FullSubOrganisation,
} from '../../../../../shared/types';
import {
  exportCaseForm,
  exportGeneralForm,
} from '../../../../../shared/utils/parseForm';
import { OrgService } from 'src/app/services/organisation.service';
import { NameModalComponent } from './modals/name-modal/name-modal';

@Component({
  selector: 'app-settings',
  imports: [AsyncPipe, RouterLink],
  standalone: true,
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private generalFormService = inject(GeneralFormService);
  private caseFormService = inject(CaseFormService);
  private orgService = inject(OrgService);
  private dialogService = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private modalService = inject(NgbModal);

  user$ = inject(MeService).getMe();

  protected generalForms: FullGeneralForm[] = [];
  protected caseForms: FullCaseForm[] = [];
  protected orgs: FullOrganisation[] = [];

  constructor() {
    this.loadGeneralForms();
    this.loadCaseForms();
    this.loadOrgs();
  }

  private loadGeneralForms() {
    this.generalFormService
      .getDefinitions()
      .subscribe((forms) => (this.generalForms = forms ?? []));
  }

  private loadCaseForms() {
    this.caseFormService
      .getCaseForms()
      .subscribe((forms) => (this.caseForms = forms ?? []));
  }

  private loadOrgs() {
    this.orgService.getAll().subscribe((orgs) => (this.orgs = orgs ?? []));
  }

  downloadGeneralForm(form: FullGeneralForm) {
    this.downloadJson(form.name, exportGeneralForm(form));
  }

  downloadCaseForm(form: FullCaseForm) {
    this.downloadJson(form.name, exportCaseForm(form));
  }

  private downloadJson(name: string, data: unknown) {
    const filename = name.replace(/[\\/:*?"<>|]/g, '_') + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  addOrg() {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Organisation hinzufügen';
    modalRef.componentInstance.label = 'Name der Organisation';
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.orgService.create({ name: result.value }).subscribe({
        next: () => {
          this.toast.show({
            title: 'Erstellt',
            text: `Organisation "${result.value}" wurde erstellt.`,
            severity: 'success',
          });
          this.loadOrgs();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Erstellen ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  editOrg(org: FullOrganisation) {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Organisation bearbeiten';
    modalRef.componentInstance.label = 'Name der Organisation';
    modalRef.componentInstance.name = org.name;
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.orgService.update(org.id, { name: result.value }).subscribe({
        next: () => {
          this.toast.show({
            title: 'Gespeichert',
            text: `Organisation wurde umbenannt in "${result.value}".`,
            severity: 'success',
          });
          this.loadOrgs();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Speichern ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  deleteOrg(org: FullOrganisation) {
    this.dialogService.open({
      title: 'Organisation löschen?',
      text:
        `Soll die Organisation "${org.name}" wirklich gelöscht werden? ` +
        'Alle zugehörigen Unterorganisationen werden dabei ebenfalls gelöscht.',
      style: 'danger',
      confirmAction: () => {
        this.orgService.delete(org.id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: `Organisation "${org.name}" wurde gelöscht.`,
              severity: 'success',
            });
            this.loadOrgs();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Löschen ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
      },
    });
  }

  addSubOrg(org: FullOrganisation) {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Unterorganisation hinzufügen';
    modalRef.componentInstance.label = 'Name der Unterorganisation';
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.orgService
        .update(org.id, { subOrganisations: { create: { name: result.value } } })
        .subscribe({
          next: () => {
            this.toast.show({
              title: 'Erstellt',
              text: `Unterorganisation "${result.value}" wurde erstellt.`,
              severity: 'success',
            });
            this.loadOrgs();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Erstellen ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
    });
  }

  editSubOrg(subOrg: FullSubOrganisation) {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Unterorganisation bearbeiten';
    modalRef.componentInstance.label = 'Name der Unterorganisation';
    modalRef.componentInstance.name = subOrg.name;
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.orgService
        .update(subOrg.organisationId, {
          subOrganisations: {
            update: { where: { id: subOrg.id }, data: { name: result.value } },
          },
        })
        .subscribe({
          next: () => {
            this.toast.show({
              title: 'Gespeichert',
              text: `Unterorganisation wurde umbenannt in "${result.value}".`,
              severity: 'success',
            });
            this.loadOrgs();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Speichern ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
    });
  }

  deleteSubOrg(subOrg: FullSubOrganisation) {
    this.dialogService.open({
      title: 'Unterorganisation löschen?',
      text: `Soll die Unterorganisation "${subOrg.name}" wirklich gelöscht werden?`,
      style: 'danger',
      confirmAction: () => {
        this.orgService
          .update(subOrg.organisationId, {
            subOrganisations: { delete: { id: subOrg.id } },
          })
          .subscribe({
            next: () => {
              this.toast.show({
                title: 'Gelöscht',
                text: `Unterorganisation "${subOrg.name}" wurde gelöscht.`,
                severity: 'success',
              });
              this.loadOrgs();
            },
            error: () => {
              this.toast.show({
                title: 'Fehler',
                text: 'Beim Löschen ist ein Fehler aufgetreten.',
                severity: 'danger',
              });
            },
          });
      },
    });
  }

  deleteGeneralForm(form: FullGeneralForm) {
    this.dialogService.open({
      title: 'Formular löschen?',
      text:
        `Soll das allgemeine Formular "${form.name}" wirklich gelöscht werden? ` +
        'Solange noch Antworten zu diesem Formular vorliegen, wird das Löschen ' +
        'abgelehnt. Liegen keine Antworten vor, werden die Fragen des Formulars ' +
        'unwiderruflich als verwaiste Datensätze zurückgelassen.',
      style: 'danger',
      confirmAction: () => {
        this.generalFormService.deleteDefinition(form.id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: `Formular "${form.name}" wurde gelöscht.`,
              severity: 'success',
            });
            this.loadGeneralForms();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text:
                'Beim Löschen ist ein Fehler aufgetreten. Möglicherweise ' +
                'liegen noch Antworten zu diesem Formular vor.',
              severity: 'danger',
            });
          },
        });
      },
    });
  }

  deleteCaseForm(form: FullCaseForm) {
    this.dialogService.open({
      title: 'Formular löschen?',
      text:
        `Soll das fallbezogene Formular "${form.name}" wirklich gelöscht werden? ` +
        'Bereits vorhandene Antworten zu diesem Formular werden dabei NICHT gelöscht, ' +
        'aber unwiderruflich vom Formular getrennt (verwaist) und sind danach nicht ' +
        'mehr über die Oberfläche erreichbar.',
      style: 'danger',
      confirmAction: () => {
        this.caseFormService.deleteCaseFormDefinition(form.id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: `Formular "${form.name}" wurde gelöscht.`,
              severity: 'success',
            });
            this.loadCaseForms();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Löschen ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
      },
    });
  }
}
