import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { HomePageRoutingModule } from './home-routing.module';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

import { MusicControls } from '@awesome-cordova-plugins/music-controls/ngx';


@NgModule({
  imports: [
   
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule
  ],
  declarations: [HomePage],

  providers: [
    MusicControls,
     AndroidPermissions
  ]
})
export class HomePageModule {}
