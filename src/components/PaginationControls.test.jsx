import { fireEvent, render, screen } from "@testing-library/react";
import PaginationControls from "./PaginationControls";

describe("PaginationControls", () => {
  it("chama onChangePage ao navegar para a página anterior e próxima", () => {
    const onChangePage = jest.fn();

    render(
      <PaginationControls
        currentPage={2}
        totalPages={4}
        onChangePage={onChangePage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "← Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima →" }));

    expect(onChangePage).toHaveBeenNthCalledWith(1, 1);
    expect(onChangePage).toHaveBeenNthCalledWith(2, 3);
  });

  it("desabilita os botões nos limites da paginação", () => {
    const { rerender } = render(
      <PaginationControls
        currentPage={1}
        totalPages={3}
        onChangePage={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "← Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima →" })).not.toBeDisabled();

    rerender(
      <PaginationControls
        currentPage={3}
        totalPages={3}
        onChangePage={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Próxima →" })).toBeDisabled();
  });
});
