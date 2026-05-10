import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

// 1. Import plugin di bagian atas
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule, 
    IonicModule.forRoot(), 
    AppRoutingModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // 2. Taruh di sini (Array Providers)
    AndroidPermissions,
    Device
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}