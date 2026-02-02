import React, { useState } from 'react';
// FIX: Replace NavLink with Link as it might not be exported in the user's version of react-router-dom.
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NAVIGATION_LINKS, USER_SETTINGS_LINKS } from '../constants';
import { Menu, X, LogOut } from 'lucide-react';

const Sidebar: React.FC<{ isSidebarOpen: boolean, setSidebarOpen: (isOpen: boolean) => void }> = ({ isSidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const filteredNavLinks = NAVIGATION_LINKS.filter(link => link.roles.includes(user.role));
  const filteredSettingsLinks = USER_SETTINGS_LINKS.filter(link => link.roles.includes(user.role));

  const linkClasses = "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200";
  const activeLinkClasses = "bg-blue-600 text-white shadow-sm";
  const inactiveLinkClasses = "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-gray-700";

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 dark:border-gray-700">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">DentalOS</span>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-grow p-2">
          <ul className="space-y-1">
            {filteredNavLinks.map((link) => (
              <li key={link.name}>
                {/* FIX: Use Link instead of NavLink */}
                <Link
                  to={link.href}
                  className={`${linkClasses} ${location.pathname.startsWith(link.href) ? activeLinkClasses : inactiveLinkClasses}`}
                >
                  <link.icon className="mr-3 flex-shrink-0" size={20} />
                  <span className="truncate">{link.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-2 border-t border-slate-200 dark:border-gray-700">
            {filteredSettingsLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`${linkClasses} ${location.pathname === link.href ? activeLinkClasses : inactiveLinkClasses} w-full`}
              >
                <link.icon className="mr-3" size={20} />
                <span>{link.name}</span>
              </Link>
            ))}
          <button onClick={logout} className={`${linkClasses} ${inactiveLinkClasses} w-full`}>
            <LogOut className="mr-3" size={20} />
            <span>Logout</span>
          </button>
          <div className="flex items-center p-2 mt-2 border-t border-slate-200 dark:border-gray-700">
             <img className="h-10 w-10 rounded-full object-cover" src={user.avatar_url} alt="User avatar" />
             <div className="ml-3">
              <div className="text-sm font-semibold text-slate-800 dark:text-white">{user.full_name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const { user } = useAuth();
 
  if (!user) return null;

  return (
    <header className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-20 border-b border-slate-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={onMenuClick} className="md:hidden text-slate-600 dark:text-slate-400">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center space-x-4 md:hidden">
            <img className="h-9 w-9 rounded-full object-cover" src={user.avatar_url} alt="User avatar" />
          </div>
        </div>
      </div>
    </header>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-900">
      <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;