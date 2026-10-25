// frontend/src/theme.js
// Tema MUI — Design System Premium Dark Mode v2
// Passo 3: Overrides completos de Button, TextField, Switch, Paper

import { createTheme, alpha } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0f1117',
      paper:   '#1c2333',
    },
    primary: {
      main:         '#4f8ef7',
      light:        '#6aa1ff',
      dark:         '#3a78e8',
      contrastText: '#ffffff',
    },
    secondary: {
      main:         '#7c5cbf',
      light:        '#9c7ae0',
      dark:         '#5e3fa3',
      contrastText: '#ffffff',
    },
    success: {
      main:         '#25d366',
      contrastText: '#ffffff',
    },
    warning: {
      main:         '#f0a500',
    },
    error: {
      main:         '#e05252',
    },
    text: {
      primary:   '#e8eaf6',
      secondary: '#9aa3b8',
      disabled:  '#3a4055',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    action: {
      hover:    'rgba(255, 255, 255, 0.05)',
      selected: 'rgba(255, 255, 255, 0.08)',
      disabled: 'rgba(255, 255, 255, 0.2)',
    },
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 500, color: '#e8eaf6' },
    subtitle2: { fontWeight: 600, color: '#9aa3b8', fontSize: '0.78rem', letterSpacing: '0.04em' },
    body1: { fontSize: '0.9rem', lineHeight: 1.6 },
    body2: { fontSize: '0.82rem', lineHeight: 1.5, color: '#9aa3b8' },
    caption: { fontSize: '0.72rem', color: '#9aa3b8', letterSpacing: '0.02em' },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.02em',
      fontSize: '0.85rem',
    },
  },

  shape: {
    borderRadius: 10,
  },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.4)',
    '0 2px 6px rgba(0,0,0,0.45)',
    '0 4px 12px rgba(0,0,0,0.5)',
    '0 6px 16px rgba(0,0,0,0.5)',
    '0 8px 24px rgba(0,0,0,0.55)',
    '0 10px 30px rgba(0,0,0,0.55)',
    '0 12px 36px rgba(0,0,0,0.6)',
    '0 14px 40px rgba(0,0,0,0.6)',
    '0 16px 44px rgba(0,0,0,0.65)',
    '0 18px 48px rgba(0,0,0,0.65)',
    '0 20px 52px rgba(0,0,0,0.65)',
    '0 22px 56px rgba(0,0,0,0.65)',
    '0 24px 60px rgba(0,0,0,0.65)',
    '0 26px 64px rgba(0,0,0,0.65)',
    '0 28px 68px rgba(0,0,0,0.65)',
    '0 30px 72px rgba(0,0,0,0.65)',
    '0 32px 76px rgba(0,0,0,0.65)',
    '0 34px 80px rgba(0,0,0,0.65)',
    '0 36px 84px rgba(0,0,0,0.65)',
    '0 38px 88px rgba(0,0,0,0.65)',
    '0 40px 92px rgba(0,0,0,0.65)',
    '0 42px 96px rgba(0,0,0,0.65)',
    '0 44px 100px rgba(0,0,0,0.65)',
    '0 46px 104px rgba(0,0,0,0.65)',
  ],

  components: {

    // ╔══════════════════════════════════════════════════╗
    // ║  BUTTON                                          ║
    // ╚══════════════════════════════════════════════════╝
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: '12px',
          fontWeight: 500,
          textTransform: 'none',
          fontSize: '0.845rem',
          letterSpacing: '0.02em',
          transition: 'all 0.18s ease',
          padding: '8px 18px',
          '&:active': {
            transform: 'scale(0.965)',
          },
          '&.Mui-disabled': {
            opacity: 0.55,
            color: 'rgba(255, 255, 255, 0.35)',
          },
        },

        // Contained — gradiente + glow no hover
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          '&:hover': {
            boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
            filter: 'brightness(1.1)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #3a78e8 0%, #4f8ef7 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f8ef7 0%, #6aa1ff 100%)',
            boxShadow: '0 4px 20px rgba(79,142,247,0.35)',
          },
        },
        containedSuccess: {
          background: 'linear-gradient(135deg, #1aab55 0%, #25d366 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #25d366 0%, #3de07a 100%)',
            boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
          },
        },
        containedError: {
          background: 'linear-gradient(135deg, #c0392b 0%, #e05252 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #e05252 0%, #e97070 100%)',
            boxShadow: '0 4px 20px rgba(224,82,82,0.3)',
          },
        },

        // Outlined — borda sutil, fundo translúcido no hover
        outlined: {
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.22)',
          color: '#e8eaf6',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.42)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
          },
          '&.Mui-disabled': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
            color: 'rgba(255, 255, 255, 0.3)',
          }
        },
        outlinedPrimary: {
          borderColor: 'rgba(79,142,247,0.45)',
          color: '#4f8ef7',
          '&:hover': {
            borderColor: '#4f8ef7',
            backgroundColor: 'rgba(79,142,247,0.08)',
          },
        },
        outlinedSuccess: {
          borderColor: 'rgba(37,211,102,0.45)',
          color: '#25d366',
          '&:hover': {
            borderColor: '#25d366',
            backgroundColor: 'rgba(37,211,102,0.08)',
          },
        },
        outlinedError: {
          borderColor: 'rgba(224,82,82,0.45)',
          color: '#e05252',
          '&:hover': {
            borderColor: '#e05252',
            backgroundColor: 'rgba(224,82,82,0.08)',
          },
        },

        // Text
        text: {
          color: '#9aa3b8',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#e8eaf6',
          },
        },

        // Tamanhos
        sizeSmall: {
          borderRadius: '10px',
          padding: '5px 14px',
          fontSize: '0.78rem',
        },
        sizeLarge: {
          borderRadius: '14px',
          padding: '11px 24px',
          fontSize: '0.95rem',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  ICON BUTTON                                     ║
    // ╚══════════════════════════════════════════════════╝
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.07)',
          },
          '&:active': {
            transform: 'scale(0.92)',
          },
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  TEXT FIELD  (Input / Textarea)                  ║
    // ╚══════════════════════════════════════════════════╝
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          backgroundColor: 'rgba(28, 35, 51, 0.7)',
          backdropFilter: 'blur(8px)',
          color: '#e8eaf6',
          fontSize: '0.875rem',
          fontFamily: "'Inter', sans-serif",
          transition: 'all 0.18s ease',

          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.1)',
            transition: 'border-color 0.18s ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.22)',
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(33, 42, 64, 0.85)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#4f8ef7',
              borderWidth: '1.5px',
              boxShadow: '0 0 0 3px rgba(79,142,247,0.14)',
            },
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e05252',
          },
          '&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
            boxShadow: '0 0 0 3px rgba(224,82,82,0.14)',
          },
          '&.Mui-disabled': {
            opacity: 0.45,
          },
        },
        input: {
          padding: '9px 14px',
          '&::placeholder': {
            color: '#5a6278',
            opacity: 1,
          },
          '&:-webkit-autofill': {
            WebkitBoxShadow: '0 0 0 100px #1c2333 inset',
            WebkitTextFillColor: '#e8eaf6',
          },
        },
        multiline: {
          padding: '0',
        },
        inputMultiline: {
          padding: '10px 14px',
          resize: 'vertical',
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9aa3b8',
          fontSize: '0.85rem',
          fontFamily: "'Inter', sans-serif",
          '&.Mui-focused': {
            color: '#4f8ef7',
          },
          '&.Mui-error': {
            color: '#e05252',
          },
        },
        outlined: {
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)',
          },
        },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: '0.72rem',
          marginTop: '4px',
          marginLeft: '4px',
          color: '#5a6278',
          fontFamily: "'Inter', sans-serif",
          '&.Mui-error': {
            color: '#e05252',
          },
        },
      },
    },

    // Input nativo / Select
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: "'Inter', sans-serif",
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  SELECT                                          ║
    // ╚══════════════════════════════════════════════════╝
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#9aa3b8',
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c2333',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.85rem',
          fontFamily: "'Inter', sans-serif",
          borderRadius: '8px',
          margin: '2px 6px',
          color: '#c0c8e0',
          transition: 'all 0.12s ease',
          '&:hover': {
            backgroundColor: 'rgba(79,142,247,0.1)',
            color: '#e8eaf6',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(79,142,247,0.15)',
            color: '#4f8ef7',
            '&:hover': {
              backgroundColor: 'rgba(79,142,247,0.2)',
            },
          },
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  SWITCH / TOGGLE                                 ║
    // ╚══════════════════════════════════════════════════╝
    MuiSwitch: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          width: 42,
          height: 24,
          padding: 0,
          borderRadius: 999,
        },
        switchBase: {
          padding: 0,
          margin: '3px',
          transitionDuration: '250ms',
          '&.Mui-checked': {
            transform: 'translateX(18px)',
            '& + .MuiSwitch-track': {
              backgroundColor: '#25d366',
              opacity: 1,
              border: 0,
              boxShadow: '0 0 10px rgba(37,211,102,0.35)',
            },
            '& .MuiSwitch-thumb': {
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            },
          },
          '&.Mui-disabled': {
            opacity: 0.45,
          },
          '&.Mui-focusVisible .MuiSwitch-thumb': {
            boxShadow: '0 0 0 3px rgba(37,211,102,0.25)',
          },
        },
        thumb: {
          boxSizing: 'border-box',
          width: 18,
          height: 18,
          backgroundColor: '#8892a4',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
        },
        track: {
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.1)',
          opacity: 1,
          transition: 'background-color 0.25s ease',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  PAPER / CARDS                                   ║
    // ╚══════════════════════════════════════════════════╝
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1c2333',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        },
        elevation3: {
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1c2333',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.14)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          '&:last-child': {
            paddingBottom: '16px',
          },
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  MODAL / DIALOG                                  ║
    // ╚══════════════════════════════════════════════════╝
    MuiModal: {
      styleOverrides: {
        backdrop: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c2333',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 600,
          color: '#e8eaf6',
          fontFamily: "'Inter', sans-serif",
          padding: '20px 24px 12px',
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 24px',
          color: '#9aa3b8',
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
          gap: '8px',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  TOOLTIP                                         ║
    // ╚══════════════════════════════════════════════════╝
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: '#212840',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#e8eaf6',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          padding: '5px 10px',
          fontFamily: "'Inter', sans-serif",
        },
        arrow: {
          color: '#212840',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  ALERT                                           ║
    // ╚══════════════════════════════════════════════════╝
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border: '1px solid',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.85rem',
        },
        standardSuccess: {
          backgroundColor: 'rgba(37,211,102,0.1)',
          borderColor: 'rgba(37,211,102,0.3)',
          color: '#5fe092',
        },
        standardWarning: {
          backgroundColor: 'rgba(240,165,0,0.1)',
          borderColor: 'rgba(240,165,0,0.3)',
          color: '#f0c040',
        },
        standardError: {
          backgroundColor: 'rgba(224,82,82,0.1)',
          borderColor: 'rgba(224,82,82,0.3)',
          color: '#e87878',
        },
        standardInfo: {
          backgroundColor: 'rgba(79,142,247,0.1)',
          borderColor: 'rgba(79,142,247,0.3)',
          color: '#7fb4ff',
        },
        filledSuccess: { backgroundColor: '#1aab55' },
        filledWarning: { backgroundColor: '#c98b00' },
        filledError:   { backgroundColor: '#c0392b' },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  CHIP                                            ║
    // ╚══════════════════════════════════════════════════╝
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.75rem',
          height: '26px',
          border: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(255,255,255,0.06)',
          color: '#9aa3b8',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
        },
        label: {
          padding: '0 10px',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  LINEAR PROGRESS                                 ║
    // ╚══════════════════════════════════════════════════╝
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          height: 6,
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        bar: {
          borderRadius: 999,
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  CIRCULAR PROGRESS                               ║
    // ╚══════════════════════════════════════════════════╝
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: '#4f8ef7',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  DIVIDER                                         ║
    // ╚══════════════════════════════════════════════════╝
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.07)',
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  TABLE                                           ║
    // ╚══════════════════════════════════════════════════╝
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: '#e8eaf6',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.85rem',
          padding: '10px 16px',
        },
        head: {
          color: '#9aa3b8',
          fontWeight: 600,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          backgroundColor: '#161b27',
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.12s ease',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.03)',
          },
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  CHECKBOX / RADIO                                ║
    // ╚══════════════════════════════════════════════════╝
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.3)',
          borderRadius: '6px',
          '&.Mui-checked': {
            color: '#4f8ef7',
          },
        },
      },
    },

    MuiRadio: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.3)',
          '&.Mui-checked': {
            color: '#4f8ef7',
          },
        },
      },
    },

    // ╔══════════════════════════════════════════════════╗
    // ║  SNACKBAR (base para toasts do Passo 6)          ║
    // ╚══════════════════════════════════════════════════╝
    MuiSnackbar: {
      styleOverrides: {
        root: {
          bottom: '24px',
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: '#212840',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          color: '#e8eaf6',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.85rem',
          padding: '8px 16px',
        },
      },
    },
  },
});

export default theme;
