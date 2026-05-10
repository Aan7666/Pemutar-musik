import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PermissionPage } from './permission.page';

const routes: Routes = [
  {
    path: '',
    component: PermissionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PermissionPageRoutingModule {}
