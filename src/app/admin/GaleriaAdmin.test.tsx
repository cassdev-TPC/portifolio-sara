import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GaleriaAdmin from "./GaleriaAdmin";

const galleryMocks = vi.hoisted(() => ({
  deleteGalleryItem: vi.fn(),
  listGalleryPage: vi.fn(),
  updateGalleryItemDescription: vi.fn(),
}));

vi.mock("../../lib/gallery", () => ({
  DEFAULT_PHOTO_CATEGORIES: ["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"],
  DEFAULT_VIDEO_CATEGORIES: ["Serviços e Produtos"],
  GALLERY_PAGE_SIZE: 12,
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
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    galleryMocks.deleteGalleryItem.mockResolvedValue(undefined);
  });

  it("exclui a foto depois de uma única confirmação acessível", async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, "confirm");
    galleryMocks.listGalleryPage.mockResolvedValueOnce({ items: [photo], total: 1 }).mockResolvedValueOnce({ items: [], total: 0 });

    render(<GaleriaAdmin kind="photos" refreshKey={0} />);

    await screen.findByText("Retrato de teste");
    await user.click(screen.getByRole("button", { name: "Excluir arquivo" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Retrato de teste");
    await user.click(screen.getByRole("button", { name: "Excluir este arquivo" }));

    await waitFor(() => expect(galleryMocks.deleteGalleryItem).toHaveBeenCalledWith(photo.path));
    await waitFor(() => expect(galleryMocks.listGalleryPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Retrato de teste")).not.toBeInTheDocument());
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it("mantém a foto e mostra o erro devolvido pelo backend quando a exclusão falha", async () => {
    const user = userEvent.setup();
    galleryMocks.listGalleryPage.mockResolvedValue({ items: [photo], total: 1 });
    galleryMocks.deleteGalleryItem.mockRejectedValue(new Error("Worker sem segredo de exclusão configurado."));

    render(<GaleriaAdmin kind="photos" refreshKey={0} />);

    await screen.findByText("Retrato de teste");
    await user.click(screen.getByRole("button", { name: "Excluir arquivo" }));
    await user.click(screen.getByRole("button", { name: "Excluir este arquivo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Worker sem segredo de exclusão configurado.");
    expect(screen.getByText("Retrato de teste")).toBeInTheDocument();
  });

  it("mostra o total do catálogo e acrescenta o próximo lote", async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 12 }, (_, index) => ({
      ...photo,
      id: `foto-${index}`,
      path: `foto-${index}`,
      description: `Foto ${index + 1}`,
    }));
    const lastPhoto = { ...photo, id: "foto-12", path: "foto-12", description: "Foto 13" };
    galleryMocks.listGalleryPage.mockResolvedValueOnce({ items: firstPage, total: 13 }).mockResolvedValueOnce({ items: [lastPhoto], total: 13 });

    render(<GaleriaAdmin kind="photos" refreshKey={0} />);

    expect(await screen.findByText("13 arquivos no total · 12 exibidos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("13 arquivos no total · 13 exibidos")).toBeInTheDocument();
    expect(screen.getByText("Foto 13")).toBeInTheDocument();
    expect(galleryMocks.listGalleryPage).toHaveBeenLastCalledWith("photos", expect.objectContaining({ offset: 12 }));
  });

  it("envia categoria e ordem à consulta e reinicia no primeiro lote", async () => {
    const user = userEvent.setup();
    galleryMocks.listGalleryPage.mockResolvedValue({ items: [photo], total: 1 });

    render(<GaleriaAdmin kind="photos" refreshKey={0} />);
    await screen.findByText("Retrato de teste");
    await user.selectOptions(screen.getByRole("combobox", { name: "Categoria" }), "Retrato");
    await user.selectOptions(screen.getByRole("combobox", { name: "Ordenar por" }), "oldest");

    await waitFor(() => expect(galleryMocks.listGalleryPage).toHaveBeenLastCalledWith("photos", expect.objectContaining({
      category: "Retrato", sort: "oldest", limit: 12,
    })));
    expect(screen.getByText("1 arquivo na categoria · 1 exibido")).toBeInTheDocument();
  });
});
