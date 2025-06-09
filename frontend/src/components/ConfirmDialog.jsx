import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  return (
    <AnimatePresence>
      {open && (
        <Dialog
          open={open}
          onClose={onClose}
          disableEnforceFocus
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          PaperComponent={motion.div}
          PaperProps={{
            initial: { scale: 0.8, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            exit: { scale: 0.8, opacity: 0 },
            transition: { duration: 0.25 },
            style: {
              backgroundColor: '#fff',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              padding: '10px',
              minWidth: '300px',
              textAlign: 'center',
            }
          }}
          BackdropProps={{
            style: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)'
            }
          }}
        >
          <DialogTitle id="confirm-dialog-title" style={{ fontWeight: 'bold' }}>
            {title}
          </DialogTitle>

          <DialogContent>
            <DialogContentText id="confirm-dialog-description" style={{ marginBottom: 20 }}>
              {message}
            </DialogContentText>
          </DialogContent>

          <DialogActions style={{ justifyContent: 'center', gap: '12px' }}>
            <Button
              onClick={onClose}
              style={{
                backgroundColor: '#b0b0b0',
                color: '#fff',
                borderRadius: '6px',
                padding: '8px 16px',
                textTransform: 'none',
              }}
            >
              Cancelar
            </Button>

            <Button
              onClick={onConfirm}
              style={{
                backgroundColor: '#d9534f',
                color: '#fff',
                borderRadius: '6px',
                padding: '8px 16px',
                textTransform: 'none',
                transition: 'background-color 0.2s ease-in-out',
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#c9302c')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#d9534f')}
            >
              Remover
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

export default ConfirmDialog;
