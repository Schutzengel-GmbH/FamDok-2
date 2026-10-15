import {
  AbstractControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { FullOrganisation } from '../../../../../shared/types';
import { Role } from '../../../../../shared/generated/prisma/enums';

export const ROLES_REQUIRING_ORG: Role[] = [
  Role.OrgController,
  Role.OrgCoordinator,
  Role.SubOrgCoordinator,
];

function nonEmptyArray(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0
    ? null
    : { required: true };
}

/** OrgController/OrgCoordinator need an organisation, SubOrgCoordinator additionally needs
 * at least one suborganisation - misconfiguring these roles would silently break their
 * org/suborg-scoped data access, so enforce it here rather than only server-side.
 * Expects `role`, `organisationId` and `subOrganisationIds` controls. */
export function applyScopeValidators(form: FormGroup) {
  const role = form.get('role')?.value;
  const orgControl = form.get('organisationId');
  const subOrgControl = form.get('subOrganisationIds');

  orgControl?.setValidators(
    ROLES_REQUIRING_ORG.includes(role) ? [Validators.required] : [],
  );
  orgControl?.updateValueAndValidity({ emitEvent: false });

  subOrgControl?.setValidators(
    role === Role.SubOrgCoordinator ? [nonEmptyArray] : [],
  );
  subOrgControl?.updateValueAndValidity({ emitEvent: false });
}

/** Keeps the scope validators in sync with the role, and drops selected suborganisations that
 * don't belong to a newly chosen organisation. */
export function watchScope(form: FormGroup, orgs: () => FullOrganisation[]) {
  form.get('organisationId')?.valueChanges.subscribe((orgId) => {
    const validIds = new Set(
      (orgs()?.find((org) => org.id === orgId)?.subOrganisations ?? []).map(
        (subOrg) => subOrg.id,
      ),
    );
    const selected: string[] = form.get('subOrganisationIds')?.value ?? [];
    const filtered = selected.filter((id) => validIds.has(id));
    if (filtered.length !== selected.length) {
      form.get('subOrganisationIds')?.setValue(filtered);
    }
  });

  form.get('role')?.valueChanges.subscribe(() => applyScopeValidators(form));
  applyScopeValidators(form);
}
