import React, { useMemo } from 'react';
import { Invoice, InvoiceStatus, InvoiceTreatment } from '../types';
import Modal from './Modal';
import { Printer } from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, isOpen, onClose }) => {
  const itemizedTreatments = useMemo(() => {
    if (!invoice?.appointments?.notes) return [];
    
    const notes = invoice.appointments.notes;
    const treatmentSection = notes.split('---BILLED TREATMENTS---')[1];
    if (!treatmentSection) return [];
    
    const treatments: InvoiceTreatment[] = [];
    const lines = treatmentSection.trim().split('\n');
    lines.forEach(line => {
      // Line format: "- Treatment Name: $100.00"
      const match = line.match(/- (.*): \$(.*)/);
      if (match && match[1] && match[2]) {
        treatments.push({
          name: match[1].trim(),
          cost: parseFloat(match[2]),
        });
      }
    });
    return treatments;
  }, [invoice]);

  if (!invoice) return null;

  const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balanceDue = invoice.amount - totalPaid;

  const handlePrint = () => window.print();
  
  const getStatusChip = (status: InvoiceStatus) => {
    switch (status) {
        case InvoiceStatus.Paid:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case InvoiceStatus.Unpaid:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case InvoiceStatus.Overdue:
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        default:
            return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice #${invoice.id.substring(0, 8)}`}>
       <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            padding: 1.5rem;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div id="printable-invoice">
        <div className="p-6 bg-white dark:bg-gray-800 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">DentalOS</h2>
              <p className="text-slate-500">123 Dental St, Smile City</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">INVOICE</h1>
              <p># {invoice.id.substring(0,12)}</p>
              <span className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusChip(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
              <h3 className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Billed To</h3>
              <p className="font-bold text-slate-800 dark:text-white">{invoice.patients?.name}</p>
            </div>
            <div className="text-right">
              <p><strong className="font-semibold">Issue Date:</strong> {new Date(invoice.issue_date).toLocaleDateString()}</p>
              <p><strong className="font-semibold">Due Date:</strong> {new Date(invoice.due_date).toLocaleDateString()}</p>
            </div>
          </div>
          
          <h3 className="font-semibold text-slate-500 dark:text-slate-400 mb-2">Service Details</h3>
          <table className="w-full text-left mb-8">
            <thead className="bg-slate-50 dark:bg-gray-700">
              <tr>
                <th className="p-2 font-semibold">Service</th>
                <th className="p-2 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemizedTreatments.length > 0 ? (
                itemizedTreatments.map((item, index) => (
                  <tr key={index} className="border-b dark:border-gray-700">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2 text-right">${item.cost.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b dark:border-gray-700">
                  <td className="p-2">{invoice.appointments?.notes || 'General Consultation'}</td>
                  <td className="p-2 text-right">${invoice.amount.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {invoice.payments && invoice.payments.length > 0 && (
            <>
              <h3 className="font-semibold text-slate-500 dark:text-slate-400 mb-2">Payment History</h3>
              <table className="w-full text-left mb-8">
                <thead className="bg-slate-50 dark:bg-gray-700">
                  <tr>
                    <th className="p-2 font-semibold">Date</th>
                    <th className="p-2 font-semibold">Method</th>
                    <th className="p-2 font-semibold text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map(p => (
                    <tr key={p.id} className="border-b dark:border-gray-700">
                      <td className="p-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="p-2">{p.method}</td>
                      <td className="p-2 text-right">${p.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="flex justify-end">
            <div className="w-full sm:w-1/2 md:w-1/3">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>${invoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Total Paid:</span>
                <span>-${totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 mt-2 border-t-2 dark:border-gray-600 font-bold text-slate-800 dark:text-white text-lg">
                <span>Balance Due:</span>
                <span>${balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end p-4 bg-slate-50 dark:bg-gray-700/50 border-t dark:border-gray-700 no-print">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
              <Printer size={18} />
              <span>Print Invoice</span>
          </button>
      </div>
    </Modal>
  );
};

export default InvoiceDetailModal;