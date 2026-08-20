import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GaleriaAdmin from "./GaleriaAdmin";

const galleryMocks = vi.hoisted(() => ({
  deleteGalleryItem: vi.fn(),
  listGalleryItems: vi.fn(),
  updateGalleryItemDescription: vi.fn(),
}));

vi.mock("../../lib/gallery", () => ({
  DEFAULT_PHOTO_CATEGORIES: ["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"],
  DEFAULT_VIDEO_CATEGORIES: ["Serviços e Produtos"],
  ...galleryMocks,
}));

const photo = {
  id: "originals/photos/retrato/foto.jpg",
  path: "originals/photos/retrato/foto.jpg",
  url: "/foto.jpg",
  thumbnailUrl: "/foto-thumb.jpg",
  name: "Foto",
  category: "Retrato",
  description: "Retrato de teste",
  createdAt: "2026-08-20T12:00:00.000Z",
};

describe("GaleriaAdmin", () => {
  beforeEach(() => {
    galleryMocks.listGalleryItems.mockResolvedValue([photo]);
    galleryMocks.deleteGalleryItem.mockResolvedValue(undefined);
  });

  it("exclui a foto depois de uma única confirmação acessível", async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, "confirm");

    render(<GaleriaAdmin kind="photos" refreshKey={0} />);

    await screen.findByText("Retrato de teste");
    await user.click(screen.getByRole("button", { name: "Excluir arquivo" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Retrato de teste");
    await user.click(screen.getByRole("button", { name: "Excluir este arquivo" }));

    await waitFor(() => expect(galleryMocks.deleteGalleryItem).toHaveBeenCalledWith(photo.path));
    await waitFor(() => expect(screen.queryByText("Retrato de teste")).not.toBeInTheDocument());
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
});
