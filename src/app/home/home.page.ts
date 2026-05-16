import { Component, ElementRef, ViewChild, OnInit, NgZone, OnDestroy } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
import { MediaSession } from '@capgo/capacitor-media-session';
import { App } from '@capacitor/app'; // Tambahkan import App

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {

  @ViewChild('visualizerCanvas', { static: false }) visualizerCanvas!: ElementRef<HTMLCanvasElement>;

  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private isVisualizerInit = false;

  player: HTMLAudioElement = new Audio();

  playlist: { title: string, url: string }[] = [
    { title: 'track kosong', url: 'assets/audio/lagu1.mp3' }
  ];

  currentTrackIndex = 0;
  isPlaying = false;
  progress = 0;
  duration = 0;

  isLooping = false;
  isShuffle = false;
  volume = 50;
  showOverlay = true;

  constructor(
    private platform: Platform,
    private ngZone: NgZone
  ) {
    setTimeout(() => {
      this.showOverlay = false;
    }, 3000);
  }

  async ngOnInit() {
    await this.platform.ready();

    this.loadPlaylist();
    await this.ensureFilesystemPermission();

    await this.initMediaSessionHandlers();
    this.setupPlayer();
    this.setupAppLifecycle(); // Inisialisasi listener background/foreground
  }

  ngOnDestroy() {
    // Bersihkan player jika komponen dihancurkan
    this.player.pause();
    this.player.src = '';
  }

  // =========================
  // APP LIFECYCLE (FIX MASALAH #2)
  // =========================
  setupAppLifecycle() {
    if (this.platform.is('capacitor')) {
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          // Refresh state & handler saat app kembali ke foreground
          await this.initMediaSessionHandlers();
          await this.updatePlaybackState();
        }
      });
    }
  }

  // =========================
  // 🔥 SAFE PLAY (FIX MASALAH #4, #7, #9)
  // =========================
  async safePlay() {
    try {
      // AudioContext dijalankan terpisah, jangan biarkan memblokir play()
      this.checkAndResumeAudioContext();

      // Refresh metadata sebelum play untuk memastikan notifikasi terupdate
      await this.updateMediaMetadata();

      await this.player.play();
      
      this.ngZone.run(() => {
        this.isPlaying = true;
      });
      
      await this.updatePlaybackState();
    } catch (err) {
      console.warn('Play gagal (kemungkinan diblokir OS/Audio Focus):', err);
      // Fallback: Kembalikan state UI dan MediaSession ke pause
      this.ngZone.run(() => {
        this.isPlaying = false;
      });
      await this.updatePlaybackState();
    }
  }

  // =========================
  // PERMISSION & SCANNER
  // =========================
 async ensureFilesystemPermission(): Promise<boolean> {
  if (!this.platform.is('capacitor')) return true;

  try {
    // Cek status saat ini
    const status = await Filesystem.checkPermissions();
    
    // Jika sudah diizinkan, kembalikan true
    if (status.publicStorage === 'granted') {
      return true;
    }

    // Jika belum, munculkan pop-up izin system secara otomatis
    const request = await Filesystem.requestPermissions();
    return request.publicStorage === 'granted';
  } catch (e) {
    console.error('Gagal memproses izin:', e);
    return false;
  }
}
  private async scanDirectoryRecursive(path: string, directory: Directory): Promise<number> {
    const result = await Filesystem.readdir({ path: path || '', directory });
    let found = 0;

    for (const item of result.files) {
      if (item.type === 'directory') {
        const next = path ? `${path}/${item.name}` : item.name;
        found += await this.scanDirectoryRecursive(next, directory);
      } else if (item.name.toLowerCase().endsWith('.mp3')) {
        this.playlist.push({
          title: item.name.replace(/\.mp3$/i, ''),
          url: Capacitor.convertFileSrc(item.uri)
        });
        found++;
      }
    }
    return found;
  }

  async scanForMp3Files() {
  // 1. Cek & Minta Izin dulu sebelum lanjut
  const isAllowed = await this.ensureFilesystemPermission();
  
  if (!isAllowed) {
    alert('Aplikasi butuh izin akses "Musik dan Audio" untuk mencari file lagu di HP kamu.');
    return; // Berhenti di sini jika user menolak
  }

  // 2. Jalankan proses scan jika izin sudah ok
  this.playlist = [];
  const folders = ['Music', 'Download', 'Downloads', 'DCIM'];

  for (const folder of folders) {
    try {
      await this.scanDirectoryRecursive(folder, Directory.ExternalStorage);
    } catch (err) {
      console.warn(`Gagal scan folder ${folder}:`, err);
    }
  }

  if (this.playlist.length === 0) {
    alert('Tidak ada lagu ditemukan');
    this.playlist = [{ title: 'Kosong', url: '' }];
  }

  this.currentTrackIndex = 0;
  this.savePlaylist();
  this.setupPlayer();
}

  savePlaylist() {
    localStorage.setItem('savedPlaylist', JSON.stringify(this.playlist));
  }

  loadPlaylist() {
    const data = localStorage.getItem('savedPlaylist');
    if (data) this.playlist = JSON.parse(data);
  }

  // =========================
  // MEDIA SESSION 
  // =========================
  async initMediaSessionHandlers() {
    if (!this.platform.is('capacitor')) return;
    
    try {
      await MediaSession.setActionHandler({ action: 'play' }, async () => {
        this.ngZone.run(async () => {
          await this.safePlay();
        });
      });

      await MediaSession.setActionHandler({ action: 'pause' }, async () => {
        this.ngZone.run(() => {
          this.player.pause();
        });
      });

      await MediaSession.setActionHandler({ action: 'nexttrack' }, async () => {
        this.ngZone.run(async () => {
          await this.next();
        });
      });

      await MediaSession.setActionHandler({ action: 'previoustrack' }, async () => {
        this.ngZone.run(async () => {
          await this.prev();
        });
      });

    } catch (e) {
      console.error('Gagal inisiasi Media Session Handlers:', e);
    }
  }

  async updateMediaMetadata() {
    if (!this.platform.is('capacitor')) return;
    
    const track = this.playlist[this.currentTrackIndex];
    if (!track) return;

    await MediaSession.setMetadata({
      title: track.title || 'Memutar',
      artist: 'Local Player',
      album: 'Playlist',
    });
  }

  async updatePlaybackState() {
    if (!this.platform.is('capacitor')) return;

    // Pastikan status real-time, bukan sekadar melihat property
    const currentState = this.isPlaying ? 'playing' : 'paused';

    await MediaSession.setPlaybackState({
      playbackState: currentState
    });

    if (!isNaN(this.player.duration) && this.player.duration > 0) {
      await MediaSession.setPositionState({
        position: this.player.currentTime,
        duration: this.player.duration,
        playbackRate: this.player.playbackRate || 1
      });
    }
  }

  // =========================
  // PLAYER (FIX MASALAH #1, #5, #6)
  // =========================
  setupPlayer() {
    if (!this.playlist[this.currentTrackIndex]?.url) return;

    this.player.src = this.playlist[this.currentTrackIndex].url;
    this.player.load();
    this.player.volume = this.volume / 100;
    this.player.loop = this.isLooping;

    this.updateMediaMetadata();

    this.player.onloadedmetadata = () => {
      this.ngZone.run(() => {
        this.duration = this.player.duration;
      });
      // Hanya update state awal, biarkan MediaSession menginterpolasi sisanya
      this.updatePlaybackState();
    };

    this.player.ontimeupdate = () => {
      this.ngZone.run(() => {
        this.progress = this.player.currentTime;
      });
      // ❗ PENTING: this.updatePlaybackState() DIHAPUS DARI SINI
      // Mencegah ratusan request per detik ke Capacitor Bridge (Flood)
    };

    this.player.onplay = () => {
      this.ngZone.run(() => {
        this.isPlaying = true;
      });
      this.updatePlaybackState();
    };

    this.player.onpause = () => {
      this.ngZone.run(() => {
        this.isPlaying = false;
      });
      this.updatePlaybackState();
    };

   this.player.onended = () => {
      this.ngZone.run(() => {
        if (!this.isLooping) {
          this.isPlaying = true; // Paksa status UI menjadi playing
          this.next(); 
        }
      });
    };
  }

toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    console.log('Mode Shuffle:', this.isShuffle ? 'Aktif' : 'Nonaktif');
  }

  // =========================
  // CONTROL
  // =========================
  async togglePlay() {
    if (!this.player.src) return;

    if (this.player.paused) {
      await this.safePlay();
    } else {
      this.player.pause();
    }
  }

  async playTrack(i: number) {
    this.currentTrackIndex = i;
    this.setupPlayer();
    await this.safePlay();
  }

async next() {
    if (this.isShuffle && this.playlist.length > 1) {
      let randomIndex = this.currentTrackIndex;
      while (randomIndex === this.currentTrackIndex) {
        randomIndex = Math.floor(Math.random() * this.playlist.length);
      }
      this.currentTrackIndex = randomIndex;
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    }

    this.setupPlayer();

    // Langsung panggil safePlay() tanpa syarat pengecekan isPlaying
    await this.safePlay();
  }

  async prev() {
    if (this.isShuffle && this.playlist.length > 1) {
      let randomIndex = this.currentTrackIndex;
      while (randomIndex === this.currentTrackIndex) {
        randomIndex = Math.floor(Math.random() * this.playlist.length);
      }
      this.currentTrackIndex = randomIndex;
    } else {
      this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    }

    this.setupPlayer();

    // Langsung panggil safePlay() tanpa syarat
    await this.safePlay();
  }

  seek(e: any) {
    this.player.currentTime = e.detail.value;
    // Saat user lompat ke waktu tertentu, baru kita update posisi ke MediaSession
    this.updatePlaybackState();
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
    this.player.loop = this.isLooping;
  }

  volumeUp() {
    this.volume = Math.min(100, this.volume + 10);
    this.player.volume = this.volume / 100;
  }

  volumeDown() {
    this.volume = Math.max(0, this.volume - 10);
    this.player.volume = this.volume / 100;
  }

  formatTime(val: number) {
    if (!val || isNaN(val)) return '00:00';
    const m = Math.floor(val / 60);
    const s = Math.floor(val % 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  hapusLagu(index: number, event: Event) {
    // Mencegah klik tombol hapus memicu klik putar lagu (karena event menyebar/bubbling)
    event.stopPropagation();
    
    // Hapus lagu dari array playlist
    this.playlist.splice(index, 1);
    this.savePlaylist();
    
    // Logika jika lagu yang dihapus sedang diputar
    if (this.currentTrackIndex === index) {
      this.player.pause();
      this.isPlaying = false;
      this.ngZone.run(() => { this.progress = 0; });
      this.updatePlaybackState();
      
      // Jika masih ada lagu tersisa, setup lagu baru
      if (this.playlist.length > 0) {
        if (this.currentTrackIndex >= this.playlist.length) {
          this.currentTrackIndex = 0; // Balik ke awal kalau yang dihapus lagu terakhir
        }
        this.setupPlayer();
      } else {
        this.player.src = ''; // Kosongkan player jika playlist habis
      }
    } else if (this.currentTrackIndex > index) {
      // Jika yang dihapus ada di atas lagu yang sedang diputar, sesuaikan index-nya
      this.currentTrackIndex--;
    }
  }

  // =========================
  // VISUALIZER
  // =========================
  initVisualizer() {
    if (this.isVisualizerInit || !this.visualizerCanvas) return;

    const canvas = this.visualizerCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContext();

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;

    const source = this.audioCtx.createMediaElementSource(this.player);
    source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    this.isVisualizerInit = true;

    this.drawVisualizer(canvas, ctx);
  }

  drawVisualizer(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    requestAnimationFrame(() => this.drawVisualizer(canvas, ctx));

    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let x = 0;
    const barWidth = (canvas.width / bufferLength) * 2;

    for (let i = 0; i < bufferLength; i++) {
      const h = data[i];
      ctx.fillStyle = `rgb(${h + 50},100,255)`;
      ctx.fillRect(x, canvas.height - h / 2, barWidth, h / 2);
      x += barWidth + 1;
    }
  }

checkAndResumeAudioContext() {
    try {
      this.initVisualizer();
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(e => console.warn('AudioContext resume gagal:', e));
      }
    } catch (e) {
      console.warn('Gagal meresume audio context:', e);
    }
  }

} 