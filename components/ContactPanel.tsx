import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, File as FileIcon, FileText, Image as ImageIcon, Film, Music,
  CheckCircle2, Loader2, AlertCircle, Check, User, Mail, Phone, MessageSquare, Send
} from 'lucide-react';
import { submitContact, FileStatus, ContactFields } from '../services/uploadService';

interface ContactPanelProps {
  onClose: () => void;
  accentColor?: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg':
      return <ImageIcon className="w-5 h-5 text-primary" />;
    case 'mp4': case 'mov': case 'avi': case 'mkv': case 'webm':
      return <Film className="w-5 h-5 text-accent" />;
    case 'mp3': case 'wav': case 'ogg': case 'flac':
      return <Music className="w-5 h-5 text-pink-400" />;
    case 'pdf': case 'doc': case 'docx': case 'xls': case 'xlsx': case 'ppt': case 'pptx': case 'txt': case 'csv':
      return <FileText className="w-5 h-5 text-amber-400" />;
    default:
      return <FileIcon className="w-5 h-5 text-gray-400" />;
  }
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const ContactPanel: React.FC<ContactPanelProps> = ({ onClose, accentColor = '#00ffcb' }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statuses, setStatuses] = useState<Record<number, FileStatus>>({});
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles(prev => [...prev, ...Array.from(list)]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const nameOk = fullName.trim().length > 0;
  const emailOk = isEmail(email.trim());
  const canSubmit = nameOk && emailOk && !isUploading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError(null);
    setStatuses({});
    try {
      const fields: ContactFields = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
      };
      await submitContact(
        fields,
        files,
        (index, status) => setStatuses(prev => ({ ...prev, [index]: status })),
        (s) => setStep(s)
      );
      setDone(true);
      setTimeout(() => onClose(), 1400);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el formulario.');
    } finally {
      setIsUploading(false);
    }
  }, [canSubmit, fullName, email, phone, message, files, onClose]);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const doneCount = Object.values(statuses).filter(s => s === 'done').length;
  const uploadedBytes = files.reduce((acc, f, i) => acc + (statuses[i] === 'done' ? f.size : 0), 0);
  const bytePercent = totalSize ? Math.round((uploadedBytes / totalSize) * 100) : 0;

  const inputBase =
    'w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white ' +
    'placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-colors';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={() => !isUploading && onClose()}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accentColor}1a`, border: `1px solid ${accentColor}33` }}
              >
                <Send className="w-4 h-4" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-none">Contacto</p>
                <p className="text-sm text-white font-semibold truncate leading-tight mt-0.5">Envíame un mensaje</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {(isUploading || done) && files.length > 0 && (
                <div className="text-right leading-none">
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Subido</p>
                  <p className="text-xs font-mono font-bold mt-1" style={{ color: accentColor }}>{done ? 100 : bytePercent}%</p>
                </div>
              )}
              <button
                onClick={() => !isUploading && onClose()}
                disabled={isUploading}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5 overflow-y-auto no-scrollbar">
            {done ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <CheckCircle2 className="w-12 h-12" style={{ color: accentColor }} />
                <p className="text-sm text-white font-semibold">¡Mensaje enviado!</p>
                <p className="text-xs text-gray-500">Gracias por contactarme.</p>
              </div>
            ) : (
              <>
                {/* Campos del formulario */}
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nombre completo *" disabled={isUploading} className={inputBase}
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Correo electrónico *" disabled={isUploading}
                      className={`${inputBase} ${email && !emailOk ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="Teléfono" disabled={isUploading} className={inputBase}
                    />
                  </div>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <textarea
                      value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder="Mensaje" rows={3} disabled={isUploading}
                      className={`${inputBase} resize-none pt-2.5`}
                    />
                  </div>
                </div>

                {/* Dropzone de archivos (solo archivos, sin carpetas) */}
                {!isUploading && (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative mt-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${
                      isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      ref={fileInputRef} type="file" multiple className="hidden"
                      onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                    />
                    <div className="p-2.5 bg-white/5 rounded-xl text-primary">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Adjunta archivos (opcional)</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">Arrastra o haz clic · hasta 5 GB por archivo</p>
                    </div>
                  </div>
                )}

                {/* Progreso durante el envío */}
                {isUploading && (
                  <div className="my-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                        <p className="text-xs text-gray-300 truncate">{step || 'Enviando...'}</p>
                      </div>
                      {files.length > 0 && (
                        <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-2">{doneCount}/{files.length}</span>
                      )}
                    </div>
                    {files.length > 0 && (
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: accentColor }}
                          animate={{ width: `${bytePercent}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de archivos en cola */}
                {files.length > 0 && (
                  <div className="mt-4">
                    {!isUploading && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Adjuntos ({files.length})
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">{formatSize(totalSize)}</span>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar pr-0.5">
                      {files.map((file, idx) => {
                        const status = statuses[idx];
                        const isDone = status === 'done';
                        const isBusy = status === 'uploading';
                        return (
                          <motion.div
                            key={`${file.name}-${idx}`}
                            animate={{ opacity: isDone ? 0.4 : 1 }}
                            transition={{ duration: 0.5 }}
                            className={`flex items-center justify-between border p-2.5 rounded-lg transition-colors ${
                              isDone ? 'bg-primary/5 border-primary/20'
                                : isBusy ? 'bg-white/[0.04] border-primary/20'
                                : 'bg-black/30 border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="p-1.5 bg-white/5 rounded-md shrink-0">{getFileIcon(file.name)}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-200 truncate">{file.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{formatSize(file.size)}</p>
                              </div>
                            </div>
                            {isDone ? (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <Check className="w-3.5 h-3.5 text-primary" />
                              </div>
                            ) : isBusy ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                            ) : (
                              <button
                                onClick={() => removeFile(idx)}
                                className="p-1 rounded-md text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => !isUploading && onClose()}
                    disabled={isUploading}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isUploading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
