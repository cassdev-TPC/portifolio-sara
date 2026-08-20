export type Page = "home" | "photos" | "videos" | "contact" | "login" | "admin" | "not-found";

export const PAGE_PATHS: Record<Exclude<Page, "not-found">, string> = {
  home: "/",
  photos: "/fotos",
  videos: "/videos",
  contact: "/contato",
  login: "/login",
  admin: "/admin",
};

export function pageFromPath(pathname: string): Page {
  const path = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  if (path === "/login" || path === "/admin/login") return "login";
  if (path === "/admin") return "admin";
  if (path === "/fotos") return "photos";
  if (path === "/videos") return "videos";
  if (path === "/contato") return "contact";
  if (path === "/") return "home";
  return "not-found";
}

export const PAGE_META: Record<Page, { title: string; description: string }> = {
  home: { title: "Sara Marques | Fotografia e audiovisual", description: "Portfólio de Sara Marques: fotografia, vídeo e comunicação audiovisual." },
  photos: { title: "Fotografias | Sara Marques", description: "Galeria de fotografias de Sara Marques, com retratos, ensaios, pré-weddings, eventos e produtos." },
  videos: { title: "Vídeos | Sara Marques", description: "Produções audiovisuais de Sara Marques organizadas por categoria." },
  contact: { title: "Contato | Sara Marques", description: "Entre em contato com Sara Marques para conversar sobre fotografia e produção audiovisual." },
  login: { title: "Acesso administrativo | Sara Marques", description: "Acesso restrito à administração do portfólio." },
  admin: { title: "Galeria administrativa | Sara Marques", description: "Administração protegida do portfólio." },
  "not-found": { title: "Página não encontrada | Sara Marques", description: "A página solicitada não foi encontrada." },
};
