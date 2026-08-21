import { Routes } from '@angular/router';
import { Families } from './components/family-list/family-list.component';
import { CaseFormsPage } from './pages/surveys/caseForms';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { ImportSurveyDefinitionComponent } from './components/import-survey-definition/import-survey-definition';
import { MeComponent } from './components/me/me';
import { CreateFamilyComponent } from './components/create-family/create-family.component';
import { EditFamilyPage } from './pages/edit-family-page/edit-family-page';
import { ErrorPage } from './pages/error-page/error-page';
import { CaseFormResponsePage } from './pages/response/case-form-response';
import { MyResponsesPage } from './pages/my-responses-page/my-responses-page';
import { GeneralFormPage } from './pages/general-form-page/general-form-page';
import { HealthDataInputComponent } from './components/health-data-input/health-data-input.component';
import { StatsDashboardPage } from './pages/stats-dashboard/stats-dashboard.page';
import { UserAdminComponent } from './components/user-admin/user-admin.component';
import { ContactDocumentation } from './pages/contact-documentation/contact-documentation.page';
import { roleGuard } from './auth/guards/roleGuard';
import { inject } from '@angular/core';
import { MeService } from './services/me.service';
import { map } from 'rxjs';
import Keycloak from 'keycloak-js';
import { DataViewPage } from './pages/data-view/data-view.page';
import { AllCaseFormData } from './pages/all-caseform-data/all-caseform-data.page';
import { authenticatedGuard } from './auth/guards/authenticatedGuard';
import { AllContactData } from './pages/all-contact-documentation/all-contact-documentation.page';
import { EditContactDocumentationPage } from './pages/edit-contact-documentation/edit-contact-documentation.page';
import { AllFormData } from './pages/all-form-data/all-caseform-data.page';
import { Role } from '../../../shared/generated/prisma/enums';
import { Settings } from './components/settings/settings';
import { GeneralFormEditorComponent } from './components/general-form-editor/general-form-editor';
import { CaseFormEditorComponent } from './components/case-form-editor/case-form-editor';
import { DocumentLibraryPage } from './pages/document-library/document-library.page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: (_activatedRouteSnapshot) => {
      const me$ = inject(MeService).getMe();
      const keycloak = inject(Keycloak);

      if (!keycloak.authenticated) keycloak.login();

      return me$.pipe(
        map((user) => {
          if (user.role === Role.Controller || user.role === Role.OrgController)
            return '/stats';
          if (user.role === Role.Admin) return '/user-admin';
          return '/dashboard';
        }),
      );
    },
  },
  {
    path: 'surveys',
    component: CaseFormsPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'familien',
    component: Families,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'gesundheits-daten',
    component: HealthDataInputComponent,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'gesundheits-daten/:caseId',
    component: HealthDataInputComponent,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'stats',
    component: StatsDashboardPage,
    canActivate: [
      roleGuard([
        Role.Admin,
        Role.Controller,
        Role.OrgController,
        Role.OrgCoordinator,
        Role.SubOrgCoordinator,
      ]),
    ],
  },
  {
    path: 'formulare',
    component: CaseFormsPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'import/survey',
    component: ImportSurveyDefinitionComponent,
    canActivate: [roleGuard([Role.Admin])],
  },
  {
    // Also reachable by Controller/OrgController in read-only ("inspect") mode from the
    // all-stats data tables - they can never write here, but need to reach the page to view it.
    path: 'responses/:caseFormId',
    component: CaseFormResponsePage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
      Role.Controller,
      Role.OrgController,
    ])],
  },
  {
    path: 'general-responses',
    component: GeneralFormPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    // Also reachable by Controller/OrgController in read-only ("inspect") mode - see the
    // 'responses/:caseFormId' route above.
    path: 'general-responses/:id',
    component: GeneralFormPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
      Role.Controller,
      Role.OrgController,
    ])],
  },
  {
    path: 'contact-documentation-table',
    component: AllContactData,
    canActivate: [authenticatedGuard()],
  },
  {
    path: 'my-responses',
    component: MyResponsesPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'me',
    component: MeComponent,
    canActivate: [
      roleGuard([
        Role.User,
        Role.Admin,
        Role.Controller,
        Role.OrgController,
        Role.OrgCoordinator,
        Role.SubOrgCoordinator,
      ]),
    ],
  },
  {
    path: 'create-family',
    component: CreateFamilyComponent,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'edit-family/:id',
    component: EditFamilyPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'user-admin',
    component: UserAdminComponent,
    canActivate: [roleGuard([Role.Admin])],
  },
  {
    path: 'error',
    component: ErrorPage,
  },
  {
    path: 'contact-documentation',
    component: ContactDocumentation,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    path: 'contact-documentation/:caseId',
    component: ContactDocumentation,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
    ])],
  },
  {
    // Also reachable by Controller/OrgController in read-only ("inspect") mode from the
    // contact-documentation-table - see the 'responses/:caseFormId' route above.
    path: 'contact-documentation/:caseId/:docId',
    component: EditContactDocumentationPage,
    canActivate: [roleGuard([
      Role.User,
      Role.Admin,
      Role.OrgCoordinator,
      Role.SubOrgCoordinator,
      Role.Controller,
      Role.OrgController,
    ])],
  },
  {
    path: 'all-stats',
    component: DataViewPage,
    canActivate: [authenticatedGuard()],
  },
  {
    path: 'all-caseform-data/:formId',
    component: AllCaseFormData,
    canActivate: [authenticatedGuard()],
  },
  {
    path: 'all-form-data/:formId',
    component: AllFormData,
    canActivate: [authenticatedGuard()],
  },
  {
    path: 'einstellungen',
    component: Settings,
    canActivate: [authenticatedGuard()],
  },
  {
    path: 'dokumente',
    component: DocumentLibraryPage,
    canActivate: [authenticatedGuard()],
  },
  // TODO: consider permissions - the four routes below are guarded for
  // [Admin, Controller, OrgController] to match what GeneralFormAuthFns.canEditGeneralFormDefinition
  // and CaseFormDefinitionAuthFns.canEdit actually allow on the backend. This was widened
  // from an initial Admin-only guard (which mirrored the stricter /import/survey route).
  // The Settings page's "Fragebögen" section (settings.html) that links to these routes is
  // still Admin-only, so if this guard is reverted, no further change is needed - but if it's
  // kept, consider whether Controller/OrgController should also see the entry points there.
  {
    path: 'allgemeine-formulare/neu',
    component: GeneralFormEditorComponent,
    canActivate: [
      roleGuard([Role.Admin, Role.Controller, Role.OrgController]),
    ],
  },
  {
    path: 'allgemeine-formulare/:id',
    component: GeneralFormEditorComponent,
    canActivate: [
      roleGuard([Role.Admin, Role.Controller, Role.OrgController]),
    ],
  },
  {
    path: 'fallbezogene-formulare/neu',
    component: CaseFormEditorComponent,
    canActivate: [
      roleGuard([Role.Admin, Role.Controller, Role.OrgController]),
    ],
  },
  {
    path: 'fallbezogene-formulare/:id',
    component: CaseFormEditorComponent,
    canActivate: [
      roleGuard([Role.Admin, Role.Controller, Role.OrgController]),
    ],
  },
];
