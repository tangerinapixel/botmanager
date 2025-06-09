import React, { createContext, useContext, useState, useCallback } from 'react'; // 1. IMPORTE useCallback
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';

const NotifierContext = createContext();

export function NotifierProvider({ children }) {
  // Renomear o estado para evitar conflito com a função no contexto, boa prática
  const [notificationState, setNotificationState] = useState({ open: false, message: '', severity: 'success' });

  // 2. ENVOLVA notifyUser com useCallback
  const notifyUser = useCallback((message, severity = 'success') => {
    setNotificationState({ open: true, message, severity });
  }, []); // Array de dependências vazio significa que a função só é criada uma vez

  // 3. ENVOLVA handleClose com useCallback também (boa prática)
  const handleClose = useCallback(() => {
    setNotificationState(prevState => ({ ...prevState, open: false }));
  }, []); // Array de dependências vazio

  return (
    <NotifierContext.Provider value={notifyUser}> {/* O valor do contexto é a função estável */}
      {children}
      <Snackbar
        open={notificationState.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <MuiAlert onClose={handleClose} severity={notificationState.severity} elevation={6} variant="filled">
          {notificationState.message}
        </MuiAlert>
      </Snackbar>
    </NotifierContext.Provider>
  );
}

export function useNotifier() {
  return useContext(NotifierContext);
}