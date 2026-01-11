
import React, { useState, useEffect, useRef } from 'react';
import { Camera, FileText, Download, Trash2, CheckCircle, HelpCircle, Loader2, Plus, ArrowRight, Monitor, StopCircle, Zap, AlertCircle, Clipboard, MousePointer2, Sparkles, X, ChevronDown } from 'lucide-react';
import { solveQuestion } from './services/geminiService';
import { QuestionData } from './types';

const App: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'capture' | 'history'>('capture');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QuestionData | null>(null);
  const [isPasteHovered, setIsPasteHovered] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'info' | 'success' | 'error' | 'warning'} | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('captured_questions_v2');
    if (saved) {
      try {
        setQuestions(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('captured_questions_v2', JSON.stringify(questions));
  }, [questions]);

  // Auto-scroll para o resultado quando ele aparece
  useEffect(() => {
    if (currentResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentResult]);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      // Se o foco estiver no textarea, deixa o navegador lidar normalmente com o texto
      if (document.activeElement?.tagName === 'TEXTAREA') return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        // Trata Imagem
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            showStatus("Imagem detectada! Resolvendo...", 'info');
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              setPreviewImage(base64);
              processQuestion(undefined, base64);
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
        // Trata Texto (se colar texto fora do textarea)
        else if (items[i].type === "text/plain") {
          items[i].getAsString((text) => {
            if (text.length > 10) { // Evita processar textos muito curtos acidentalmente
              showStatus("Texto detectado! Analisando gabarito...", 'info');
              processQuestion(text);
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [questions]);

  const showStatus = (text: string, type: 'info' | 'success' | 'error' | 'warning') => {
    setStatusMessage({ text, type });
    if (type !== 'info') {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const processQuestion = async (textOverride?: string, imageOverride?: string) => {
    const finalMsg = textOverride || inputText;
    const finalImg = imageOverride || previewImage;

    if (!finalMsg && !finalImg) return;

    setIsProcessing(true);
    setCurrentResult(null);
    try {
      const result = await solveQuestion({
        text: finalMsg || undefined,
        imageBase64: finalImg || undefined
      });

      const normalizedNewQuestion = result.question.trim().toLowerCase();
      const isDuplicate = questions.some(q => q.question.trim().toLowerCase() === normalizedNewQuestion);

      if (isDuplicate) {
        showStatus("Questão já no cofre! Exibindo existente.", 'warning');
        const existing = questions.find(q => q.question.trim().toLowerCase() === normalizedNewQuestion);
        if (existing) setCurrentResult(existing);
        setPreviewImage(null);
        setInputText('');
        return;
      }

      const newQuestion: QuestionData = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        question: result.question,
        options: result.options,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
        sourceImage: finalImg || undefined
      };

      setQuestions(prev => [newQuestion, ...prev]);
      setCurrentResult(newQuestion);
      setLastAddedId(newQuestion.id);
      setInputText('');
      setPreviewImage(null);
      showStatus("Resolvida e salva no histórico!", 'success');
      
      setTimeout(() => setLastAddedId(null), 3000);
    } catch (error) {
      showStatus("Erro na análise. Tente novamente.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    if (window.confirm("Apagar todo o histórico?")) {
      setQuestions([]);
      setCurrentResult(null);
      localStorage.removeItem('captured_questions_v2');
      showStatus("Cofre vazio.", 'info');
    }
  };

  const exportForNotebookLM = () => {
    const content = questions.map(q => {
      return `### PERGUNTA\n${q.question}\n\n### OPÇÕES\n${q.options.map(opt => `- ${opt}`).join('\n')}\n\n### RESPOSTA CORRETA\n${q.correctAnswer}\n\n### EXPLICAÇÃO\n${q.explanation}\n\n---\n`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulado_notebooklm_${new Date().getTime()}.txt`;
    a.click();
    showStatus("Pronto para o NotebookLM!", 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
      {statusMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border ${
            statusMessage.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 
            statusMessage.type === 'error' ? 'bg-red-600 text-white border-red-400' : 
            statusMessage.type === 'warning' ? 'bg-amber-500 text-white border-amber-300' :
            'bg-slate-900 text-white border-white/10'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : 
             statusMessage.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
             <Sparkles className="w-4 h-4" />}
            <span className="text-sm font-bold">{statusMessage.text}</span>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <h1 className="font-bold text-lg text-slate-800 tracking-tight">StudyCapture <span className="text-indigo-600">AI</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
            <button 
              onClick={exportForNotebookLM}
              disabled={questions.length === 0}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all disabled:opacity-30 text-xs font-bold flex items-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Exportar NotebookLM</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 lg:p-8 pb-32">
        {/* Tabs */}
        <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-8 w-fit border border-slate-200">
          <button onClick={() => setActiveTab('capture')} className={`px-8 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'capture' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            Capturar
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-8 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            Histórico ({questions.length})
          </button>
        </div>

        {activeTab === 'capture' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Área de Entrada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Colagem de Imagem */}
               <div 
                  className={`group relative aspect-[4/3] rounded-[32px] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8 overflow-hidden ${isPasteHovered ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300'}`}
                  onMouseEnter={() => setIsPasteHovered(true)}
                  onMouseLeave={() => setIsPasteHovered(false)}
               >
                  {previewImage ? (
                    <img src={previewImage} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                  ) : null}
                  
                  <div className="relative z-10 text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all ${isPasteHovered ? 'bg-indigo-600 text-white scale-110 shadow-xl' : 'bg-slate-100 text-indigo-500'}`}>
                       <Clipboard className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">Cole um Print</h3>
                    <p className="text-slate-500 text-xs tracking-tight">Dê Cmd+V aqui para processar a imagem</p>
                  </div>
               </div>

               {/* Colagem de Texto */}
               <div className="bg-white rounded-[32px] border border-slate-200 p-6 flex flex-col shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-sm">
                    <FileText className="w-4 h-4" />
                    <span>Cole o Texto do Gabarito</span>
                  </div>
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ex: 'Incorrect. The correct answer is...'"
                    className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-sm text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                  <button 
                    onClick={() => processQuestion()}
                    disabled={isProcessing || (!inputText && !previewImage)}
                    className="mt-4 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    Analisar Agora
                  </button>
               </div>
            </div>

            {/* Resultado da Última Questão */}
            {currentResult && (
              <div ref={resultRef} className="animate-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white rounded-[40px] shadow-2xl border-2 border-indigo-500/10 overflow-hidden">
                  <div className="bg-slate-900 p-8 text-white">
                    <div className="flex justify-between items-center mb-6">
                      <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">Resultado da Captura</span>
                      <button onClick={() => setCurrentResult(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <h2 className="text-2xl font-bold leading-tight italic">"{currentResult.question}"</h2>
                  </div>

                  <div className="p-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      {currentResult.options.map((opt, idx) => {
                        const isCorrect = opt.toLowerCase().includes(currentResult.correctAnswer.toLowerCase()) || currentResult.correctAnswer.toLowerCase().includes(opt.toLowerCase());
                        return (
                          <div key={idx} className={`p-5 rounded-3xl border-2 flex items-start gap-4 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-white'}`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="font-bold text-sm leading-snug">{opt}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-indigo-50/50 rounded-[32px] p-8 border border-indigo-100">
                      <div className="flex items-center gap-3 mb-4 text-indigo-600">
                         <HelpCircle className="w-5 h-5" />
                         <h4 className="font-black text-xs uppercase tracking-widest">Explicação do Especialista</h4>
                      </div>
                      <p className="text-slate-700 leading-relaxed font-medium">{currentResult.explanation}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Questão adicionada automaticamente ao cofre de estudos</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">#{questions.length - idx}</span>
                  <button onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-bold text-slate-800 mb-4 line-clamp-2">"{q.question}"</h3>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 w-fit px-3 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  <span>{q.correctAnswer}</span>
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="text-center py-24 opacity-20 border-4 border-dashed rounded-[40px] border-slate-200">
                <Monitor className="w-16 h-16 mx-auto mb-4" />
                <p className="font-bold">Nenhuma questão no cofre.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-4 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> IA Online</span>
              <span className="text-indigo-600">{questions.length} Questões prontas p/ NotebookLM</span>
           </div>
           <div className="hidden sm:block">Filtro de Duplicidade Ativado</div>
        </div>
      </div>
    </div>
  );
};

export default App;
