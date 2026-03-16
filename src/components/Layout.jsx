import NavBar from "./NavBar";
import "../styles/main.css";

/**
 * Layout principal — NavBar superior + area de conteudo.
 * A navegacao, controle de permissoes e logout ficam no componente NavBar.
 */
function Layout({ children }) {
  return (
    <div className="app-layout">
      <NavBar />

      <div className="app-content">
        <main className="container" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;