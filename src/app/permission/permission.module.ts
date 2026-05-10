import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PermissionPageRoutingModule } from './permission-routing.module';

import { PermissionPage } from './permission.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PermissionPageRoutingModule
  ],
  declarations: [PermissionPage]
})
export class PermissionPageModule {}
