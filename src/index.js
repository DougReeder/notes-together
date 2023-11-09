import {init} from "./storage";
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import '@fontsource/roboto';
import {SnackbarProvider} from "notistack";
import {BrowserRouter} from "react-router-dom";
import {ThemeProvider, StyledEngineProvider, createTheme} from '@mui/material/styles';

if (!('requestIdleCallback' in window)) {
  // https://github.com/behnammodi/polyfill/blob/master/window.polyfill.js
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (callback, options) {
      options = options || {};
      const relaxation = 1;
      const timeout = options.timeout || relaxation;
      const start = performance.now();
      return setTimeout(function () {
        callback({
          get didTimeout() {
            return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
          },
          timeRemaining: function () {
            return Math.max(0, relaxation + (performance.now() - start));
          },
        });
      }, relaxation);
    };
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }
}

// init is idempotent
init().then((/*{indexedDb, isFirstLaunch, remoteStorage}*/) => {
  // console.log(`indexedDB: ${indexedDb}, remoteStorage initialized: ${remoteStorage} isFirstLaunch: ${isFirstLaunch}`);
});

const theme = createTheme({
  components: {
    MuiFab: {
      styleOverrides: {
        root: {
          position: 'absolute',
          right: '0.75rem',
          bottom: '0.75rem',
          zIndex: 2,
          color: 'black',
          backgroundColor: '#94bbe6',
        }
      },
    },
    MuiAppBar: {
      defaultProps: {
        position: 'sticky',
      },
      styleOverrides: {
        root: {
          color: 'black',
          backgroundColor: '#94bbe6',
          flexGrow: 0
        }
      },
    },
  },
  palette: {
    // primary: {
    //   main: '#94bbe6',
    // },
    secondary: {
      main: '#0061bd',   // important buttons on AppBars
    }
  },
});

const root = createRoot(document.getElementById('root'));
root.render(  <React.StrictMode>
    <SnackbarProvider maxSnack={3} autoHideDuration={8000} dense={true} preventDuplicate={true}>
      <BrowserRouter>
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={theme}>
            <App />
          </ThemeProvider>
        </StyledEngineProvider>
      </BrowserRouter>
    </SnackbarProvider>
  </React.StrictMode>,
);
