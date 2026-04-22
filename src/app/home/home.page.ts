import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device'; // 👇 WAJIB DITAMBAHKAN
import { Platform } from '@ionic/angular';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { MusicControls } from '@awesome-cordova-plugins/music-controls/ngx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {

  // ==========================================
  // 1. DEKLARASI VARIABEL
  // ==========================================
  @ViewChild('visualizerCanvas', { static: false }) visualizerCanvas!: ElementRef<HTMLCanvasElement>;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private isVisualizerInit = false;

  player: HTMLAudioElement = new Audio();
  playlist: { title: string, url: string }[] = [
    { title: 'track kosong', url: 'assets/audio/lagu1.mp3' }
  ];
  currentTrackIndex: number = 0;
  isPlaying: boolean = false;
  progress: number = 0;
  duration: number = 0;
  isLooping: boolean = false;
  volume: number = 50;
  showOverlay: boolean = true; 

  // ==========================================
  // 2. SIKLUS HIDUP (LIFECYCLE) & CONSTRUCTOR
  // ==========================================
  
  // 👇 INJEKSI PLUGIN DI CONSTRUCTOR DIPERBAIKI
  constructor(
    private musicControls: MusicControls,
    private androidPermissions: AndroidPermissions,
    private platform: Platform
  ) {
    this.setupPlayer();
    setTimeout(() => {
      this.showOverlay = false;
    }, 3000);
  }

  ngOnInit() {
    // Tunggu platform siap, lalu minta izin sebelum scan
    this.platform.ready().then(() => {
      this.cekDanMintaIzin();
    });
  }

  // ==========================================
  // 3. LOGIKA REQUEST PERMISSION (BARU)
  // ==========================================
