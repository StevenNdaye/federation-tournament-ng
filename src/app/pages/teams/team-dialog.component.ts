import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {FormBuilder, Validators} from '@angular/forms';
import {Team} from "../../models/team";

@Component({
  selector: 'app-team-dialog',
  templateUrl: './team-dialog.component.html'
})
export class TeamDialogComponent {
  form = this.fb.group({
    country: [this.data.team?.country || '', [Validators.required, Validators.maxLength(60)]],
    managerName: [this.data.team?.manager || ''],
    representativeEmail: [this.data.team?.representativeEmail || '', [Validators.email]],
  });

  constructor(
    private fb: FormBuilder,
    private ref: MatDialogRef<TeamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { team: Partial<Team> }
  ) {
  }

  save() {
    if (this.form.valid) {
      this.ref.close({team: this.form.value});
    }
  }

  cancel() {
    this.ref.close();
  }
}
