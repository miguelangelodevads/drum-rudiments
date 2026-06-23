import { useState, useEffect, useRef, useCallback } from "react";
import * as LucideIcons from "lucide-react";
import { RUDIMENTS, CATEGORIES, SUBDIVISIONS } from "./data";
import "./index.css";

// Componente para renderizar os ícones do Lucide
const Icon = ({
  name,
  size = 24,
  className = "",
  strokeWidth = 2.5,
  fill = "none",
}) => {
  const IconComponent = LucideIcons[name];
  if (!IconComponent) return null;
  return (
    <IconComponent
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  );
};

function App() {
  const [activeRudiment, setActiveRudiment] = useState(RUDIMENTS[0]);
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [currentSub, setCurrentSub] = useState(RUDIMENTS[0].sub);
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [strokeIndex, setStrokeIndex] = useState(-1);
  const [sound, setSound] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const audioCtx = useRef(null);
  const timer = useRef(null);
  const nextMetronomeTime = useRef(0);
  const nextNoteTime = useRef(0);
  const currentBeatCount = useRef(0);
  const currentNote = useRef(0);
  const queue = useRef([]);
  const wakeLock = useRef(null);
  const soundRef = useRef(sound);

  // 1. Atualiza a ref de som sempre que o state mudar
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // 2. Remove o loader e prepara o prompt de instalação (PWA nativo do Vite)
  useEffect(() => {
    const hideLoader = () => document.body.classList.add("loaded");
    const t = setTimeout(hideLoader, 300);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
    });

    return () => clearTimeout(t);
  }, []);

  const handleWakeLock = async (on) => {
    if (!("wakeLock" in navigator)) return;
    try {
      if (on) wakeLock.current = await navigator.wakeLock.request("screen");
      else if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
      }
    } catch (err) {
      console.debug(err);
    }
  };

  const playMetronome = useCallback((time, isFirstInCycle) => {
    if (!soundRef.current || !audioCtx.current) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(isFirstInCycle ? 1200 : 800, time);
    osc.frequency.exponentialRampToValueAtTime(10, time + 0.05);
    gain.gain.setValueAtTime(isFirstInCycle ? 0.6 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const playDrumStroke = useCallback((time, type, isStrongBeat) => {
    if (!soundRef.current || !audioCtx.current) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(type === "R" ? 220 : 250, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    const vol = type === "grace" ? 0.2 : isStrongBeat ? 0.9 : 0.6;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.start(time);
    osc.stop(time + 0.15);

    const bufferSize = ctx.sampleRate * 0.12;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1500;
    const noiseGain = ctx.createGain();
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    const nVol = type === "grace" ? 0.1 : isStrongBeat ? 0.5 : 0.3;
    noiseGain.gain.setValueAtTime(nVol, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.start(time);
  }, []);

  const scheduler = useCallback(
    function schedulerFn() {
      const now = audioCtx.current.currentTime;
      while (queue.current.length && queue.current[0].time <= now) {
        setStrokeIndex(queue.current.shift().index);
      }
      const beatDuration = 60.0 / bpm;
      const beatsPerMeasure = parseInt(activeRudiment.time.split("/")[0], 10);
      while (nextMetronomeTime.current < now + 0.1) {
        const isFirstInCycle = currentBeatCount.current % beatsPerMeasure === 0;
        playMetronome(nextMetronomeTime.current, isFirstInCycle);
        nextMetronomeTime.current += beatDuration;
        currentBeatCount.current++;
      }
      const baseStepDuration = beatDuration / currentSub;
      const durArray = activeRudiment.dur || [];

      while (nextNoteTime.current < now + 0.1) {
        const strokeIdx = currentNote.current % activeRudiment.sticking.length;
        const strokeString = activeRudiment.sticking[strokeIdx];
        const noteDur = durArray[strokeIdx] || 1;

        if (strokeString !== "-") {
          const chars = strokeString.split("");
          const primary = chars.pop();
          const graces = chars;
          graces.forEach((g, idx) => {
            if (g !== "-") {
              const graceTime = Math.max(
                now,
                nextNoteTime.current - 0.04 + idx * 0.015,
              );
              playDrumStroke(graceTime, "grace", false);
            }
          });
          const isStrongBeat = noteDur >= currentSub;
          playDrumStroke(nextNoteTime.current, primary, isStrongBeat);
        }
        queue.current.push({ time: nextNoteTime.current, index: strokeIdx });
        nextNoteTime.current += baseStepDuration * noteDur;
        currentNote.current++;
      }
      timer.current = requestAnimationFrame(schedulerFn);
    },
    [bpm, activeRudiment, currentSub, playDrumStroke, playMetronome],
  );

  useEffect(() => {
    if (isPlaying) {
      audioCtx.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const startTime = audioCtx.current.currentTime + 0.05;
      nextMetronomeTime.current = startTime;
      nextNoteTime.current = startTime;
      currentNote.current = 0;
      currentBeatCount.current = 0;
      queue.current = [];
      timer.current = requestAnimationFrame(scheduler);
      handleWakeLock(true);
    } else {
      cancelAnimationFrame(timer.current);
      setTimeout(() => setStrokeIndex(-1), 0);
      handleWakeLock(false);
    }
    return () => cancelAnimationFrame(timer.current);
  }, [isPlaying, scheduler]);

  const changeRudiment = (r) => {
    setActiveRudiment(r);
    setCurrentSub(r.sub);
    setIsPlaying(false);
    setIsMenuOpen(false);
  };

  const filtered =
    selectedCat === "Todos"
      ? RUDIMENTS
      : RUDIMENTS.filter((r) => r.cat === selectedCat);

  return (
    <div className='flex h-full w-full bg-slate-950 overflow-hidden pt-[var(--sat)] pb-[var(--sab)] relative'>
      {/* Overlay Escuro (Mobile) */}
      {isMenuOpen && (
        <div
          className='fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity'
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Menu Lateral / Drawer (Mobile) & Sidebar Fixo (Desktop) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[85%] sm:w-80 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl
          md:relative md:w-72 md:translate-x-0 md:shadow-none
          ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Topo do Menu */}
        <div className='p-5 md:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900'>
          <div className='flex items-center gap-3'>
            <Icon name='BookOpen' className='text-orange-500' size={24} />
            <span className='font-black uppercase italic tracking-tighter text-base text-white'>
              Drum Studio
            </span>
          </div>
          <div className='flex gap-2 items-center'>
            <button
              onClick={() => setShowInstall(true)}
              className='p-2.5 bg-orange-500 rounded-lg md:p-2 text-white'
            >
              <Icon name='Download' size={16} />
            </button>
            <button
              onClick={() => setIsMenuOpen(false)}
              className='p-2.5 bg-slate-800 rounded-lg text-slate-400 md:hidden'
            >
              <Icon name='X' size={16} />
            </button>
          </div>
        </div>

        {/* Categorias */}
        <div className='p-4 md:p-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0 bg-slate-900/50'>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-4 py-2 md:px-2.5 md:py-1 rounded-full text-xs md:text-[9px] font-black uppercase whitespace-nowrap transition-colors ${
                selectedCat === c
                  ? "bg-orange-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Lista Scrollável */}
        <div className='flex-1 overflow-y-auto no-scrollbar p-3 space-y-2 md:space-y-1'>
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => changeRudiment(r)}
              className={`w-full text-left p-4 md:p-3 rounded-xl border-l-4 transition-all ${
                activeRudiment.id === r.id
                  ? "bg-slate-800 border-orange-500"
                  : "border-transparent hover:bg-slate-800/40"
              }`}
            >
              <div className='font-bold text-sm md:text-[11px] text-slate-200 truncate'>
                {r.id}. {r.name}
              </div>
              <div className='text-xs md:text-[8px] font-black text-slate-500 uppercase mt-1 md:mt-0.5 tracking-tighter flex justify-between items-center'>
                <span>{r.cat}</span>
                <span className='text-orange-500 bg-orange-500/10 px-2 md:px-1.5 py-0.5 md:py-0 rounded'>
                  {r.time}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Área Principal */}
      <main className='flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#020617_100%)] min-h-0 w-full'>
        {/* Top Bar Absolute (Mobile Hamburger & Som) */}
        <div className='absolute top-4 left-4 z-10 md:hidden'>
          <button
            onClick={() => setIsMenuOpen(true)}
            className='p-3 bg-slate-800/50 backdrop-blur-md rounded-xl border border-white/5 shadow-xl transition-transform active:scale-90 text-white'
          >
            <Icon name='Menu' size={20} />
          </button>
        </div>

        <div className='absolute top-4 right-4 z-10'>
          <button
            onClick={() => setSound(!sound)}
            className='p-3 bg-slate-800/50 backdrop-blur-md rounded-xl border border-white/5 shadow-xl transition-transform active:scale-90'
            title='Ativar/Desativar Som'
          >
            <Icon
              name={sound ? "Volume2" : "VolumeX"}
              className={sound ? "text-white" : "text-red-500"}
              size={20}
            />
          </button>
        </div>

        <div className='flex-1 flex flex-col items-center justify-center p-4 md:p-8 min-h-0 pt-20 md:pt-8'>
          <div className='text-orange-500/80 text-[10px] md:text-xs font-black tracking-[0.4em] uppercase mb-2 flex items-center gap-2'>
            <span>Treino Ativo</span>
            <span className='bg-orange-500 text-white px-2 py-0.5 rounded text-[8px] md:text-[10px] tracking-widest'>
              {activeRudiment.time}
            </span>
          </div>
          <h2 className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-6 tracking-tighter uppercase leading-tight max-w-[90%]'>
            {activeRudiment.name}
          </h2>

          {/* Selector de Subdivisão */}
          <div className='flex flex-wrap justify-center gap-1.5 md:gap-2 mb-8 md:mb-10 bg-slate-900/60 p-1.5 md:p-1.5 rounded-xl border border-slate-800 backdrop-blur-sm'>
            {SUBDIVISIONS.map((sub) => (
              <button
                key={sub.val}
                onClick={() => {
                  setCurrentSub(sub.val);
                  setIsPlaying(false);
                }}
                className={`px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all ${
                  currentSub === sub.val
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "text-slate-500 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Visualizador de Toques */}
          <div className='flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-5 w-full max-w-5xl py-2 px-2'>
            {activeRudiment.sticking.map((s, i) => {
              const active = i === strokeIndex;

              if (s === "-") {
                return (
                  <div
                    key={i}
                    className={`relative flex items-center justify-center w-6 sm:w-8 md:w-10 transition-all ${
                      active
                        ? "opacity-100 scale-125 text-orange-500"
                        : "opacity-20 text-slate-500"
                    }`}
                  >
                    <span className='text-xl sm:text-2xl font-black'>-</span>
                  </div>
                );
              }

              const isR = s.toUpperCase().includes("R");
              return (
                <div
                  key={i}
                  className={`relative flex items-center justify-center w-10 h-16 sm:w-12 sm:h-20 md:w-16 md:h-24 lg:w-20 lg:h-32 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] border-b-[4px] md:border-b-[6px] transition-all ${
                    active
                      ? isR
                        ? "bg-orange-500 border-orange-700 -translate-y-1 md:-translate-y-2 shadow-lg shadow-orange-500/50"
                        : "bg-blue-600 border-blue-800 -translate-y-1 md:-translate-y-2 shadow-lg shadow-blue-500/50"
                      : "bg-slate-900 border-slate-800 shadow-xl"
                  }`}
                >
                  <span
                    className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black ${
                      active
                        ? "text-white"
                        : isR
                          ? "text-orange-500"
                          : "text-blue-600"
                    }`}
                  >
                    {s.length > 1 ? (
                      <>
                        <span className='text-[10px] sm:text-xs md:text-lg opacity-40 mr-0.5'>
                          {s.slice(0, -1)}
                        </span>
                        {s.slice(-1)}
                      </>
                    ) : (
                      s
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className='mt-8 md:mt-12 flex flex-wrap justify-center gap-6 md:gap-10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500'>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-orange-500 rounded-sm'></div> Direita
              (R)
            </div>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-blue-600 rounded-sm'></div> Esquerda
              (L)
            </div>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-slate-700 rounded-full'></div> Pausa
            </div>
          </div>
        </div>

        {/* Painel do Metrónomo */}
        <div className='px-5 py-6 md:px-10 md:py-8 bg-slate-900/95 backdrop-blur-3xl border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0'>
          <div className='flex items-center justify-center gap-6 w-full md:w-auto order-2 md:order-1'>
            <button
              onClick={() => setBpm(Math.max(40, bpm - 5))}
              className='p-3 md:p-3 bg-slate-800 rounded-xl active:scale-90 transition-transform'
            >
              <Icon
                name='Minus'
                size={20}
                strokeWidth={3}
                className='text-white'
              />
            </button>
            <div className='text-center min-w-[90px] md:min-w-[100px]'>
              <div className='text-5xl md:text-6xl font-black tabular-nums leading-none'>
                {bpm}
              </div>
              <div className='text-[9px] text-orange-500 font-black uppercase tracking-[0.3em] mt-1.5'>
                BPM
              </div>
            </div>
            <button
              onClick={() => setBpm(Math.min(400, bpm + 5))}
              className='p-3 md:p-3 bg-slate-800 rounded-xl active:scale-90 transition-transform'
            >
              <Icon
                name='Plus'
                size={20}
                strokeWidth={3}
                className='text-white'
              />
            </button>
          </div>

          <div className='w-full md:max-w-xs lg:max-w-md hidden sm:block order-3 md:order-2 px-4'>
            <input
              type='range'
              min='40'
              max='400'
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
            />
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-20 h-20 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-2xl active:scale-95 order-1 md:order-3 shrink-0 ${
              isPlaying ? "bg-red-500 rotate-180" : "bg-orange-500"
            }`}
          >
            <Icon
              name={isPlaying ? "Pause" : "Play"}
              size={36}
              className='md:w-10 md:h-10 text-white'
              fill='currentColor'
            />
          </button>
        </div>
      </main>

      {/* Modal PWA */}
      {showInstall && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md'
          onClick={() => setShowInstall(false)}
        >
          <div
            className='bg-slate-900 border border-white/10 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className='text-xl font-black uppercase mb-6 tracking-tighter text-white'>
              Instalar App
            </h3>
            <div className='space-y-4 text-left text-slate-400 text-sm'>
              <p className='flex items-center gap-3'>
                <span className='text-orange-500 font-black text-lg'>1.</span>{" "}
                Abra as opções do seu navegador.
              </p>
              <p className='flex items-center gap-3'>
                <span className='text-orange-500 font-black text-lg'>2.</span>{" "}
                Escolha <b>"Adicionar ao Ecrã Principal"</b>.
              </p>
            </div>
            <button
              onClick={() => setShowInstall(false)}
              className='mt-8 w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-xs tracking-widest'
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
