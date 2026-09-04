import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  itemDescription: string;
  itemType: 'report' | 'incident';
  pollingUnitId?: string;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemDescription,
  itemType,
  pollingUnitId,
}: DeleteConfirmationModalProps) {
  const [reason, setReason] = useState('Testing verification complete / test cleanup');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden"
      >
        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-serif">{title}</h3>
              <p className="text-xs text-red-700 font-medium">Administrator Privilege Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-red-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-bold uppercase tracking-wider text-gray-400">Target {itemType}</span>
              {pollingUnitId && <span className="font-mono font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">PU #{pollingUnitId}</span>}
            </div>
            <p className="text-sm font-medium text-gray-800 line-clamp-3">
              {itemDescription}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Reason for Deletion (Audit Trail Record) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Test report removal, duplicate submission, erroneous entry..."
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none font-medium"
            />
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>This reason and your admin identity will be permanently logged in the system Audit Trail.</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Deleting this record will remove it from the <strong>Public Live Feed</strong> and admin reports database immediately.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting || !reason.trim()}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all shadow-sm flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting & Auditing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
