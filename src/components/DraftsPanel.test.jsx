import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import DraftsPanel from "./DraftsPanel";

describe("DraftsPanel", () => {
  test("exibe estado de carregamento quando loading=true", () => {
    render(<DraftsPanel loading={true} open={true} />);
    expect(screen.getByText(/Carregando rascunhos/i)).toBeInTheDocument();
  });

  test("exibe mensagem vazia quando não há rascunhos", () => {
    render(<DraftsPanel rascunhos={[]} loading={false} open={true} />);
    expect(screen.getByText(/Nenhum rascunho salvo/i)).toBeInTheDocument();
  });

  test("renderiza rascunhos e aciona carregar/excluir", () => {
    const rascunhos = [
      { id: 42, tipoServico: "pintura", area: "A1", data: "2021-05-10T00:00:00" },
    ];
    const mapaTipos = { pintura: "Pintura" };
    const mapaAreas = { A1: "Área 1" };
    const onLoad = jest.fn();
    const onDelete = jest.fn();

    const { container } = render(
      <DraftsPanel
        rascunhos={rascunhos}
        loading={false}
        open={true}
        onLoad={onLoad}
        onDelete={onDelete}
        activeId={42}
        mapaTipos={mapaTipos}
        mapaAreas={mapaAreas}
      />
    );

    // título que mostra o tipo mapeado
    expect(screen.getByText("Pintura")).toBeInTheDocument();
    // meta secundária com área e data
    expect(screen.getByText(/Área 1/)).toBeInTheDocument();
    expect(screen.getByText(/10\/05\/2021/)).toBeInTheDocument();

    // botões de ação
    const carregarBtn = screen.getByText("Carregar");
    fireEvent.click(carregarBtn);
    expect(onLoad).toHaveBeenCalledWith(rascunhos[0]);

    const excluirBtn = screen.getByText("Excluir");
    fireEvent.click(excluirBtn);
    expect(onDelete).toHaveBeenCalledWith(42);

    // item ativo deve ter a classe is-active
    const item = screen.getByText("Pintura").closest("li");
    expect(item).toHaveClass("is-active");

    // toggle button exists
    const toggle = container.querySelector(".drafts-panel__toggle");
    expect(toggle).toBeInTheDocument();
  });

  test("toggle chama onToggle quando clicado", () => {
    const onToggle = jest.fn();
    const { container } = render(<DraftsPanel open={false} onToggle={onToggle} />);
    const toggle = container.querySelector('.drafts-panel__toggle');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();
  });
});
