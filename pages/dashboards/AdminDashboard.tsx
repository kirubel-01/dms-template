
import React, { useEffect, useState, memo, useCallback } from 'react';
import { Users, DollarSign, Calendar, FileText, UserPlus, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { AppUser } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';

const StatCard = memo<{ title: string; value: string; icon: React.ElementType }>(({ title, value, icon: Icon }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <Icon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-2">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                 <div className="flex items-center text-sm mt-1">
                    <span className="text-slate-500">in the current month</span>
                </div>
            </div>
        </div>
    );
});

const CalendarWidget = () => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [appointmentDays, setAppointmentDays] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);

    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    useEffect(() => {
        const fetchAppointmentsForMonth = async () => {
            setLoading(true);
            const firstDay = new Date(currentYear, currentMonth, 1);
            const lastDay = new Date(currentYear, currentMonth + 1, 0);

            const { data, error } = await supabase
                .from('appointments')
                .select('start_time')
                .gte('start_time', firstDay.toISOString())
                .lte('start_time', lastDay.toISOString());

            if (error) {
                console.error("Error fetching appointments for calendar", error);
                setAppointmentDays(new Set());
            } else {
                const daysWithAppointments = new Set<number>(
                    data.map(app => new Date(app.start_time).getUTCDate())
                );
                setAppointmentDays(daysWithAppointments);
            }
            setLoading(false);
        };
        fetchAppointmentsForMonth();
    }, [currentMonth, currentYear]);
    
    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
    };

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDayOfMonth });

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Global Appointments</h3>
                {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
            </div>
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeMonth(-1)} className="text-slate-500 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700">&lt;</button>
                <div className="font-semibold">{monthName} {currentYear}</div>
                <button onClick={() => changeMonth(1)} className="text-slate-500 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2 mt-2 text-sm">
                {emptyDays.map((_, i) => <div key={`empty-${i}`}></div>)}
                {days.map(day => (
                    <div key={day} className={`relative p-1 rounded-full flex items-center justify-center h-8 w-8 ${day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear() ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-gray-700'}`}>
                        {day}
                        {appointmentDays.has(day) && (
                            <span className="absolute bottom-1 h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};


const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState({ patientVisits: 0, invoiced: 0, newPatients: 0, upcomingAppointments: 0 });
    const [staff, setStaff] = useState<AppUser[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const fetchDashboardData = useCallback(async () => {
        setLoadingStats(true);
        try {
            const today = new Date();
            
            const startOfToday = new Date(today);
            startOfToday.setHours(0, 0, 0, 0);
            
            const startOfTomorrow = new Date(today);
            startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
            startOfTomorrow.setHours(0, 0, 0, 0);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            
            const [
                { count: patientVisits, error: pvError },
                { data: invoicedData, error: iError },
                { count: newPatients, error: npError },
                { count: upcomingAppointments, error: uaError }
            ] = await Promise.all([
                supabase
                    .from('appointments')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'Completed')
                    .gte('start_time', startOfMonth.toISOString())
                    .lt('start_time', startOfNextMonth.toISOString()),
                supabase
                    .from('invoices')
                    .select('amount')
                    .gte('issue_date', startOfMonth.toISOString())
                    .lt('issue_date', startOfNextMonth.toISOString()),
                supabase
                    .from('patients')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', startOfMonth.toISOString())
                    .lt('created_at', startOfNextMonth.toISOString()),
                supabase
                    .from('appointments')
                    .select('id', { count: 'exact', head: true })
                    .gte('start_time', startOfToday.toISOString())
                    .lt('start_time', startOfTomorrow.toISOString())
                    .in('status', ['Scheduled', 'Checked In'])
            ]);
            
            const errors = [pvError, iError, npError, uaError].filter(Boolean);
            if (errors.length > 0) {
                const errorMessages = errors.map(e => {
                  if (e && typeof e.message === 'string' && e.message) {
                    return e.message;
                  }
                  return JSON.stringify(e);
                }).join(', ');
                addToast(`Errors fetching dashboard stats: ${errorMessages}`, 'error');
                console.error("Errors fetching dashboard stats:", errors);
                return;
            }

            const invoiced = invoicedData?.reduce((sum, i) => sum + i.amount, 0) || 0;
            setStats({
                patientVisits: patientVisits || 0,
                invoiced: invoiced,
                newPatients: newPatients || 0,
                upcomingAppointments: upcomingAppointments || 0,
            });


            const { data: staffRes, error: staffError } = await supabase.from('users').select('*').limit(5).order('full_name');
            if(staffError) {
                addToast(`Could not fetch staff list: ${staffError.message}`, 'error');
            } else {
                 setStaff(staffRes as AppUser[] || []);
            }
        } catch (err: any) {
            let message = 'An unexpected critical error occurred.';
            if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string' && (err as any).message) {
                message = (err as any).message;
            } else if (err) {
                message = JSON.stringify(err);
            }
            addToast(`Failed to load dashboard data: ${message}`, 'error');
            console.error("Critical error in fetchDashboardData:", err);
        } finally {
            setLoadingStats(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
    const allStatsZero = !loadingStats && stats.patientVisits === 0 && stats.invoiced === 0 && stats.newPatients === 0 && stats.upcomingAppointments === 0;

  return (
    <div className="space-y-6">
       <div className="flex justify-end items-center space-x-3">
            <button onClick={() => navigate('/patients')} className="bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center space-x-2 border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600 text-sm font-medium">
                <UserPlus size={16} />
                <span>Add Patient</span>
            </button>
            <button onClick={() => navigate('/staff')} className="bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center space-x-2 border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600 text-sm font-medium">
                <UserPlus size={16} />
                <span>Add Staff</span>
            </button>
            <button onClick={() => navigate('/reports')} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 text-sm font-medium">
                <FileText size={16} />
                <span>Generate Report</span>
            </button>
        </div>
        
        {allStatsZero && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg flex items-center space-x-3">
                <Info size={20} />
                <p>No activity recorded for the current period. The dashboard is ready for new data.</p>
            </div>
        )}

      {loadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="mt-4 h-8 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
            ))}
        </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Patient Visits (Month)" value={stats.patientVisits.toString()} icon={Users} />
            <StatCard title="Invoiced (Month)" value={`$${stats.invoiced.toLocaleString()}`} icon={DollarSign} />
            <StatCard title="New Patients (Month)" value={stats.newPatients.toString()} icon={UserPlus} />
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Upcoming Appointments</p>
                    <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-2">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.upcomingAppointments}</p>
                    <p className="text-slate-500 text-sm mt-1">for today</p>
                </div>
            </div>
          </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Staff Management</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {staff.map(member => (
                    <tr key={member.id} className="border-b border-slate-200 dark:border-gray-700">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{member.full_name}</td>
                      <td className="px-4 py-3">{member.role}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${member.email_confirmed_at ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {member.email_confirmed_at ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate('/staff')} className="text-blue-600 hover:underline text-sm font-medium">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
        <div className="lg:col-span-1">
            <CalendarWidget />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
