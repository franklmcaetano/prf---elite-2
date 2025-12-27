
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, BookOpen, Car, Scale, RotateCcw, 
  ChevronRight, AlertCircle, Loader2, Target, 
  Lightbulb, Check, X, Percent, 
  ShieldAlert, Infinity, Crosshair,
  Award, TrendingUp, History, Info, Cloud, Database
} from 'lucide-react';

// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';

// ==================================================================
// === ÁREA DE CONFIGURAÇÃO (COLE SEU CÓDIGO DO FIREBASE AQUI) ===
// ==================================================================

const firebaseConfig = {
  // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDCP0qzvcbaHq0cQKZttUmVdhKZxOxBack",
  authDomain: "prf-elite.firebaseapp.com",
  projectId: "prf-elite",
  storageBucket: "prf-elite.firebasestorage.app",
  messagingSenderId: "582154402260",
  appId: "1:582154402260:web:d58a84bb2c50751e6bbe41",
  measurementId: "G-ZCNV654N5W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
  
};

// ==================================================================

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'prf-elite-prod'; // Nome interno do banco de dados

// Dados das Matérias
const BLOCKS = {
  BLOCO_I: {
    title: "Bloco I - Básicas",
    icon: <BookOpen className="w-5 h-5" />,
    subjects: ["Português", "Raciocínio Lógico-Matemático", "Informática", "Física", "Ética e Cidadania", "Geopolítica", "História da PRF"]
  },
  BLOCO_II: {
    title: "Bloco II - Trânsito",
    icon: <Car className="w-5 h-5" />,
    subjects: ["CTB + Resoluções CONTRAN"]
  },
  BLOCO_III: {
    title: "Bloco III - Direito",
    icon: <Scale className="w-5 h-5" />,
    subjects: ["Direito Constitucional", "Direito Administrativo", "Direito Penal", "Processo Penal", "Direitos Humanos"]
  }
};

