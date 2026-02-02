
import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { DollarSign, FileWarning, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { InvoiceStatus } from '../../types';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center">
        <div className={`p-3 rounded-full mr-4 ${color}`}>
            <Icon size={24} className="text-white" />
        </div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

interface MonthlyRevenue {
    name: string;
    revenue: number;
}

const AccountantDashboard: React.FC = () => {
    const [stats, setStats] = useState({ collected: 0, outstanding: 0, paidMonth: 0 });
    const [chartData, setChartData] = useState<MonthlyRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

            const [
                { data: paymentsInMonth, error: pError },
                { data: outstandingInvoices, error: oError },
                { count: paidMonth, error: pmError },
                { data: chartPayments, error: cError }
            ] = await Promise.all([
                supabase
                    .from('payments')
                    .select('amount')
                    .gte('payment_date', startOfMonth.toISOString())
                    .lte('payment_date', endOfMonth.toISOString()),
                supabase
                    .from('invoices')
                    .select('amount')
                    .in('status', [InvoiceStatus.Unpaid, InvoiceStatus.Overdue]),
                supabase
                    .from('invoices')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', InvoiceStatus.Paid)
                    .gte('issue_date', startOfMonth.toISOString())
                    .lte('issue_date', endOfMonth.toISOString()),
                supabase
                    .from('payments')
                    .select('amount, payment_date')
                    .gte('payment_date', sixMonthsAgo.toISOString())
            ]);

            const anyError = pError || oError || pmError || cError;
            if (anyError) {
                const errors = [pError, oError, pmError, cError].filter(Boolean);
                const errorMessages = errors.map(e => {
                  if (e && typeof e.message === 'string' && e.message) {
                    return e.message;
                  }
                  return JSON.stringify(e);
                }).join(', ');
                addToast(`Could not load dashboard statistics: ${errorMessages}`, "error");
                console.error("Error fetching accountant stats:", errors);
                return;
            }

            const collected = paymentsInMonth?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const outstanding = outstandingInvoices?.reduce((sum, i) => sum + i.amount, 0) || 0;

            setStats({
                collected,
                outstanding,
                paidMonth: paidMonth || 0,
            });

            const monthlyRevenue: { [key: string]: number } = {};
            const monthLabels: string[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear().toString().slice(-2);
                const key = `${monthName} '${year}`;
                monthLabels.push(key);
                monthlyRevenue[key] = 0;
            }
            
            chartPayments?.forEach(p => {
                const d = new Date(p.payment_date);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear().toString().slice(-2);
                const key = `${monthName} '${year}`;
                if (monthlyRevenue.hasOwnProperty(key)) {
                    monthlyRevenue[key] += p.amount;
                }
            });
            
            const formattedChartData = monthLabels.map(label => ({
                name: label,
                revenue: monthlyRevenue[label]
            }));
            setChartData(formattedChartData);
        } catch (err: any) {
            let message = 'An unexpected critical error occurred.';
            if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string' && (err as any).message) {
                message = (err as any).message;
            } else if (err) {
                message = JSON.stringify(err);
            }
            addToast(`Failed to load dashboard data: ${message}`, 'error');
            console.error("Critical error in accountant fetchDashboardData:", err);
        } finally {
            setLoading(false);
        }
    }, [addToast]);
    
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
    return (
        <div className="space-y-6">
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-pulse">
                            <div className="h-5 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="mt-4 h-8 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Collected (Month)" value={`$${stats.collected.toLocaleString()}`} icon={DollarSign} color="bg-green-500" />
                    <StatCard title="Outstanding Invoices" value={stats.outstanding.toString()} icon={FileWarning} color="bg-yellow-500" />
                    <StatCard title="Invoices Paid (Month)" value={stats.paidMonth.toString()} icon={CheckCircle} color="bg-blue-500" />
                </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Revenue Overview</h3>
                <ResponsiveContainer width="100%" height={300}>
                   {loading ? (
                     <div className="flex items-center justify-center h-full text-slate-500">
                       <Loader2 size={32} className="animate-spin" />
                     </div>
                   ) : (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
                        <XAxis dataKey="name" tick={{ fill: '#A0AEC0' }} axisLine={{ stroke: 'rgba(100, 116, 139, 0.5)' }} tickLine={{ stroke: 'rgba(100, 116, 139, 0.5)' }}/>
                        <YAxis tick={{ fill: '#A0AEC0' }} axisLine={{ stroke: 'rgba(100, 116, 139, 0.5)' }} tickLine={{ stroke: 'rgba(100, 116, 139, 0.5)' }} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }} cursor={{fill: 'rgba(71, 85, 105, 0.2)'}} formatter={(value) => `$${Number(value).toLocaleString()}`} />
                        <Legend wrapperStyle={{ color: '#A0AEC0' }} />
                        <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" unit="$" radius={[4, 4, 0, 0]} />
                    </BarChart>
                   )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AccountantDashboard;
