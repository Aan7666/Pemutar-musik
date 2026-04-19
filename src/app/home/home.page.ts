import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
// 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS
import { MusicControls } from '@awesome-cordova-plugins/music-controls/ngx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {

  hapusLagu(index: number, event: any) {
  // Mencegah lagu otomatis terputar saat menekan tombol hapus
  event.stopPropagation();

  // Jika lagu yang dihapus sedang diputar, hentikan player
  if (index === this.currentTrackIndex) {
    this.player.pause();
    this.isPlaying = false;
    if (this.musicControls) {
      this.musicControls.updateIsPlaying(false);
    }
  }

  // Hapus dari daftar
  this.playlist.splice(index, 1);

  // Penyesuaian Index
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
  // 2. SIKLUS HIDUP (LIFECYCLE)
  // ==========================================

  // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS (Inject MusicControls ke constructor)
  constructor(private musicControls: MusicControls) {
    this.setupPlayer();

    setTimeout(() => {
      this.showOverlay = false;
    }, 3000);
  }

  ngOnInit() {
    this.scanForMp3Files();
  }

  // ==========================================
  // 3. FITUR SCAN FILE LOKAL
  // ==========================================

async scanForMp3Files() {
 try {
    const permissions = await Filesystem.requestPermissions();
    
    // Cek status izin lebih luas (untuk mendukung berbagai versi Android)
    if (permissions.publicStorage === 'granted' || (permissions as any).state === 'granted') {
      this.playlist = []; // Reset playlist
      
      // Daftar kemungkinan folder yang berisi MP3
      // Kita masukkan 'Downloads' (jamak) untuk jaga-jaga
     const foldersToScan = ['Download', 'Downloads', 'Music', 'music'];
      let totalSongsFound = 0;

      for (const folder of foldersToScan) {
        try {
          const result = await Filesystem.readdir({
            path: folder,
            directory: Directory.ExternalStorage
          });

          // Filter file .mp3
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

          console.log(`Scan ${folder} sukses: ditemukan ${mp3Files.length} lagu.`);
        } catch (err) {
          // Abaikan jika folder tidak ada
          console.warn(`Folder ${folder} tidak ditemukan atau kosong.`);
        }
      }

      if (this.playlist.length > 0) {
        this.currentTrackIndex = 0;
        this.setupPlayer();
        alert(`Berhasil menemukan ${totalSongsFound} lagu!`);
      } else {
        alert('Tidak ditemukan lagu .mp3 di folder Music atau Download.');
      }

    } else {
      alert('Izin penyimpanan diperlukan untuk memindai lagu.');
    }
  } catch (error) {
    console.error('Kesalahan scanning:', error);
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
      
      // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS
      this.updateMediaControls(); 
    }
  }

  // ==========================================
  // 4. FITUR VISUALIZER AUDIO
  // ==========================================
  
  // ... (Fungsi initVisualizer, drawVisualizer, checkAndResumeAudioContext tetap sama) ...
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
  // 5. KONTROL PLAYER MUSIK & NOTIFIKASI
  // ==========================================

  // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS (Fungsi Baru)
  updateMediaControls() {
    const currentTrack = this.playlist[this.currentTrackIndex];
    
    this.musicControls.create({
      track: currentTrack.title,
      artist: 'Aplikasi Musikku', // Bisa diganti
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
        case 'music-controls-next':
          this.next();
          break;
        case 'music-controls-previous':
          this.prev();
          break;
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
    this.player.src = this.playlist[this.currentTrackIndex].url;
    this.player.load();
    
    this.player.loop = this.isLooping; 
    this.player.volume = this.volume / 100;

    this.player.onloadedmetadata = () => {
      this.duration = this.player.duration;
    };

    this.player.ontimeupdate = () => {
      this.progress = this.player.currentTime;
    };

    this.player.onended = () => {
      if (!this.isLooping) {
        this.next();
      }
    };

    // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS (Update info lagu saat ganti track)
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
    
    // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS (Update icon Play/Pause di notifikasi)
    this.musicControls.updateIsPlaying(this.isPlaying);
  }

  playTrack(index: number) {
    this.currentTrackIndex = index;
    this.setupPlayer();
    this.checkAndResumeAudioContext(); 
    this.player.play();
    this.isPlaying = true;
    
    // 👇 DITAMBAHKAN UNTUK MEDIA CONTROLS
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
  

  // ... (Fungsi seek, toggleLoop, volumeUp, volumeDown, formatTime tetap sama persis) ...
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

  // ==========================================
  // 6. UTILITY (FUNGSI BANTUAN)
  // ==========================================

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

