import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Lightbox } from "./App";

const photos = [
  { id: "1", path: "one", url: "/one.jpg", optimizedUrl: "/one.webp", name: "IMG_1", category: "Retrato" },
  { id: "2", path: "two", url: "/two.jpg", optimizedUrl: "/two.webp", name: "Foto dois", category: "Eventos", description: "Apresentação em evento" },
];

describe("lightbox", () => {
  it("abre como modal, navega circularmente e fecha com Escape", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const source = document.createElement("button");
    document.body.append(source);
    render(<Lightbox photos={photos} initialIndex={0} onClose={close} sourceElement={source} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Foto 1 de 2 · Retrato")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("Foto 2 de 2 · Eventos")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}{Escape}");
    expect(close).toHaveBeenCalledOnce();
  });
});
