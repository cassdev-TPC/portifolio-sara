import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotosPage } from "./App";

const galleryMocks = vi.hoisted(() => ({ listGalleryPage: vi.fn() }));

vi.mock("../lib/gallery", () => ({
  DEFAULT_PHOTO_CATEGORIES: ["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"],
  DEFAULT_VIDEO_CATEGORIES: ["Serviços e Produtos"],
  GALLERY_PAGE_SIZE: 12,
  getCategories: (_items: unknown, defaults: string[]) => defaults,
  listGalleryItems: vi.fn(),
  ...galleryMocks,
}));

const photos = Array.from({ length: 13 }, (_, index) => ({
  id: `foto-${index}`,
  path: `foto-${index}`,
  name: `Foto ${index + 1}`,
  url: `/foto-${index}.jpg`,
  thumbnailUrl: `/foto-${index}.jpg`,
  category: "Retrato",
  description: `Foto ${index + 1}`,
}));

describe("PhotosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  });
  afterEach(cleanup);

  it("começa com 12 fotos, acrescenta o próximo lote e consulta o filtro", async () => {
    const user = userEvent.setup();
    galleryMocks.listGalleryPage
      .mockResolvedValueOnce({ items: photos.slice(0, 12), total: 13 })
      .mockResolvedValueOnce({ items: photos.slice(12), total: 13 })
      .mockResolvedValueOnce({ items: [photos[0]], total: 1 });

    render(<PhotosPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Abrir / })).toHaveLength(12));
    expect(screen.getByText("12 de 13 fotos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Abrir / })).toHaveLength(13));
    expect(galleryMocks.listGalleryPage).toHaveBeenLastCalledWith("photos", expect.objectContaining({ offset: 12, limit: 12 }));

    await user.click(screen.getByRole("button", { name: "Retrato" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Abrir / })).toHaveLength(1));
    expect(galleryMocks.listGalleryPage).toHaveBeenLastCalledWith("photos", expect.objectContaining({ category: "Retrato", sort: "newest" }));
  });
});
