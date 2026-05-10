import { Component } from '@angular/core';
import { NavController, Platform } from '@ionic/angular';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-permission',
  templateUrl: './permission.page.html',
  styleUrls: ['./permission.page.scss'],
  standalone: false
})
export class PermissionPage {
  notificationGranted: boolean = false;
  mediaGranted: boolean = false;
  isChecking: boolean = true;

  constructor(
    private navCtrl: NavController,
    private platform: Platform,
    private androidPermissions: AndroidPermissions,
    private device: Device 
  ) { }

  ionViewWillEnter() {
    this.platform.ready().then(() => {
      this.checkExistingPermissions();
    });
  }

  async checkExistingPermissions() {
    if (!this.platform.is('capacitor')) {
      this.navCtrl.navigateRoot('/home', { replaceUrl: true });
      return;
    }

    try {
      // Cek Notifikasi tetap pakai Capacitor (lebih simpel)
      const notifStatus = await LocalNotifications.checkPermissions();
      this.notificationGranted = notifStatus.display === 'granted';

      // Ambil versi Android secara langsung dari properti device
      const androidVersion = this.device.version; 
      let targetPerm = this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE;
      
      // Jika Android versi 13 ke atas (Setara dengan SDK 33)
      if (androidVersion && parseInt(androidVersion) >= 13) {
        targetPerm = (this.androidPermissions as any).PERMISSION.READ_MEDIA_AUDIO;
      }

      const check = await this.androidPermissions.checkPermission(targetPerm);
      this.mediaGranted = check.hasPermission;

      if (this.mediaGranted && this.notificationGranted) {
        this.navCtrl.navigateRoot('/home', { replaceUrl: true });
      } else {
        this.isChecking = false;
      }
    } catch (error) {
      console.error('Error:', error);
      this.isChecking = false;
    }
  }

 async requestMediaPermission() {
    if (!this.platform.is('android')) {
      alert('Sistem mendeteksi ini bukan Android.');
      return;
    }

    try {
      // 1. Cek apakah device plugin jalan
      const androidVersion = this.device.version;
      // alert('Versi Android Terdeteksi: ' + androidVersion); // Hapus // di depan alert ini jika ingin melihat versi yang terbaca

      let targetPerm = this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE;

      // Jika Android 13 ke atas
      if (androidVersion && parseInt(androidVersion) >= 13) {
        targetPerm = (this.androidPermissions as any).PERMISSION.READ_MEDIA_AUDIO;
      }

      // 2. Mulai meminta izin
      const req = await this.androidPermissions.requestPermission(targetPerm);
      
      if (req.hasPermission) {
        this.mediaGranted = true;
        if (!this.notificationGranted) {
          alert('Akses Media diizinkan! Selanjutnya silakan izinkan Notifikasi.');
        } else {
          this.checkFinalNavigation();
        }
      } else {
        alert('Izin ditolak oleh pengguna atau sistem.');
      }
    } catch (error) {
      // 3. MUNCULKAN ERROR JIKA GAGAL
      alert('Error System: ' + JSON.stringify(error));
    }
  }

  async requestNotificationPermission() {
    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') {
        this.notificationGranted = true; // Set notifikasi true

        // Cek apakah media sudah diizinkan?
        if (!this.mediaGranted) {
           // JANGAN direct, kasih pesan ke user agar klik tombol satunya
           alert('Notifikasi diizinkan! Sekarang silakan berikan izin Akses Musik/Media.');
        } else {
           this.checkFinalNavigation();
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Fungsi navigasi yang ketat
  checkFinalNavigation() {
    // Pastikan KEDUANYA harus bernilai true baru bisa masuk ke /home
    if (this.mediaGranted === true && this.notificationGranted === true) {
      this.navCtrl.navigateRoot('/home', { replaceUrl: true });
    }
  }
}