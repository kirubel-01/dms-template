import React from 'react';
import { useToast } from '../contexts/ToastContext';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-green-500" />,
  error: <AlertTriangle className="text-red-500" />,
  info: <Info className="text-blue-500" />,
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 w-80 animate-fade-in-up"
        >
          <div className="mr-3">{icons[toast.type]}</div>
          <div className="flex-1 text-sm text-gray-800 dark:text-gray-200">{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className="ml-4 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
