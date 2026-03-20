// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

// Páginas
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Medicoes from "./pages/EnviarMedicao";
import Solicitacoes from "./pages/PurchaseRequest";
import Relatorios from "./pages/MeusRelatorios";
import StatusSolicitacao from "./pages/StatusSolicitacao";
import Upload from "./pages/Upload";
import Measurements from "./pages/measurements";
import GerenciarObras from "./pages/GerenciarObras";
import AdminPanel from "./pages/AdminPanel";
import DiarioObra from "./pages/DiarioObra";
import SyncManager from "./components/SyncManager";
import Sincronizacao from "./pages/Sincronizacao";

function App() {
  return (
    <AuthProvider>
      <Router>
        <SyncManager />
        <Routes>
          {/* Páginas públicas */}
          <Route path="/login" element={<Login />} />

          {/* Páginas protegidas — todos os perfis */}
          <Route path="/" element={<PrivateRoute routePath="/"><Dashboard /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute routePath="/profile"><Profile /></PrivateRoute>} />
          <Route path="/medicoes" element={<PrivateRoute routePath="/medicoes"><Medicoes /></PrivateRoute>} />
          <Route path="/solicitacoes" element={<PrivateRoute routePath="/solicitacoes"><Solicitacoes /></PrivateRoute>} />
          <Route path="/status-solicitacoes" element={<PrivateRoute routePath="/status-solicitacoes"><StatusSolicitacao /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute routePath="/upload"><Upload /></PrivateRoute>} />
          <Route path="/diario" element={<PrivateRoute routePath="/diario"><DiarioObra /></PrivateRoute>} />
          <Route path="/sincronizacao" element={<PrivateRoute routePath="/sincronizacao"><Sincronizacao /></PrivateRoute>} />

          {/* Supervisor/Admin + lista de medições para encarregado */}
          <Route path="/medicoes-lista" element={<PrivateRoute routePath="/medicoes-lista"><Measurements /></PrivateRoute>} />
          <Route path="/relatorios" element={<PrivateRoute routePath="/relatorios"><Relatorios /></PrivateRoute>} />
          <Route path="/obras" element={<PrivateRoute routePath="/obras"><GerenciarObras /></PrivateRoute>} />

          {/* Admin apenas */}
          <Route path="/admin" element={<PrivateRoute routePath="/admin"><AdminPanel /></PrivateRoute>} />
          <Route path="/register" element={<PrivateRoute routePath="/register"><Register /></PrivateRoute>} />

          {/* Rota 404 — redireciona para a página inicial */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
