import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private platform: Platform) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.minimizeApp();
        } else {
          window.history.back();
        }
      });
    });
  }
}
