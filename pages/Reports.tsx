import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Loader2, Printer, DollarSign, FileText, FileWarning } from 'lucide-react';
import { InvoiceStatus } from '../types';

interface FinancialSummary {
  totalRevenue: number;
  totalInvoiced: number;
  outstandingBalance: number;
  invoiceCount: number;
  paymentCount: number;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <Icon className="h-5 w-5 text-slate-400" />
        </div>
        <div className="mt-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);


const Reports: React.FC = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ from: startOfMonth, to: today.toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const { addToast } = useToast();

  const handleGenerateReport = async () => {
    setLoading(true);
    setSummary(null);

    const fromDate = new Date(dateRange.from).toISOString();
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);
    const toDateISO = toDate.toISOString();

    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        supabase.from('payments').select('amount').gte('payment_date', fromDate).lte('payment_date', toDateISO),
        supabase.from('invoices').select('amount, status').gte('issue_date', fromDate).lte('issue_date', toDateISO),
      ]);

      if (paymentsRes.error || invoicesRes.error) {
        throw new Error(paymentsRes.error?.message || invoicesRes.error?.message);
      }

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalInvoiced = invoicesRes.data?.reduce((sum, i) => sum + i.amount, 0) || 0;
      const outstandingBalance = invoicesRes.data
        ?.filter(i => i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue)
        .reduce((sum, i) => sum + i.amount, 0) || 0;

      setSummary({
        totalRevenue,
        totalInvoiced,
        outstandingBalance,
        invoiceCount: invoicesRes.data?.length || 0,
        paymentCount: paymentsRes.data?.length || 0,
      });

    } catch (error: any) {
      addToast(`Error generating report: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrint = () => {
    window.print();
  };


  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-content, #report-content * {
            visibility: visible;
          }
          #report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 1.5rem;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="no-print flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md no-print">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Financial Summary</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="from-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
            <input
              type="date"
              id="from-date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="to-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
            <input
              type="date"
              id="to-date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
            />
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Generate Report</span>
          </button>
           {summary && (
             <button onClick={handlePrint} className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-700">
               <Printer size={16} />
               <span>Print</span>
             </button>
           )}
        </div>
      </div>

      {loading && (
        <div className="text-center p-8 no-print">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-sm text-gray-500">Generating your report...</p>
        </div>
      )}
      
      {summary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-fade-in" id="report-content">
           <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Report</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              For the period from {new Date(dateRange.from).toLocaleDateString()} to {new Date(dateRange.to).toLocaleDateString()}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard title="Total Revenue Collected" value={`$${summary.totalRevenue.toFixed(2)}`} icon={DollarSign} />
             <StatCard title="Total Amount Invoiced" value={`$${summary.totalInvoiced.toFixed(2)}`} icon={FileText} />
             <StatCard title="Total Outstanding" value={`$${summary.outstandingBalance.toFixed(2)}`} icon={FileWarning} />
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;