const App = () => {
  // Estado do Usuário e Dados Cloud
  const [user, setUser] = useState(null);
  const [userStats, setUserStats] = useState({ totalAnswered: 0, correct: 0, incorrect: 0, globalScore: 0 });
  const [isSyncing, setIsSyncing] = useState(true);

  // Estado da Aplicação
  const [appState, setAppState] = useState('config'); 
  const [selectedBlock, setSelectedBlock] = useState('BLOCO_I');
  const [selectedSubject, setSelectedSubject] = useState('Português');
  const [customTopic, setCustomTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [marathonMode, setMarathonMode] = useState(false);
  
  // Estado do Quiz
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [seconds, setSeconds] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const timerRef = useRef(null);
  const scrollRef = useRef(null);

  // 1. Inicialização de Autenticação (Login Anônimo)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Falha na autenticação:", error);
        setError("Erro ao conectar ao sistema de login.");
        setIsSyncing(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setIsSyncing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronização de Estatísticas em Tempo Real
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'history'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      let correct = 0;
      let incorrect = 0;
      let score = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        total += data.totalQuestions || 0;
        correct += data.correctCount || 0;
        incorrect += data.incorrectCount || 0;
        score += (data.correctCount || 0) - (data.incorrectCount || 0);
      });

      setUserStats({
        totalAnswered: total,
        correct,
        incorrect,
        globalScore: score
      });
      setIsSyncing(false);
    }, (error) => {
      console.error("Erro ao sincronizar dados:", error);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Timer do Quiz
  useEffect(() => {
    if (appState === 'quiz') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [appState]);

  // Scroll automático para o topo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para chamar o Backend da Vercel (Seguro)
  const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const startMission = async (isLoadingBatch = false) => {
    if (!isLoadingBatch) {
      setAppState('loading');
      setQuestions([]);
      setAnswers({});
      setSeconds(0);
      setCurrentIndex(0);
    } else {
      setIsLoadingMore(true);
    }
    
    setError(null);
    setLoadingStatus(isLoadingBatch ? "Solicitando reforço tático..." : "Contactando base segura...");

    const historyContext = questions.length > 0 
      ? `Evite repetir estes temas já abordados: ${questions.slice(-10).map(q => q.item.substring(0, 30)).join(', ')}.`
      : '';

    const payload = {
      contents: [{ parts: [{ text: `Gere ${numQuestions} itens estilo CERTO/ERRADO de ${selectedSubject}. ${customTopic ? "Foco: " + customTopic : ""} ${historyContext}` }] }],
      systemInstruction: { 
        parts: [{ 
          text: `Aja como banca CEBRASPE (PRF). Gere itens inéditos de CERTO/ERRADO.
          Use JSON puro:
          {
            "caderno": [
              {
                "contexto": "Texto curto situacional ou teórico",
                "pergunta": "Assertiva para julgamento",
                "gabarito": "C" ou "E",
                "fundamentacao": "Explicação técnica sucinta"
              }
            ]
          }` 
        }] 
      },
      generationConfig: { 
        responseMimeType: "application/json"
      }
    };

    try {
      // CHAMADA SEGURA AO BACKEND DA VERCEL
      const result = await fetchWithRetry(
        '/api/generate', // Rota relativa para o arquivo na pasta API
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (result.error) throw new Error(result.error);

      const rawJson = result.candidates[0].content.parts[0].text;
      const data = JSON.parse(rawJson);
      
      const newBatch = data.caderno.map(it => ({
        contexto: it.contexto,
        item: it.pergunta,
        gabarito: it.gabarito,
        explanation: it.fundamentacao
      }));

      if (isLoadingBatch) {
        const nextIdx = questions.length;
        setQuestions(prev => [...prev, ...newBatch]);
        setCurrentIndex(nextIdx);
        setIsLoadingMore(false);
      } else {
        setQuestions(newBatch);
        setAppState('quiz');
      }
    } catch (err) {
      console.error(err);
      setError("Falha na comunicação segura. Verifique se a 'GOOGLE_API_KEY' está configurada na Vercel.");
      if (!isLoadingBatch) setAppState('config');
      setIsLoadingMore(false);
    }
  };

  const handleChoice = (choice) => {
    if (answers[currentIndex]) return;
    const isCorrect = choice === questions[currentIndex].gabarito;
    setAnswers(prev => ({
      ...prev,
      [currentIndex]: { choice, isCorrect }
    }));
  };

  const saveResultsToCloud = async (currentResults) => {
    if (!user) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), {
            timestamp: serverTimestamp(),
            subject: selectedSubject,
            block: selectedBlock,
            totalQuestions: questions.length,
            correctCount: currentResults.correct,
            incorrectCount: currentResults.incorrect,
            score: currentResults.score,
            mode: marathonMode ? 'Maratona' : 'Simulado'
        });
    } catch (e) {
        console.error("Erro ao salvar resultado:", e);
    }
  };

  const finishQuiz = () => {
    const r = calculateResults();
    saveResultsToCloud(r);
    setAppState('results');
  };

  const calculateResults = () => {
    const answered = Object.values(answers);
    const correct = answered.filter(a => a.isCorrect).length;
    const incorrect = answered.length - correct;
    const score = correct - incorrect; 
    const accuracy = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    return { correct, incorrect, score, accuracy };
  };

  const results = useMemo(() => calculateResults(), [answers, questions]);

  const isAnswered = answers[currentIndex] !== undefined;
  const isLastQuestion = currentIndex === questions.length - 1;

  if (isSyncing) {
     return (
        <div className="min-h-screen bg-[#05080f] flex items-center justify-center flex-col gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-blue-500 font-bold tracking-widest text-[10px] uppercase">Sincronizando Banco de Dados...</p>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-300 font-sans flex flex-col antialiased">
      
      {/* --- TELA 1: CONFIGURAÇÃO --- */}
      {appState === 'config' && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12">
          <div className="max-w-xl w-full space-y-8">
            <div className="text-center relative">
              <div className="absolute top-0 right-0">
                 {user && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] text-green-500 font-black uppercase tracking-widest">Online</span>
                    </div>
                 )}
              </div>
              <div className="inline-flex p-6 rounded-[2.5rem] bg-blue-600/10 border border-blue-500/20 mb-6 shadow-2xl">
                <ShieldCheck className="w-16 h-16 text-blue-500" />
              </div>
              <h1 className="text-5xl font-black italic text-white uppercase tracking-tighter">PRF <span className="text-blue-500">Elite</span></h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                 <Cloud className="w-3 h-3 text-slate-500" />
                 <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px]">Cloud Sync v3.0 (Secure)</p>
              </div>
            </div>

            {/* CARD DE ESTATÍSTICAS */}
            <div className="bg-gradient-to-r from-slate-900 to-[#0c1220] border border-white/10 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Database className="w-24 h-24 text-blue-500" />
                </div>
                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History className="w-4 h-4" /> Seu Histórico Global
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-white italic">{userStats.totalAnswered}</span>
                        <span className="text-[8px] uppercase text-slate-500 font-bold">Itens Feitos</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-green-400 italic">{userStats.correct}</span>
                        <span className="text-[8px] uppercase text-slate-500 font-bold">Acertos</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-blue-400 italic">{userStats.globalScore}</span>
                        <span className="text-[8px] uppercase text-slate-500 font-bold">Nota Líquida</span>
                    </div>
                </div>
            </div>

            <div className="bg-[#0c1220] border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block px-1">Selecione o Bloco</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(BLOCKS).map(([id, b]) => (
                    <button key={id} onClick={() => { setSelectedBlock(id); setSelectedSubject(b.subjects[0]); }} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedBlock === id ? 'border-blue-500 bg-blue-500/10 text-white shadow-lg' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}>
                      {b.icon}
                      <span className="text-[9px] font-black uppercase text-center leading-tight">{b.title.split(' - ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block px-1">Disciplina Alvo</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl font-bold text-sm text-white appearance-none cursor-pointer outline-none focus:border-blue-500 transition-all">
                  {BLOCKS[selectedBlock].subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block px-1">Quantidade</label>
                  <div className="flex bg-slate-900 rounded-2xl border border-slate-800 p-1 h-[58px]">
                    {[5, 10, 20].map(n => (
                      <button key={n} onClick={() => setNumQuestions(n)} className={`flex-1 rounded-xl font-black text-[11px] transition-all ${numQuestions === n ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600'}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block px-1">Maratona</label>
                  <button onClick={() => setMarathonMode(!marathonMode)} className={`w-full h-[58px] rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${marathonMode ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-800 text-slate-600'}`}>
                    <Infinity className="w-5 h-5" /> <span className="text-[10px] font-black uppercase">{marathonMode ? 'ATIVO' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse"><AlertCircle className="w-4 h-4" /> {error}</div>}

              <button onClick={() => startMission(false)} className="w-full py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-lg shadow-[0_20px_40px_rgba(59,130,246,0.2)] flex items-center justify-center gap-4 uppercase italic transition-all active:scale-95">
                <Crosshair className="w-6 h-6" /> INICIAR MISSÃO
              </button>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-start gap-3 opacity-40 hover:opacity-100 transition-opacity duration-300 cursor-default">
                  <ShieldAlert className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500 leading-relaxed text-left">
                    <span className="text-white block mb-1">TERMOS DE USO & ISENÇÃO</span>
                    Este software é uma ferramenta de estudo independente. Os itens são gerados por IA e podem apresentar inconsistências. Valide sempre as respostas com os normativos oficiais.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TELA 2: CARREGAMENTO --- */}
      {appState === 'loading' && (
        <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse"></div>
            <Loader2 className="w-20 h-20 text-blue-500 animate-spin relative z-10" />
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase text-center">{loadingStatus}</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] animate-pulse">A IA está a processar o lote tático</p>
        </div>
      )}

      {/* --- TELA 3: QUIZ --- */}
      {appState === 'quiz' && (
        <div className="flex-grow flex flex-col bg-[#05080f]">
          <header className="sticky top-0 z-50 bg-[#05080f]/95 backdrop-blur-xl border-b border-white/5 p-4 sm:px-12">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500"><Target className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">{selectedSubject}</h3>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Item {currentIndex + 1} de {questions.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="hidden sm:flex flex-col items-end">
                   <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Tempo</span>
                   <div className="text-white font-mono text-2xl font-black italic">{formatTim