async cekDanMintaIzin() {
  if (this.platform.is('android')) {
    try {
      const info = await Device.getInfo();
      let targetPerm: string;

      // 👇 TAMBAHKAN PENGECEKAN info.androidSDKVersion DI SINI
      if (info.androidSDKVersion && info.androidSDKVersion >= 33) {
        targetPerm = (this.androidPermissions as any).PERMISSION.READ_MEDIA_AUDIO;
      } else {
        targetPerm = this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE;
      }

      const check = await this.androidPermissions.checkPermission(targetPerm);
      
      if (!check.hasPermission) {
        // Minta izin ke user
        const req = await this.androidPermissions.requestPermission(targetPerm);
        
        if (req.hasPermission) {
          this.scanForMp3Files(); // Izin diberikan
        } else {
          // JIKA DITOLAK
          alert('Izin ditolak oleh Android! Tidak bisa otomatis scan.');
        }
      } else {
        // Izin sudah pernah diberikan sebelumnya
        this.scanForMp3Files(); 
      }
    } catch (err) {
      // MUNCULKAN ERROR JIKA PLUGIN GAGAL JALAN
      alert('Error Plugin Permission: ' + JSON.stringify(err));
    }
  } else {
    this.scanForMp3Files();
  }
}
  // ==========================================
  // 4. FITUR SCAN FILE LOKAL (DIPERBAIKI)
  // ==========================================
  async scanForMp3Files() {
    try {
      this.playlist = []; // Reset playlist
      const foldersToScan = ['Download', 'Downloads', 'Music', 'music'];
      let totalSongsFound = 0;

      for (const folder of foldersToScan) {
        try {
          const result = await Filesystem.readdir({
            path: folder,
            directory: Directory.ExternalStorage
          });

          const mp3Files = result.files.filter(file => 
            file.name && file.name.toLowerCase().endsWith('.mp3')
          );

          mp3Files.forEach(file => {
            const webviewSafeUrl = Capacitor.convertFileSrc(file.uri);
            this.playlist.push({
              title: file.name.replace('.mp3', ''),
              url: webviewSafeUrl
            });
            totalSongsFound++;
          });
        } catch (err) {
          console.warn(`Folder ${folder} tidak ditemukan atau kosong.`);
        }
      }

      if (this.playlist.length > 0) {
        this.currentTrackIndex = 0;
        this.setupPlayer();
        console.log(`Berhasil menemukan ${totalSongsFound} lagu!`);
      } else {
        alert('Tidak ditemukan lagu .mp3 di folder Music atau Download.');
        // Kembalikan playlist kosong agar UI tidak error
        this.playlist = [{ title: 'Daftar Kosong', url: '' }];
      }

    } catch (error) {
      console.error('Kesalahan scanning:', error);
    }
  }

  // ==========================================
  // 5. MANAJEMEN PLAYLIST (FUNGSI ASLI KAMU)
  // ==========================================
  hapusLagu(index: number, event: any) {
    event.stopPropagation();
    if (index === this.currentTrackIndex) {
      this.player.pause();
      this.isPlaying = false;
      if (this.musicControls) {
        this.musicControls.updateIsPlaying(false);
      }
    }

    this.playlist.splice(index, 1);

    if (this.playlist.length === 0) {
      this.playlist = [{ title: 'Daftar Kosong', url: '' }];
      this.currentTrackIndex = 0;
    } else if (index < this.currentTrackIndex) {
      this.currentTrackIndex--;
    } else if (index === this.currentTrackIndex) {
      if (this.currentTrackIndex >= this.playlist.length) {
        this.currentTrackIndex = 0;
      }
      this.setupPlayer();
    }
  }

  tambahLaguDariStorage(event: any) {
    const file = event.target.files[0]; 
    if (file) {
      const fileURL = URL.createObjectURL(file);
      this.playlist.push({
        title: file.name, 
        url: fileURL
      });
      this.currentTrackIndex = this.playlist.length - 1;
      this.setupPlayer();
      this.checkAndResumeAudioContext(); 
      this.player.play();
      this.isPlaying = true;
      this.updateMediaControls(); 
    }
  }

  // ==========================================
  // 6. FITUR VISUALIZER AUDIO
  // ==========================================
  initVisualizer() {
    if (this.isVisualizerInit || !this.visualizerCanvas) return;
    const canvas = this.visualizerCanvas.nativeElement;
    const canvasCtx = canvas.getContext('2d')!;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    const source = this.audioCtx.createMediaElementSource(this.player);
    source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.isVisualizerInit = true;
    this.drawVisualizer(canvas, canvasCtx);
  }

  drawVisualizer(canvas: HTMLCanvasElement, canvasCtx: CanvasRenderingContext2D) {
    requestAnimationFrame(() => this.drawVisualizer(canvas, canvasCtx));
    if (!this.analyser) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];
      canvasCtx.fillStyle = `rgb(${barHeight + 50}, 100, 255)`;
      canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
      x += barWidth + 1;
    }
  }

  checkAndResumeAudioContext() {
    this.initVisualizer(); 
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // ==========================================
  // 7. KONTROL PLAYER MUSIK & NOTIFIKASI
  // ==========================================
  updateMediaControls() {
    const currentTrack = this.playlist[this.currentTrackIndex];
    if (!currentTrack || currentTrack.url === '') return; // Cegah error jika playlist kosong

    this.musicControls.create({
      track: currentTrack.title,
      artist: 'Aplikasi Musikku',
      isPlaying: this.isPlaying,
      dismissable: true,
      hasPrev: true,
      hasNext: true,
      hasClose: true,
      ticker: 'Memutar ' + currentTrack.title
    });

    this.musicControls.subscribe().subscribe((action) => {
      const message = JSON.parse(action).message;
      switch(message) {
        case 'music-controls-next': this.next(); break;
        case 'music-controls-previous': this.prev(); break;
        case 'music-controls-pause':
          this.player.pause();
          this.isPlaying = false;
          this.musicControls.updateIsPlaying(false);
          break;
        case 'music-controls-play':
          this.checkAndResumeAudioContext();
          this.player.play();
          this.isPlaying = true;
          this.musicControls.updateIsPlaying(true);
          break;
        case 'music-controls-destroy':
          this.player.pause();
          this.isPlaying = false;
          break;
      }
    });
    this.musicControls.listen();
  }

  setupPlayer() {
    if (!this.playlist[this.currentTrackIndex]?.url) return;
    
    this.player.src = this.playlist[this.currentTrackIndex].url;
    this.player.load();
    this.player.loop = this.isLooping; 
    this.player.volume = this.volume / 100;

    this.player.onloadedmetadata = () => { this.duration = this.player.duration; };
    this.player.ontimeupdate = () => { this.progress = this.player.currentTime; };
    this.player.onended = () => { if (!this.isLooping) { this.next(); } };

    this.updateMediaControls();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.player.pause();
    } else {
      this.checkAndResumeAudioContext(); 
      this.player.play();
    }
    this.isPlaying = !this.isPlaying;
    this.musicControls.updateIsPlaying(this.isPlaying);
  }

  playTrack(index: number) {
    this.currentTrackIndex = index;
    this.setupPlayer();
    this.checkAndResumeAudioContext(); 
    this.player.play();
    this.isPlaying = true;
    this.musicControls.updateIsPlaying(true);
  }

  next() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    this.setupPlayer();
    if (this.isPlaying) {
      this.checkAndResumeAudioContext(); 
      this.player.play();
    }
  }

  prev() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.setupPlayer();
    if (this.isPlaying) {
      this.checkAndResumeAudioContext(); 
      this.player.play();
    }
  }

  seek(event: any) {
    const newValue = event.detail.value;
    this.player.currentTime = newValue;
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
    this.player.loop = this.isLooping; 
  }

  volumeUp() {
    if (this.volume < 100) {
      this.volume += 10; 
      if (this.volume > 100) this.volume = 100; 
      this.player.volume = this.volume / 100;
    }
  }

  volumeDown() {
    if (this.volume > 0) {
      this.volume -= 10;
      if (this.volume < 0) this.volume = 0; 
      this.player.volume = this.volume / 100;
    }
  }

  formatTime(value: number) {
    if (!value || isNaN(value)) {
      return '00:00';
    }
    const minutes: number = Math.floor(value / 60);
    const seconds: number = Math.floor(value % 60);
    const minsStr = minutes < 10 ? '0' + minutes : minutes;
    const secsStr = seconds < 10 ? '0' + seconds : seconds;
    return `${minsStr}:${secsStr}`;
  }
}