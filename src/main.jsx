import {init} from "./storage";
import React from 'react';
import './index.css';
import '@fontsource/roboto';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from "react-router-dom";
import {SnackbarProvider} from "notistack";
import {ThemeProvider, createTheme} from '@mui/material/styles';
import App from './App.jsx';
import './index.css';
import { registerSW } from "virtual:pwa-register";

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SnackbarProvider maxSnack={3} dense={true} preventDuplicate={true}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </SnackbarProvider>
  </React.StrictMode>,
)

if ("serviceWorker" in navigator && !/localhost/.test(window.location)) {
  registerSW();
}