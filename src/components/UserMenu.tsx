import React from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User as UserIcon, LogOut, CreditCard, LayoutDashboard, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserMenuProps {
  onNavigate?: (page: string) => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const email = user.email || '';
  const fullName = (user.user_metadata?.full_name as string) || '';
  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : email.substring(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Déconnecté avec succès');
    onNavigate?.('home');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80">
          <Avatar className="h-9 w-9 ring-2 ring-indigo-100">
            <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{fullName || 'Mon compte'}</span>
            <span className="text-xs font-normal text-slate-500">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onNavigate?.('generator')}>
          <Sparkles className="mr-2 h-4 w-4" /> Générateur IA
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate?.('clients')}>
          <LayoutDashboard className="mr-2 h-4 w-4" /> Mes clients
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate?.('equipe')}>
          <Users className="mr-2 h-4 w-4" /> Mon équipe
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate?.('billing')}>
          <CreditCard className="mr-2 h-4 w-4" /> Facturation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700">
          <LogOut className="mr-2 h-4 w-4" /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
